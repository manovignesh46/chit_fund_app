# Chitfund Template System — E2E Plan & Implementation Status

> **Update:** Phase 1 of this plan is already implemented and staged in this repo
> (`schema.prisma`, `app/api/chit-fund-templates/consolidated/route.ts`,
> `app/chit-fund-templates/*`, `scripts/backfill-chit-fund-templates.ts`). This document
> has been rewritten to describe what was actually built, not a hypothetical design — the
> first draft proposed a version-history table (`ChitFundTemplateVersion`) that the shipped
> code does not use. The simpler design below is what's real, and it still satisfies the
> "zero negative impact" requirement. Section 7 covers what's genuinely still open.

Grounded in the actual codebase (`microfinance-app/prisma/schema.prisma`,
`app/api/chit-funds/consolidated/route.ts`, `app/chit-funds/new/page.tsx`). Three facts from
the real system shaped the design:

- **`commissionRate` isn't a stored field.** Commission is derived at read-time:
  `(monthlyContribution × membersCount) − auction.amount` (`monthly-profit/route.ts:52`).
  There's no min/max bid enforcement anywhere.
- **"Dividend distribution" doesn't exist in the codebase.** The organizer keeps the full
  auction discount as profit; nothing redistributes it to members.
- **There was already a proto-template feature**: `/chit-funds/new?copy=<id>` fetched an
  existing fund's core fields and pre-filled the create form. The template system formalizes
  this exact pattern.

Two chit fund types exist and are both supported: `Auction` (bid-determined payout) and
`Fixed` (pre-set per-month amounts).

---

## 1. Database Schema Design (as implemented)

### Before

```
ChitFund
  id, name, totalAmount, monthlyContribution, firstMonthContribution?,
  duration, membersCount, status, startDate, currentMonth, nextAuctionDate?,
  chitFundType ("Auction"|"Fixed"), createdById → User
  ├── ChitFundFixedAmount[]   (month, amount) — only for chitFundType="Fixed"
  ├── Member[] → GlobalMember / Contribution[] / Auction[] / AuctionBooking[]
```

### After

```prisma
model ChitFundTemplate {
  id                     Int      @id @default(autoincrement())
  name                   String
  description            String?
  totalAmount            Float
  monthlyContribution    Float
  firstMonthContribution Float?
  duration               Int
  membersCount           Int
  chitFundType           String   @default("Auction") // "Auction" | "Fixed"
  fixedAmountsPattern    Json?    // { "1": 40000, "2": 45000, ... } — Fixed type only
  isArchived             Boolean  @default(false)
  createdById            Int
  createdAt              DateTime @default(now())
  updatedAt              DateTime @updatedAt

  createdBy              User       @relation(fields: [createdById], references: [id])
  chitFunds              ChitFund[]

  @@index([createdById])
}

model ChitFund {
  // ...all existing fields, unchanged...
  templateId Int?
  template   ChitFundTemplate? @relation(fields: [templateId], references: [id])

  @@index([templateId])
}
```

That's the entire schema delta: one new table + one new nullable FK column. No existing
column was renamed, retyped, or dropped.

### Versioning & immutability — how "edit while active" is actually handled

There is **no version-history table**. A template is a single mutable row; editing it
(`updateTemplate` in `chit-fund-templates/consolidated/route.ts:216`) updates that row in
place. This is safe *only* because of one structural fact, and it's worth being explicit
about why:

- `ChitFund` carries its **own physical columns** for every structural value
  (`totalAmount`, `duration`, `membersCount`, etc.) — copied once at creation time.
  `ChitFund.templateId` is a **provenance pointer only**; nothing in the auction,
  contribution, or transaction logic ever joins back through `Template → live values`.
- Consequence: editing a template **cannot** retroactively change any already-instantiated
  ChitFund, active or completed — there's no version to pin because there's nothing
  downstream that re-reads the template after instantiation. The `[id]/edit` page even
  states this directly to the admin: *"N chit fund(s) were created from this template.
  Editing it will not affect them — each fund keeps the values it was created with."*
