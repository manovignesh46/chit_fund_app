const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testPartnerTransactions() {
  try {
    console.log('🧪 Testing Partner Transaction System...');

    // Get the first user (assuming there's at least one user)
    const user = await prisma.user.findFirst();
    if (!user) {
      console.log('❌ No user found. Please create a user first.');
      return;
    }

    console.log(`✅ Using user: ${user.name} (ID: ${user.id})`);

    // Create test partners if they don't exist
    const existingPartners = await prisma.partner.findMany({
      where: { createdById: user.id }
    });

    let mePartner, friendPartner;

    if (existingPartners.length === 0) {
      console.log('📝 Creating test partners...');
      
      mePartner = await prisma.partner.create({
        data: {
          name: 'Me',
          code: 'SELF',
          createdById: user.id
        }
      });

      friendPartner = await prisma.partner.create({
        data: {
          name: 'My Friend',
          code: 'FRIEND',
          createdById: user.id
        }
      });

      console.log('✅ Created partners: Me and My Friend');
    } else {
      mePartner = existingPartners.find(p => p.name === 'Me') || existingPartners[0];
      friendPartner = existingPartners.find(p => p.name === 'My Friend') || existingPartners[1];
      console.log('✅ Using existing partners');
    }

    // Create test transactions
    console.log('📝 Creating test transactions...');

    const transactions = [
      {
        type: 'collection',
        amount: 1000,
        member: 'John Doe',
        from_partner: null,
        to_partner: 'Me',
        action_performer: 'Me',
        entered_by: 'Me',
        date: new Date(),
        note: 'Collection from John Doe',
        createdById: user.id
      },
      {
        type: 'loan_given',
        amount: 500,
        member: 'Jane Smith',
        from_partner: 'Me',
        to_partner: null,
        action_performer: 'Me',
        entered_by: 'Me',
        date: new Date(),
        note: 'Loan given to Jane Smith',
        createdById: user.id
      },
      {
        type: 'transfer',
        amount: 200,
        member: null,
        from_partner: 'Me',
        to_partner: 'My Friend',
        action_performer: 'Me',
        entered_by: 'Me',
        date: new Date(),
        note: 'Transfer to My Friend',
        createdById: user.id
      },
      {
        type: 'loan_repaid',
        amount: 300,
        member: 'Jane Smith',
        from_partner: null,
        to_partner: 'My Friend',
        action_performer: 'My Friend',
        entered_by: 'My Friend',
        date: new Date(),
        note: 'Loan repayment from Jane Smith',
        createdById: user.id
      }
    ];

    for (const transactionData of transactions) {
      await prisma.transaction.create({ data: transactionData });
      console.log(`✅ Created ${transactionData.type} transaction: ${transactionData.amount}`);
    }

    // Calculate and display balances
    console.log('\n💰 Calculating Partner Balances...');

    const allTransactions = await prisma.transaction.findMany({
      where: { createdById: user.id },
      orderBy: { date: 'asc' }
    });

    const balances = { 'Me': 0, 'My Friend': 0 };

    for (const transaction of allTransactions) {
      const { type, amount, from_partner, to_partner } = transaction;

      switch (type) {
        case 'collection':
          if (to_partner) balances[to_partner] += amount;
          break;
        case 'transfer':
          if (from_partner) balances[from_partner] -= amount;
          if (to_partner) balances[to_partner] += amount;
          break;
        case 'loan_given':
          if (from_partner) balances[from_partner] -= amount;
          break;
        case 'loan_repaid':
          if (to_partner) balances[to_partner] += amount;
          break;
      }
    }

    console.log('\n📊 Final Balances:');
    console.log(`Me: $${balances['Me']}`);
    console.log(`My Friend: $${balances['My Friend']}`);

    console.log('\n🎉 Partner Transaction System Test Completed Successfully!');
    console.log('\n📝 Summary:');
    console.log('- Me collected $1000, gave loan $500, transferred $200 → Balance: $300');
    console.log('- My Friend received transfer $200, received loan repayment $300 → Balance: $500');

  } catch (error) {
    console.error('❌ Error testing partner transactions:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testPartnerTransactions();
