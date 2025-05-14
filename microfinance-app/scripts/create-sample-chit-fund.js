// Script to create a sample chit fund
const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

const prisma = new PrismaClient();

async function main() {
  try {
    console.log('Starting sample chit fund creation...');

    // Get the admin user
    const adminUser = await prisma.user.findFirst({
      where: { role: 'admin' },
    });

    if (!adminUser) {
      throw new Error('Admin user not found. Please run setup-admin.js first.');
    }

    console.log(`Found admin user with ID: ${adminUser.id}`);

    // Create a sample chit fund
    const startDate = new Date();

    const chitFund = await prisma.chitFund.create({
      data: {
        name: 'Sample Chit Fund',
        startDate,
        monthlyContribution: 5000,
        totalAmount: 50000,
        duration: 10,
        currentMonth: 1,
        status: 'Active',
        membersCount: 0,
        description: 'This is a sample chit fund created for testing.',
        createdBy: {
          connect: { id: adminUser.id }
        }
      },
    });

    console.log('Sample chit fund created successfully:', chitFund);

    // Create a sample global member
    const globalMember = await prisma.globalMember.findFirst();

    if (!globalMember) {
      console.log('Creating a sample global member...');

      const newGlobalMember = await prisma.globalMember.create({
        data: {
          name: 'John Doe',
          contact: '1234567890',
          address: '123 Main St',
          email: 'john.doe@example.com',
          createdBy: {
            connect: { id: adminUser.id }
          }
        },
      });

      console.log('Sample global member created successfully:', newGlobalMember);

      // Add the global member to the chit fund
      const chitFundMember = await prisma.Member.create({
        data: {
          chitFundId: chitFund.id,
          globalMemberId: newGlobalMember.id,
          auctionWon: false,
          contribution: chitFund.monthlyContribution,
        },
      });

      console.log('Added member to chit fund successfully:', chitFundMember);

      // Update the members count in the chit fund
      await prisma.chitFund.update({
        where: { id: chitFund.id },
        data: { membersCount: 1 },
      });
    } else {
      console.log('Using existing global member:', globalMember);

      // Check if the member is already in the chit fund
      const existingMember = await prisma.Member.findFirst({
        where: {
          chitFundId: chitFund.id,
          globalMemberId: globalMember.id,
        },
      });

      if (!existingMember) {
        // Add the global member to the chit fund
        const chitFundMember = await prisma.Member.create({
          data: {
            chitFundId: chitFund.id,
            globalMemberId: globalMember.id,
            auctionWon: false,
            contribution: chitFund.monthlyContribution,
          },
        });

        console.log('Added member to chit fund successfully:', chitFundMember);

        // Update the members count in the chit fund
        await prisma.chitFund.update({
          where: { id: chitFund.id },
          data: { membersCount: 1 },
        });
      } else {
        console.log('Member is already in the chit fund:', existingMember);
      }
    }

    console.log(`Sample chit fund created with ID: ${chitFund.id}`);
    console.log(`You can now access it at: /chit-funds/${chitFund.id}`);
  } catch (error) {
    console.error('Error creating sample chit fund:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main()
  .then(() => {
    console.log('Sample chit fund creation completed successfully.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Unhandled error during sample creation:', error);
    process.exit(1);
  });
