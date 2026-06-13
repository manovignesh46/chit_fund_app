/**
 * One-time setup: create login accounts for each business partner.
 * Password is copied from the primary admin (same password for everyone).
 *
 * Usage: node scripts/setup-partner-logins.js
 */
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

function partnerEmail(partnerName, adminEmail) {
  const slug = partnerName.toLowerCase().replace(/[^a-z0-9]/g, '');
  const domain = adminEmail.includes('@') ? adminEmail.split('@')[1] : 'amfincorp.local';
  return `${slug}@${domain}`;
}

async function ensurePartnerLoginUsers() {
  const primaryAdmin = await prisma.user.findFirst({
    where: { role: 'admin', dataOwnerId: null },
    orderBy: { id: 'asc' },
  });

  if (!primaryAdmin) {
    throw new Error('Primary admin account not found');
  }

  const partners = await prisma.partner.findMany({
    where: { createdById: primaryAdmin.id, isActive: true },
    orderBy: { name: 'asc' },
  });

  const created = [];
  const existing = [];

  for (const partner of partners) {
    const existingUser = await prisma.user.findFirst({
      where: { partnerId: partner.id },
    });

    if (existingUser) {
      await prisma.user.update({
        where: { id: existingUser.id },
        data: { password: primaryAdmin.password },
      });
      existing.push(partner.name);
      continue;
    }

    const email = partnerEmail(partner.name, primaryAdmin.email);
    const emailTaken = await prisma.user.findUnique({ where: { email } });

    if (emailTaken) {
      await prisma.user.update({
        where: { id: emailTaken.id },
        data: {
          name: partner.name,
          role: 'partner',
          partnerId: partner.id,
          dataOwnerId: primaryAdmin.id,
          password: primaryAdmin.password,
        },
      });
      existing.push(partner.name);
      continue;
    }

    await prisma.user.create({
      data: {
        name: partner.name,
        email,
        password: primaryAdmin.password,
        role: 'partner',
        partnerId: partner.id,
        dataOwnerId: primaryAdmin.id,
      },
    });
    created.push(partner.name);
  }

  return { primaryAdmin, created, existing, partners };
}

async function main() {
  console.log('Setting up partner login accounts...\n');

  const { primaryAdmin, created, existing, partners } = await ensurePartnerLoginUsers();

  console.log('Partner login accounts:');
  for (const partner of partners) {
    const user = await prisma.user.findFirst({ where: { partnerId: partner.id } });
    console.log(`  ${partner.name} → ${user?.email} (password: same as admin)`);
  }

  if (created.length > 0) console.log(`\nCreated: ${created.join(', ')}`);
  if (existing.length > 0) console.log(`Synced: ${existing.join(', ')}`);
  console.log('\nDone! Partners select their name on the login page.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
