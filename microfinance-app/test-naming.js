// Test script to demonstrate the new dynamic naming for transaction exports
const { generateTransactionExportName } = require('./lib/transactionExportNameGenerator');

console.log('Testing Transaction Export Dynamic Naming\n');

// Example data
const partnerNames = {
  '1': 'John Smith',
  '2': 'Sarah Johnson',
  '3': 'Mike Wilson'
};

const memberNames = {
  '1': 'Alice Brown',
  '2': 'Bob Davis',
  '3': 'Carol White'
};

// Test various filter combinations
const testCases = [
  {
    description: 'All transactions with date range',
    filters: {
      startDate: '2025-06-01',
      endDate: '2025-06-30'
    }
  },
  {
    description: 'Partner-specific transactions',
    filters: {
      partner: '1',
      startDate: '2025-06-01',
      endDate: '2025-06-30'
    }
  },
  {
    description: 'Loan disbursements for specific member',
    filters: {
      advType: 'loan',
      advSubType: 'disbursement',
      advMember: '1',
      startDate: '2025-06-01',
      endDate: '2025-06-30'
    }
  },
  {
    description: 'Chit fund contributions for specific member',
    filters: {
      advType: 'chit',
      advSubType: 'contribution',
      advMember: '2',
      partner: '2'
    }
  },
  {
    description: 'All loan transactions',
    filters: {
      advType: 'loan'
    }
  },
  {
    description: 'Single day transactions',
    filters: {
      startDate: '2025-06-30',
      endDate: '2025-06-30'
    }
  },
  {
    description: 'Member search with basic filter',
    filters: {
      member: 'Alice Brown',
      type: 'LOAN_REPAYMENT'
    }
  }
];

testCases.forEach((testCase, index) => {
  console.log(`${index + 1}. ${testCase.description}:`);
  const result = generateTransactionExportName(testCase.filters, partnerNames, memberNames);
  console.log(`   Subject: "${result.subject}"`);
  console.log(`   Filename: "${result.filename}"`);
  console.log(`   Description: "${result.description}"`);
  console.log('');
});

console.log('Dynamic naming examples completed!');
