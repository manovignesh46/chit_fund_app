import prisma from './prisma';

export interface TransactionWhereClause {
  createdById: number;
  [key: string]: any;
}

export async function buildTransactionWhereClause(
  currentUserId: number,
  filters: {
    partner?: string;
    type?: string;
    member?: string;
    startDate?: string;
    endDate?: string;
    advType?: string;
    advMember?: string;
    advEntity?: string;
    advSubType?: string;
  }
): Promise<TransactionWhereClause> {
  const where: TransactionWhereClause = {
    createdById: currentUserId
  };

  const {
    partner,
    type,
    member,
    startDate,
    endDate,
    advType,
    advMember,
    advEntity,
    advSubType
  } = filters;

  // Advanced filter logic: apply each filter independently
  if (advType) {
    if (advType === 'loan') {
      // Build loan filter conditions
      const loanConditions: any = {};
      
      // Filter by loan types
      if (advSubType === 'disbursement') {
        loanConditions.type = { in: ['LOAN_DISBURSEMENT'] };
      } else if (advSubType === 'repayment') {
        loanConditions.type = { in: ['LOAN_REPAYMENT'] };
      } else {
        // No specific subtype - show disbursement, repayment, and document charges
        loanConditions.type = { in: ['LOAN_DISBURSEMENT', 'LOAN_REPAYMENT', 'DOCUMENT_CHARGE'] };
      }
      
      // Filter by specific loan entity if provided
      if (advEntity) {
        const loanId = parseInt(advEntity);
        
        // For loan-related transactions, we need to check:
        // 1. Direct loan relation (for disbursements)
        // 2. Repayment relation where repayment belongs to the loan (for repayments)
        loanConditions.OR = [
          { loan: { id: loanId } }, // Direct loan relation (disbursements)
          { repayment: { loanId: loanId } } // Repayment relation (repayments)
        ];
        
        // If filtering by specific subtype, adjust the OR conditions
        if (advSubType === 'disbursement') {
          loanConditions.OR = [{ loan: { id: loanId } }];
        } else if (advSubType === 'repayment') {
          loanConditions.OR = [{ repayment: { loanId: loanId } }];
        }
      }
      
      // Filter by member name in note if advMember is set
      if (advMember) {
        // Look up member name by ID (via Member -> GlobalMember)
        const memberId = parseInt(advMember);
        const member = await prisma.globalMember.findUnique({
          where: { id: memberId },
        });
        const memberName = member?.name;
        if (memberName) {
          loanConditions.note = {
            contains: memberName,
            mode: 'insensitive',
          };
        } else {
          // If member not found, filter by impossible string
          loanConditions.note = { contains: '__NO_MATCH__' };
        }
      }
      
      // Apply all loan conditions to where clause
      Object.assign(where, loanConditions);
      
    } else if (advType === 'chit') {
      // Only show chit-related transactions
      where.OR = [
        { type: { in: ['CHIT_CONTRIBUTION', 'AUCTION_PAYOUT'] } },
        { contribution: { is: { } } },
        { auction: { is: { } } }
      ];
      
      // Always filter by member if advMember is set
      if (advMember) {
        const memberId = parseInt(advMember);
        if (advSubType === 'auction') {
          // Only auction transactions for this member and chit fund
          if (advEntity) {
            where.auction = { 
              chitFundId: parseInt(advEntity), 
              winner: { globalMemberId: memberId } 
            };
            where.type = { in: ['AUCTION_PAYOUT'] };
          } else {
            where.auction = { 
              winner: { globalMemberId: memberId } 
            };
            where.type = { in: ['AUCTION_PAYOUT'] };
          }
        } else if (advSubType === 'contribution') {
          // Only contribution transactions for this member and chit fund
          if (advEntity) {
            where.contribution = { 
              chitFundId: parseInt(advEntity), 
              member: { globalMemberId: memberId } 
            };
            where.type = { in: ['CHIT_CONTRIBUTION'] };
          } else {
            where.contribution = { 
              member: { globalMemberId: memberId } 
            };
            where.type = { in: ['CHIT_CONTRIBUTION'] };
          }
        } else {
          // Show all chit transactions for this member
          where.OR = [
            { 
              contribution: { member: { globalMemberId: memberId } },
              type: { in: ['CHIT_CONTRIBUTION'] }
            },
            { 
              auction: { winner: { globalMemberId: memberId } },
              type: { in: ['AUCTION_PAYOUT'] }
            }
          ];
          
          if (advEntity) {
            // Filter by specific chit fund
            const chitFundId = parseInt(advEntity);
            where.OR = [
              { 
                contribution: { 
                  chitFundId: chitFundId,
                  member: { globalMemberId: memberId } 
                },
                type: { in: ['CHIT_CONTRIBUTION'] }
              },
              { 
                auction: { 
                  chitFundId: chitFundId,
                  winner: { globalMemberId: memberId } 
                },
                type: { in: ['AUCTION_PAYOUT'] }
              }
            ];
          }
        }
      } else if (advEntity) {
        // Filter by specific chit fund without member
        const chitFundId = parseInt(advEntity);
        if (advSubType === 'auction') {
          where.auction = { chitFundId: chitFundId };
          where.type = { in: ['AUCTION_PAYOUT'] };
        } else if (advSubType === 'contribution') {
          where.contribution = { chitFundId: chitFundId };
          where.type = { in: ['CHIT_CONTRIBUTION'] };
        } else {
          where.OR = [
            { 
              contribution: { chitFundId: chitFundId },
              type: { in: ['CHIT_CONTRIBUTION'] }
            },
            { 
              auction: { chitFundId: chitFundId },
              type: { in: ['AUCTION_PAYOUT'] }
            }
          ];
        }
      }
    }
  } else if (advMember) {
    // Advanced member filter without type selected
    // Show all transactions related to this member across loans and chit funds
    const memberId = parseInt(advMember);
    const member = await prisma.globalMember.findUnique({
      where: { id: memberId },
    });
    const memberName = member?.name;
    
    if (memberName) {
      where.OR = [
        // Loan transactions (disbursements and repayments) - check note contains member name
        {
          AND: [
            { type: { in: ['LOAN_DISBURSEMENT', 'LOAN_REPAYMENT'] } },
            { note: { contains: memberName, mode: 'insensitive' } }
          ]
        },
        // Document charge transactions - check note contains member name
        {
          AND: [
            { type: 'DOCUMENT_CHARGE' },
            { note: { contains: memberName, mode: 'insensitive' } }
          ]
        },
        // Chit contribution transactions
        {
          contribution: { member: { globalMemberId: memberId } },
          type: { in: ['CHIT_CONTRIBUTION'] }
        },
        // Chit auction transactions
        {
          auction: { winner: { globalMemberId: memberId } },
          type: { in: ['AUCTION_PAYOUT'] }
        }
      ];
    } else {
      // If member not found, return no results
      where.id = -1;
    }
  } else {
    // Basic filters (when not using advanced filters)
    
    // Filter by transaction type
    if (type) {
      where.type = type;
    }

    // Filter by member name (Improved: search in relations + note fallback)
    if (member) {
      where.OR = [
          // 1. Check Note (Legacy/Fallback)
          { note: { contains: member, mode: 'insensitive' } },
          // 2. Check Linked Loan Borrower (Disbursements)
          { loan: { borrower: { name: { contains: member, mode: 'insensitive' } } } },
          // 3. Check Linked Repayment Borrower (Repayments)
          { repayment: { loan: { borrower: { name: { contains: member, mode: 'insensitive' } } } } },
          // 4. Check Linked Chit Member (Contributions)
          { contribution: { member: { globalMember: { name: { contains: member, mode: 'insensitive' } } } } },
          // 5. Check Linked Auction Winner (Payouts)
          { auction: { winner: { globalMember: { name: { contains: member, mode: 'insensitive' } } } } }
      ];
    }
  }

  // Filter by partner
  if (partner && partner !== 'ALL') {
    // New Schema: Filter by relation to Partner model via partnerId
    // We check if the transaction is linked to a partner with the given name.
    where.partner = { name: partner };
    
    // Note: We used to use OR for from/to partner, but now we have a direct relation.
    // Using direct property avoids overwriting any 'OR' clause set by advanced filters.
  }

  // Filter by date range
  if (startDate || endDate) {
    where.date = {};
    if (startDate) {
      where.date.gte = new Date(startDate);
    }
    if (endDate) {
      where.date.lte = new Date(endDate + 'T23:59:59.999Z');
    }
  }

  return where;
}
