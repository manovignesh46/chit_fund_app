// Script to create a test partner
// Run with: node scripts/create-test-partner.js

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    console.log('Creating test partner...');

    // First check if user with ID 1 exists
    let user = await prisma.user.findUnique({
      where: { id: 1 }
    });

    if (!user) {
      // Create a test user if none exists
      user = await prisma.user.create({
        data: {
          id: 1,
          name: 'Test Admin',
          email: 'admin@test.com',
          password: '$2a$10$iqJSHD.BGr0E2IxQwYgJmeP3NvhPrXAeLSaGCj6IR/XU5QtjVu5Tm', // 'secret'
          role: 'admin'
        }
      });
      console.log('Created test user:', user.name);
    }

    // Create a test partner
    const partner = await prisma.partner.create({
      data: {
        name: 'Test Partner',
        code: 'TP001',
        isActive: true,
        createdBy: {
          connect: { id: user.id }
        }
      }
    });

    console.log('Created test partner:', partner.name);

    return partner;
  } catch (error) {
    console.error('Error creating test partner:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main()
  .catch((error) => {
    console.error('Error in main function:', error);
    process.exit(1);
  });
