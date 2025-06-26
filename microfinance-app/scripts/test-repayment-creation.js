const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testRepaymentCreation() {
  try {
    console.log('🧪 Testing Repayment Creation...');

    // Get the first user and loan
    const user = await prisma.user.findFirst();
    if (!user) {
      console.log('❌ No user found. Please create a user first.');
      return;
    }

    const loan = await prisma.loan.findFirst({
      where: { createdById: user.id },
      include: { borrower: true }
    });

    if (!loan) {
      console.log('❌ No loan found. Please create a loan first.');
      return;
    }

    console.log(`✅ Using loan: ${loan.borrower.name} - Amount: ${loan.amount}`);

    // Get or create a partner
    let partner = await prisma.partner.findFirst({
      where: { createdById: user.id }
    });

    if (!partner) {
      partner = await prisma.partner.create({
        data: {
          name: 'Test Partner',
          code: 'TEST',
          createdById: user.id
        }
      });
      console.log('✅ Created test partner');
    } else {
      console.log(`✅ Using existing partner: ${partner.name}`);
    }

    // Test repayment creation with correct fields
    console.log('📝 Creating test repayment...');

    const repaymentData = {
      loanId: loan.id,
      amount: 500,
      paidDate: new Date(),
      paymentType: 'REGULAR',
      period: 1,
      collected_by_id: partner.id,
      entered_by_id: partner.id,
      createdById: user.id
    };

    const repayment = await prisma.repayment.create({
      data: repaymentData,
      include: {
        loan: {
          include: {
            borrower: true
          }
        },
        collectedBy: true,
        enteredBy: true
      }
    });

    console.log('✅ Repayment created successfully!');
    console.log(`   - ID: ${repayment.id}`);
    console.log(`   - Amount: $${repayment.amount}`);
    console.log(`   - Payment Date: ${repayment.paidDate.toISOString().split('T')[0]}`);
    console.log(`   - Payment Type: ${repayment.paymentType}`);
    console.log(`   - Period: ${repayment.period}`);
    console.log(`   - Collected By: ${repayment.collectedBy?.name || 'N/A'}`);
    console.log(`   - Entered By: ${repayment.enteredBy?.name || 'N/A'}`);
    console.log(`   - Loan: ${repayment.loan.borrower.name}`);

    // Test that the repayment was saved correctly
    const savedRepayment = await prisma.repayment.findUnique({
      where: { id: repayment.id },
      include: {
        loan: { include: { borrower: true } },
        collectedBy: true,
        enteredBy: true
      }
    });

    if (savedRepayment) {
      console.log('✅ Repayment verification successful!');
      console.log(`   - Verified Amount: $${savedRepayment.amount}`);
      console.log(`   - Verified Date: ${savedRepayment.paidDate.toISOString().split('T')[0]}`);
    } else {
      console.log('❌ Repayment verification failed!');
    }

    console.log('\n🎉 Repayment Creation Test Completed Successfully!');

  } catch (error) {
    console.error('❌ Error testing repayment creation:', error);
    console.error('Error details:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

testRepaymentCreation();
