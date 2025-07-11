// Script to update the prisma.js file to explicitly include remainingDue in all responses

const { PrismaClient } = require('@prisma/client');

// Create a custom Prisma client with middlewares
const prisma = new PrismaClient().$extends({
  query: {
    loan: {
      async findUnique({ args, query }) {
        // Call the original query
        const result = await query(args);
        
        // Log the result to check if remainingDue is present
        console.log('Loan findUnique result:', {
          id: result?.id,
          remainingDue: result?.remainingDue,
          hasRemainingDue: result?.hasOwnProperty('remainingDue')
        });
        
        return result;
      },
      async findMany({ args, query }) {
        // Call the original query
        const result = await query(args);
        
        // Log the first result to check if remainingDue is present
        if (result && result.length > 0) {
          console.log('First loan in findMany result:', {
            id: result[0]?.id,
            remainingDue: result[0]?.remainingDue,
            hasRemainingDue: result[0]?.hasOwnProperty('remainingDue')
          });
        }
        
        return result;
      }
    }
  }
});

module.exports = prisma;
