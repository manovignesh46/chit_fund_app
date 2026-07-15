/**
 * Backfill existing ChitFunds into ChitFundTemplates (Phase 1 migration).
 *
 * SAFETY: The ONLY write this script performs on existing rows is setting the
 * nullable `ChitFund.templateId` pointer. No financial column is ever touched.
 * It is idempotent — funds that already have a templateId are skipped, and
 * templates are matched-or-created by recomputed structural signature, so
 * re-running never creates duplicates.
 *
 * Usage (matches the repo's ts-node convention, e.g. `setup-default-partners`):
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/backfill-chit-fund-templates.ts --dry-run  # report only
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/backfill-chit-fund-templates.ts            # apply
 */
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const DRY_RUN = process.argv.includes('--dry-run');

// Structural signature shared between a ChitFund and a ChitFundTemplate.
// Must be computed identically on both sides so equal structures collapse.
function signatureParts(
  totalAmount: number,
  monthlyContribution: number,
  firstMonthContribution: number | null | undefined,
  duration: number,
  membersCount: number,
  chitFundType: string | null | undefined,
  sortedFixed: string
): string {
  return JSON.stringify([
    totalAmount,
    monthlyContribution,
    firstMonthContribution ?? '',
    duration,
    membersCount,
    chitFundType || 'Auction',
    sortedFixed,
  ]);
}

function fundSignature(f: any): string {
  const sortedFixed = (f.fixedAmounts || [])
    .slice()
    .sort((a: any, b: any) => a.month - b.month)
    .map((fa: any) => `${fa.month}:${fa.amount}`)
    .join(',');
  return signatureParts(
    f.totalAmount,
    f.monthlyContribution,
    f.firstMonthContribution,
    f.duration,
    f.membersCount,
    f.chitFundType,
    sortedFixed
  );
}

function templateSignature(t: any): string {
  const pattern = t.fixedAmountsPattern || {};
  const sortedFixed = Object.keys(pattern)
    .map(Number)
    .sort((a: number, b: number) => a - b)
    .map((m: number) => `${m}:${pattern[m]}`)
    .join(',');
  return signatureParts(
    t.totalAmount,
    t.monthlyContribution,
    t.firstMonthContribution,
    t.duration,
    t.membersCount,
    t.chitFundType,
    sortedFixed
  );
}

// Build the { "1": amount, "2": amount, ... } pattern from a Fixed fund's rows.
function buildPattern(f: any): Record<string, number> | null {
  if ((f.chitFundType || 'Auction') !== 'Fixed') return null;
  const pattern: Record<string, number> = {};
  for (const fa of f.fixedAmounts || []) pattern[String(fa.month)] = fa.amount;
  return pattern;
}

async function financialSnapshot() {
  const agg = await prisma.chitFund.aggregate({
    _count: { _all: true },
    _sum: {
      totalAmount: true,
      monthlyContribution: true,
      duration: true,
      membersCount: true,
    },
  });
  return {
    count: agg._count._all,
    totalAmount: agg._sum.totalAmount ?? 0,
    monthlyContribution: agg._sum.monthlyContribution ?? 0,
    duration: agg._sum.duration ?? 0,
    membersCount: agg._sum.membersCount ?? 0,
  };
}

async function main() {
  console.log(`\n=== ChitFund → Template backfill ${DRY_RUN ? '(DRY RUN)' : ''} ===\n`);

  const before = await financialSnapshot();
  console.log('Financial snapshot BEFORE:', before);

  // Distinct owners that have chit funds.
  const owners: Array<{ createdById: number }> = await prisma.chitFund.findMany({
    distinct: ['createdById'],
    select: { createdById: true },
  });

  let templatesCreated = 0;
  let fundsLinked = 0;
  let fundsSkipped = 0;

  for (const { createdById } of owners) {
    const funds = await prisma.chitFund.findMany({
      where: { createdById },
      include: { fixedAmounts: true },
      orderBy: { id: 'asc' },
    });

    // Seed the signature → templateId map from templates this owner already has.
    const existingTemplates = await prisma.chitFundTemplate.findMany({
      where: { createdById },
    });
    const sigToTemplateId = new Map<string, number>();
    for (const t of existingTemplates) sigToTemplateId.set(templateSignature(t), t.id);

    for (const fund of funds) {
      if (fund.templateId != null) {
        fundsSkipped++;
        continue; // idempotent: already linked
      }

      const sig = fundSignature(fund);
      let templateId = sigToTemplateId.get(sig);

      if (templateId == null) {
        if (DRY_RUN) {
          console.log(`  [dry] would CREATE template for signature of fund #${fund.id} "${fund.name}"`);
          // Use a placeholder so dry-run reports linkage without a real id.
          templateId = -1 * (templatesCreated + 1);
        } else {
          const created = await prisma.chitFundTemplate.create({
            data: {
              name: `Legacy — ${fund.name}`,
              description: `Auto-created from existing chit fund #${fund.id} during template migration.`,
              totalAmount: fund.totalAmount,
              monthlyContribution: fund.monthlyContribution,
              firstMonthContribution: fund.firstMonthContribution,
              duration: fund.duration,
              membersCount: fund.membersCount,
              chitFundType: fund.chitFundType || 'Auction',
              fixedAmountsPattern: buildPattern(fund) ?? undefined,
              createdById,
            },
          });
          templateId = created.id;
        }
        sigToTemplateId.set(sig, templateId);
        templatesCreated++;
      }

      if (!DRY_RUN) {
        await prisma.chitFund.update({
          where: { id: fund.id },
          data: { templateId },
        });
      }
      fundsLinked++;
    }
  }

  const after = await financialSnapshot();
  console.log('\nFinancial snapshot AFTER: ', after);

  // Verification gate: financial figures MUST be byte-identical.
  const parityOk =
    before.count === after.count &&
    before.totalAmount === after.totalAmount &&
    before.monthlyContribution === after.monthlyContribution &&
    before.duration === after.duration &&
    before.membersCount === after.membersCount;

  console.log('\n--- Summary ---');
  console.log(`Owners processed:  ${owners.length}`);
  console.log(`Templates created: ${templatesCreated}`);
  console.log(`Funds linked:      ${fundsLinked}`);
  console.log(`Funds skipped:     ${fundsSkipped} (already linked)`);
  console.log(`Financial parity:  ${parityOk ? 'OK ✅ (unchanged)' : 'FAILED ❌'}`);

  if (!parityOk) {
    throw new Error('Financial parity check FAILED — backfill must not change financial totals.');
  }
  console.log(`\nDone ${DRY_RUN ? '(dry run — no writes made)' : ''}.\n`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
