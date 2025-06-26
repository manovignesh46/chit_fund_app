const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testRepaymentAPI() {
  try {
    console.log('🧪 Testing Repayment API Endpoint...');

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

    console.log(`✅ Using loan: ${loan.borrower.name} - ID: ${loan.id}`);

    // Get a partner
    const partner = await prisma.partner.findFirst({
      where: { createdById: user.id }
    });

    if (!partner) {
      console.log('❌ No partner found. Please create a partner first.');
      return;
    }

    console.log(`✅ Using partner: ${partner.name} - ID: ${partner.id}`);

    // Test API call
    console.log('📝 Testing API endpoint...');

    const apiUrl = `http://localhost:3001/api/loans/consolidated?action=add-repayment&id=${loan.id}`;
    const requestData = {
      amount: 750,
      paidDate: new Date().toISOString(),
      paymentType: 'REGULAR',
      scheduleId: 2, // This maps to period
      collected_by: partner.id.toString(),
      collected_by_id: partner.id,
      entered_by_id: partner.id
    };

    console.log('Request URL:', apiUrl);
    console.log('Request Data:', JSON.stringify(requestData, null, 2));

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': user.id.toString()
      },
      body: JSON.stringify(requestData)
    });

    const responseText = await response.text();
    console.log('Response Status:', response.status);
    console.log('Response Headers:', Object.fromEntries(response.headers.entries()));
    
    if (response.ok) {
      const responseData = JSON.parse(responseText);
      console.log('✅ API call successful!');
      console.log('Response Data:', JSON.stringify(responseData, null, 2));
    } else {
      console.log('❌ API call failed!');
      console.log('Response Text:', responseText);
    }

  } catch (error) {
    console.error('❌ Error testing repayment API:', error);
    console.error('Error details:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

testRepaymentAPI();
