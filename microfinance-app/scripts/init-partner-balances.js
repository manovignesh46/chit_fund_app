/**
 * Initialize PartnerBalance records for existing partners
 * Run this script after creating partners to set up their initial balances
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function initializePartnerBalances() {
  try {
    console.log('Starting partner balance initialization...');

    // Get all partners
    const partners = await prisma.partner.findMany({
      include: {
        createdBy: true,
      },
    });

    console.log(`Found ${partners.length} partners`);

    for (const partner of partners) {
      // Check if balance already exists
      const existingBalance = await prisma.partnerBalance.findUnique({
        where: {
          partnerId_createdById: {
            partnerId: partner.id,
            createdById: partner.createdById,
          },
        },
      });

      if (existingBalance) {
        console.log(`Balance already exists for partner: ${partner.name}`);
        continue;
      }

      // Create initial balance record
      await prisma.partnerBalance.create({
        data: {
          partnerId: partner.id,
          balance: 0,
          createdById: partner.createdById,
        },
      });

      console.log(`Created initial balance for partner: ${partner.name}`);
    }

    console.log('Partner balance initialization completed successfully.');
  } catch (error) {
    console.error('Error initializing partner balances:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

initializePartnerBalances();
