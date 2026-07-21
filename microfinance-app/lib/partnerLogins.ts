import prisma from './prisma';

function partnerEmail(partnerName: string, adminEmail: string): string {
  const slug = partnerName.toLowerCase().replace(/[^a-z0-9]/g, '');
  const domain = adminEmail.includes('@') ? adminEmail.split('@')[1] : 'amfincorp.local';
  return `${slug}@${domain}`;
}

/**
 * Ensures each active business partner has a login account linked to the primary admin.
 * New accounts start with the primary admin's password hash as a default; existing
 * accounts are left untouched so self-service or admin-set passwords stick.
 */
export async function ensurePartnerLoginUsers(): Promise<{
  primaryAdminId: number;
  created: string[];
  existing: string[];
}> {
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

  const created: string[] = [];
  const existing: string[] = [];

  for (const partner of partners) {
    const existingUser = await prisma.user.findFirst({
      where: { partnerId: partner.id },
    });

    if (existingUser) {
      // Already linked to this partner — leave their password alone so that
      // password changes (self-service or admin-set) aren't overwritten on every login.
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

  return { primaryAdminId: primaryAdmin.id, created, existing };
}

export async function findPartnerLoginUser(partnerId: number) {
  const primaryAdmin = await prisma.user.findFirst({
    where: { role: 'admin', dataOwnerId: null },
    orderBy: { id: 'asc' },
  });

  if (!primaryAdmin) return null;

  await ensurePartnerLoginUsers();

  return prisma.user.findFirst({
    where: {
      partnerId,
      dataOwnerId: primaryAdmin.id,
      role: 'partner',
    },
    include: { partner: true },
  });
}

export async function getLoginPartners() {
  const primaryAdmin = await prisma.user.findFirst({
    where: { role: 'admin', dataOwnerId: null },
    orderBy: { id: 'asc' },
  });

  if (!primaryAdmin) {
    return [];
  }

  await ensurePartnerLoginUsers();

  return prisma.partner.findMany({
    where: { createdById: primaryAdmin.id, isActive: true },
    orderBy: { name: 'asc' },
    select: { id: true, name: true, code: true },
  });
}

export async function findUserByEmailOrUsername(identifier: string) {
  const trimmed = identifier.trim();
  if (!trimmed) return null;

  await ensurePartnerLoginUsers();

  // Exact email match
  let user = await prisma.user.findUnique({
    where: { email: trimmed },
    include: { partner: { select: { id: true, name: true } } },
  });

  if (user) return user;

  const primaryAdmin = await prisma.user.findFirst({
    where: { role: 'admin', dataOwnerId: null },
    orderBy: { id: 'asc' },
  });

  if (!trimmed.includes('@') && primaryAdmin) {
    // Username → partner email e.g. "Mano" → mano@domain.com
    const guessedEmail = partnerEmail(trimmed, primaryAdmin.email);
    user = await prisma.user.findUnique({
      where: { email: guessedEmail },
      include: { partner: { select: { id: true, name: true } } },
    });
    if (user) return user;

    // Match by display name (case-insensitive)
    user = await prisma.user.findFirst({
      where: {
        name: { equals: trimmed, mode: 'insensitive' },
        role: { in: ['admin', 'partner'] },
      },
      include: { partner: { select: { id: true, name: true } } },
    });
  }

  return user;
}

export { partnerEmail };
