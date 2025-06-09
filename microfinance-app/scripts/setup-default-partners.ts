const { PrismaClient } = require('@prisma/client');
const { verify } = require('jsonwebtoken');

const prisma = new PrismaClient();

async function main() {
  try {
    console.log('Starting default partners setup...');
    
    // Get all users
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
      },
    });

    for (const user of users) {
      console.log(`Setting up default partners for user: ${user.email}`);

      // Define default partners with unique codes
      const defaultPartners = [
        { name: 'Me', code: 'SELF', isActive: true },
        { name: 'Collection Agent', code: 'AGENT', isActive: true },
      ];

      for (const partnerData of defaultPartners) {
        // Check if partner already exists for this user by code
        const existingPartner = await prisma.partner.findFirst({
          where: {
            createdById: user.id,
            OR: [
              { code: partnerData.code },
              { name: partnerData.name }
            ]
          },
        });

        if (!existingPartner) {
          // Create partner
          await prisma.partner.create({
            data: {
              ...partnerData,
              createdById: user.id,
            },
          });
          console.log(`Created partner "${partnerData.name}" for user: ${user.email}`);
        } else {
          // Update partner to ensure it's active
          await prisma.partner.update({
            where: { id: existingPartner.id },
            data: { isActive: true },
          });
          console.log(`Updated existing partner "${partnerData.name}" for user: ${user.email}`);
        }
      }
    }

    console.log('Default partners setup completed successfully.');
  } catch (error) {
    console.error('Error setting up default partners:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
