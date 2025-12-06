const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testBalanceCalculations() {
  console.log('🧪 Testing balance calculations...');
  
  try {
    // Get recent transactions with balance information
    const transactions = await prisma.transaction.findMany({
      orderBy: [
        { date: 'desc' },
        { createdAt: 'desc' }
      ],
      take: 10,
      select: {
        id: true,
        type: true,
        amount: true,
        date: true,
        partnerBalance: true,
        totalBalance: true,
        to_partner: true,
        from_partner: true,
        note: true
      }
    });

    console.log('\n📊 Recent transactions with balances:');
    console.log('================================================================================');
    console.log('Date       | Type              | Amount    | Partner Bal | Total Bal  | Note');
    console.log('================================================================================');
    
    transactions.forEach(t => {
      const dateStr = t.date.toISOString().split('T')[0];
      const typeStr = t.type.padEnd(17);
      const amountStr = `₹${t.amount.toLocaleString()}`.padEnd(9);
      const partnerBalStr = `₹${(t.partnerBalance || 0).toLocaleString()}`.padEnd(11);
      const totalBalStr = `₹${(t.totalBalance || 0).toLocaleString()}`.padEnd(10);
      const noteStr = (t.note || '').substring(0, 30);
      
      console.log(`${dateStr} | ${typeStr} | ${amountStr} | ${partnerBalStr} | ${totalBalStr} | ${noteStr}`);
    });

    console.log('================================================================================');

    // Get current partner balances
    const partners = await prisma.partner.findMany({
      select: { id: true, name: true }
    });

    console.log('\n👥 Current partner balances:');
    for (const partner of partners) {
      const lastTransaction = await prisma.transaction.findFirst({
        where: {
          OR: [
            { from_partner_id: partner.id },
            { to_partner_id: partner.id }
          ],
          partnerBalance: { not: null }
        },
        orderBy: [
          { date: 'desc' },
          { createdAt: 'desc' }
        ],
        select: { partnerBalance: true }
      });

      const balance = lastTransaction?.partnerBalance || 0;
      console.log(`  ${partner.name}: ₹${balance.toLocaleString()}`);
    }

    // Get current total balance
    const lastTransaction = await prisma.transaction.findFirst({
      orderBy: [
        { date: 'desc' },
        { createdAt: 'desc' }
      ],
      select: { totalBalance: true }
    });

    const totalBalance = lastTransaction?.totalBalance || 0;
    console.log(`\n💰 Current total balance: ₹${totalBalance.toLocaleString()}`);

    console.log('\n✅ Balance calculation test completed successfully!');

  } catch (error) {
    console.error('❌ Error during balance calculation test:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testBalanceCalculations();