- Trade-off vs. a versioned design: there's no historical record of *which exact values* a
  given fund's template had at the moment of instantiation if the template is later edited
  (e.g., "was this fund's 1,200,000 total the template's original value, or did month 3's
  edit already happen?"). For an audit trail that survives template edits, `ChitFund` would
  need its own snapshot of the values it copied — which it already has, since those are its
  physical columns. So in practice, the fund's own row *is* the audit record; only the
  *template's edit history itself* (what changed, when) is not tracked. This is an
  acceptable trade-off for Phase 1 and can be added later without another schema migration
  on `ChitFund` (see §7).
- Deletion is two-tier: soft-archive by default (`isArchived = true`, always safe), and a
  hard delete is blocked with a 409 if any `ChitFund.templateId` still references it
  (`deleteTemplate` in `consolidated/route.ts:265`).

---

## 2. Data Migration & Integrity Strategy (as implemented)

**Approach: Snapshot, not Reference** — confirmed above. Because `ChitFund` never depends on
`Template` at read time, the migration is purely additive.

### Migration (`prisma/migrations/20260713_add_chit_fund_templates/migration.sql`)

```sql
CREATE TABLE "ChitFundTemplate" ( ... );
CREATE INDEX "ChitFundTemplate_createdById_idx" ON "ChitFundTemplate"("createdById");

-- AlterTable (additive, nullable — no lock risk on existing rows)
ALTER TABLE "ChitFund" ADD COLUMN "templateId" INTEGER;
CREATE INDEX "ChitFund_templateId_idx" ON "ChitFund"("templateId");

ALTER TABLE "ChitFundTemplate" ADD CONSTRAINT "ChitFundTemplate_createdById_fkey" ...;
ALTER TABLE "ChitFund" ADD CONSTRAINT "ChitFund_templateId_fkey" ... ON DELETE SET NULL;
```

Notice `ON DELETE SET NULL` on the `ChitFund.templateId` FK — even a hard-deleted template
(bypassing the app-level 409 guard, e.g. via a direct DB operation) can't cascade-delete or
corrupt a `ChitFund` row; the link just goes to NULL and the fund displays as "Custom
(Legacy)."

### Backfill (`scripts/backfill-chit-fund-templates.ts`)

- Groups existing `ChitFund` rows **per `createdById`** (matching the existing ownership
  model — see §3 note on scoping) by a structural signature: a JSON-stringified tuple of
  `(totalAmount, monthlyContribution, firstMonthContribution, duration, membersCount,
  chitFundType, sorted fixedAmounts)`.
- For each distinct signature, finds-or-creates one `ChitFundTemplate`
  (`name = "Legacy — <fund name>"`), then sets `templateId` on every matching fund.
- **Idempotent by construction**: funds that already have a `templateId` are skipped
  outright; templates are matched by recomputed signature before creating a new one, so
  re-running the script never produces duplicates.
- **Built-in safety gate**: takes a financial snapshot (`count`, `SUM(totalAmount)`,
  `SUM(monthlyContribution)`, `SUM(duration)`, `SUM(membersCount)`) before and after, and
  **throws** if they don't match exactly — since the script only ever writes the nullable
  `templateId` column, this can only fail if there's a bug in the script itself, and the
  throw stops it from being silently trusted.
- Supports `--dry-run` (reports what it would do, using negative placeholder IDs, without
  writing).

### Rollback

Because the migration only adds nullable columns and one new table: **rollback = drop
`ChitFundTemplate` + drop `ChitFund.templateId`.** No data loss is possible because no
pre-existing column was ever mutated. The `ON DELETE SET NULL` FK means even a partial
rollback (dropping the table before the column) degrades gracefully instead of failing.

---

## 3. Backend API (as implemented)

All template endpoints live in one consolidated route
(`app/api/chit-fund-templates/consolidated/route.ts`), mirroring the existing
`chit-funds/consolidated/route.ts` pattern:

| Method | `?action=` | Purpose |
|---|---|---|
| GET | `list` | List templates (`createdById`-scoped), `includeArchived` optional, includes `_count.chitFunds` |
| GET | `detail&id=` | Single template detail incl. `_count.chitFunds` |
| POST | `create` | Create template |
| PUT | `update&id=` | Edit — supports `metadataOnly: true` (name/description/archive, skips structural validation) or a full structural edit |
| DELETE | `delete&id=` | Soft-archive by default; `&hard=true` attempts permanent delete, 409 if `_count.chitFunds > 0` |

**Scoping note:** templates are scoped by `createdById` only, not by an org-wide
`dataOwnerId`. This matches the existing `ChitFund` ownership model exactly (`ChitFund` is
also `createdById`-scoped, e.g. the permission check in `addAuction`:
`chitFund.createdById !== currentUserId`) — so this is consistent with the app's existing
convention, not a gap.

**Modified endpoint:** `POST /api/chit-funds/consolidated?action=create`
(`consolidated/route.ts:774`) now accepts optional `templateId`. The server validates the
template exists and belongs to the caller, then persists `templateId` on the new `ChitFund`
row (`consolidated/route.ts:809-843`) — a one-time provenance stamp, nothing more.
`?action=detail` now also returns `template: { id, name }` for the provenance label.

---

## 4. Chit Fund Lifecycle Mapping

```
ChitFundTemplate (single mutable row) ──[instantiate: one-time copy]──▶ ChitFund (physical columns)
                                                                             │
                                              ┌──────────────────────────────┼───────────────────────────┐
                                              ▼                              ▼                           ▼
                                         Contributions                   Auctions                  Transactions
                                  (reads ChitFund.monthlyContribution /  (reads ChitFund.chitFundType —  (ledger entries,
                                   Member.contribution — unchanged)       unaffected by templates)        unaffected)
```

- **Instantiation:** one-time copy of `totalAmount`, `monthlyContribution`,
  `firstMonthContribution`, `duration`, `membersCount`, `chitFundType`, and
  `fixedAmountsPattern` → `ChitFundFixedAmount` rows. After this, `Template` is out of the
  picture entirely for that fund.
- **UI enforces consistency at creation time, not the database:** once a template is
  selected in the creation wizard, the structural fields render `readOnly`/`disabled` (a
  stronger guarantee than allowing free edits with an overrides diff, at the cost of
  flexibility) — see `chit-funds/new/page.tsx`. Picking "Blank" clears `linkedTemplateId`
  and unlocks the fields, at which point the fund is created with `templateId: undefined`
  and behaves exactly like a legacy custom fund.
- **Auctions/Contributions:** completely unchanged — both read only `ChitFund`'s own
  physical columns, never the template.
- **Commission:** still computed exactly as before, `pot − auction.amount`
  (`monthly-profit/route.ts:52`). Not modeled by templates at all yet (see §7).
- **Dividend distribution:** still doesn't exist. Not modeled by templates (see §7).

---

## 5. Frontend/UI Flow (as implemented)

- **`/chit-fund-templates`** — list (name, type badge, total, duration, members, "used by N
  chit fund(s)", actions: Create fund / Edit / Archive).
- **`/chit-fund-templates/new`** and **`/chit-fund-templates/[id]/edit`** — share one
  `TemplateForm` component (mirrors the manual chit-fund-creation form fields exactly, minus
  instance-only fields like `startDate`/`status`). The edit page shows the
  "N chit funds were created from this template — editing it will not affect them" banner
  whenever `_count.chitFunds > 0`.
- **`/chit-fund-templates/[id]`** — read-only detail view, including the fixed-amounts
  breakdown by month for `Fixed` type templates.
- **`/chit-funds/new`** — gained an on-page "Start from Template" dropdown (hidden when in
  `?copy=` mode) plus deep-link support via `?template=<id>`. Selecting a template locks the
  structural fields (visually greyed, `readOnly`/`disabled`) and shows a blue banner
  clarifying that amounts must be changed on the template, not the instance. The existing
  "Copy an existing fund" flow (`?copy=<id>`) is untouched and still available separately.
- **Sidebar** gained a "Chit Fund Templates" nav entry; the chit-funds list page gained a
  "Templates" button next to "Add Chit Fund".

---

## 6. Testing & QA — status and remaining work

Already provable from the code as written:
- Financial-parity gate in the backfill script (throws on mismatch) — covers migration
  integrity.
- Idempotent backfill (skip-if-linked + signature-dedup) — covers re-run safety.
- Hard-delete 409 guard — covers orphaning prevention.
- `ON DELETE SET NULL` — covers referential integrity even under a raw DB delete.

Not yet exercised by any visible test in this diff (recommend adding before merging):
1. **Template edited after instantiation** — create a fund from a template, edit the
   template's `totalAmount`, assert the fund's own `totalAmount`/downstream
   contributions/commission are unchanged. This is the single most important regression
   test for the "zero negative impact" claim and should be an automated test, not just the
   backfill script's runtime assertion.
2. **Race: template list loaded vs. template edited before submit** — the wizard fetches
   template detail into local state (`applyTemplate`); if an admin edits the template in
   another tab between load and submit, the fund is created with whatever `templateId` was
   stamped, but the *fields* the user sees/submits were fetched at `applyTemplate` time, not
   re-validated at submit. Low risk (single-admin usage pattern per `createdById` scoping),
   but worth a test to confirm which values actually land in the created `ChitFund`.
3. **Fixed-type round-trip** — template → instantiate → confirm `ChitFundFixedAmount` rows
   match `fixedAmountsPattern` exactly, including sort order and month coverage.
4. **Legacy funds** (`templateId IS NULL`) — confirm "Custom (Legacy)" label and unchanged
   behavior everywhere.
5. **Backfill dry-run vs. apply parity** — run `--dry-run`, then apply, and confirm the
   dry-run's reported counts match what actually got created/linked.
6. **DELETE-with-body**: `chitFundTemplateAPI.delete` sends a JSON body (`{}`) on an HTTP
   DELETE request. Next.js accepts this, but it's worth a quick check under whatever hosting
   proxy/CDN sits in front of production — some strip DELETE bodies. Low severity; only
   matters if that body ever carries real data (it doesn't, currently).

---

## 7. What's genuinely still open (not built, not scheduled)

The original ask also named **commission rates, auction frequency, bidding limits, and
dividend distribution** as things the template should govern. None of these exist in the
shipped schema or logic — this build deliberately scoped to the four fields that already
had a real, working manual-entry equivalent (`totalAmount`, `duration`, `membersCount`,
`monthlyContribution`/`chitFundType`/`fixedAmountsPattern`). Recommended as a separate,
explicitly-scoped follow-up, since each one changes real money computation:

- **Commission model**: today's `pot − auction.amount` formula would need a new
  `commissionModel`/`commissionValue` concept on both `ChitFundTemplate` and `ChitFund` (nullable, default = current formula) plus a change to `monthly-profit/route.ts`.
- **Auction frequency / bid limits**: `addAuction()` (`consolidated/route.ts:1102`) has zero
  validation today beyond "can't win twice." Adding `minBidPercent`/`maxBidPercent`/
  `auctionFrequencyDays` means new nullable columns on `ChitFund` (copied from the template
  at instantiation, same pattern as everything else here) and one new guarded branch in
  `addAuction()` — null-safe by construction so existing funds are unaffected.
- **Dividend distribution**: doesn't exist at all today, not even for manually-created
  funds. This is a net-new feature, not a template-mapping gap, and deserves its own design
  and sign-off before any schema work.
- **Version history** (optional, lower priority): if an audit trail of template edits
  becomes valuable later, add a `ChitFundTemplateVersion` table exactly as originally
  proposed — it can be layered in without touching `ChitFund` again, since `ChitFund` already
  stores its own complete snapshot independent of any version mechanism.
