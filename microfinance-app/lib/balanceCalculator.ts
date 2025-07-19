const prisma = require('./prisma').default;

export interface BalanceCalculation {
  partnerBalance: number;
  totalBalance: number;
}

/**
 * Calculate the balance impact of a transaction for a specific partner
 * @param transaction Transaction details
 * @param affectedPartnerId The partner ID whose balance we're calculating
 * @param currentPartnerBalance Current balance for the affected partner
 * @param currentTotalBalance Current total balance across all partners
 * @returns Updated balance values
 */
export function calculateTransactionBalance(
  transaction: {
    type: string;
    amount: number;
    from_partner_id?: number | null;
    to_partner_id?: number | null;
  },
  affectedPartnerId: number | null,
  currentPartnerBalance: number = 0,
  currentTotalBalance: number = 0
): BalanceCalculation {
  let partnerBalanceChange = 0;
  let totalBalanceChange = 0;

  switch (transaction.type) {
    case 'collection':
      // Money collected (inflow) - increases both partner and total balance
      // Only affects the collecting partner (to_partner_id)
      if (affectedPartnerId === transaction.to_partner_id) {
        partnerBalanceChange = transaction.amount;
      }
      totalBalanceChange = transaction.amount;
      break;

    case 'expense':
      // Money spent (outflow) - decreases both partner and total balance
      // Only affects the spending partner (from_partner_id)
      if (affectedPartnerId === transaction.from_partner_id) {
        partnerBalanceChange = -transaction.amount;
      }
      totalBalanceChange = -transaction.amount;
      break;

    case 'transfer':
    case 'PARTNER_TO_PARTNER':
      // Partner-to-partner transfer - affects individual partner balances but not total
      if (affectedPartnerId === transaction.to_partner_id) {
        partnerBalanceChange = transaction.amount; // Receiving partner gets positive
      } else if (affectedPartnerId === transaction.from_partner_id) {
        partnerBalanceChange = -transaction.amount; // Sending partner gets negative
      }
      totalBalanceChange = 0; // Total balance remains unchanged for transfers
      break;

    case 'balance_adjustment':
      // Manual balance adjustment
      // Only affects the target partner (to_partner_id)
      if (affectedPartnerId === transaction.to_partner_id) {
        partnerBalanceChange = transaction.amount;
      }
      totalBalanceChange = transaction.amount;
      break;

    case 'LOAN_DISBURSEMENT':
    case 'loan_given':
      // Loan disbursement - money going out
      // Affects the disbursing partner (from_partner_id)
      if (affectedPartnerId === transaction.from_partner_id) {
        partnerBalanceChange = -transaction.amount;
      }
      totalBalanceChange = -transaction.amount;
      break;

    case 'LOAN_REPAYMENT':
    case 'loan_repaid':
      // Loan repayment - money coming in
      // Affects the collecting partner (to_partner_id)
      if (affectedPartnerId === transaction.to_partner_id) {
        partnerBalanceChange = transaction.amount;
      }
      totalBalanceChange = transaction.amount;
      break;

    case 'CHIT_CONTRIBUTION':
      // Chit fund contribution - money coming in
      // Affects the collecting partner (to_partner_id)
      if (affectedPartnerId === transaction.to_partner_id) {
        partnerBalanceChange = transaction.amount;
      }
      totalBalanceChange = transaction.amount;
      break;

    case 'AUCTION_PAYOUT':
      // Auction payout - money going out
      // Affects the disbursing partner (from_partner_id)
      if (affectedPartnerId === transaction.from_partner_id) {
        partnerBalanceChange = -transaction.amount;
      }
      totalBalanceChange = -transaction.amount;
      break;

    case 'RECORD_AMOUNT':
      // Record amount - can be either credit (to_partner) or debit (from_partner)
      if (affectedPartnerId === transaction.to_partner_id) {
        // Money coming in to to_partner (credit)
        partnerBalanceChange = transaction.amount;
        totalBalanceChange = transaction.amount;
      } else if (affectedPartnerId === transaction.from_partner_id) {
        // Money going out from from_partner (debit)
        partnerBalanceChange = -transaction.amount;
        totalBalanceChange = -transaction.amount;
      }
      break;

    default:
      // For unknown transaction types, treat as neutral
      partnerBalanceChange = 0;
      totalBalanceChange = 0;
      break;
  }

  return {
    partnerBalance: currentPartnerBalance + partnerBalanceChange,
    totalBalance: currentTotalBalance + totalBalanceChange
  };
}

/**
 * Get the current balance for a specific partner
 */
export async function getCurrentPartnerBalance(
  partnerId: number | null,
  userId: number,
  beforeDate?: Date
): Promise<number> {
  if (!partnerId) return 0;

  const whereClause: any = {
    createdById: userId,
    OR: [
      { from_partner_id: partnerId },
      { to_partner_id: partnerId }
    ]
  };

  if (beforeDate) {
    whereClause.date = { lt: beforeDate };
  }

  // Get the most recent transaction that affected this partner
  // We need to look at the transaction that stored this partner's balance
  const lastTransaction = await prisma.transaction.findFirst({
    where: {
      ...whereClause,
      OR: [
        // Transactions where this partner was the primary partner (balance stored)
        { 
          AND: [
            { to_partner_id: partnerId },
            { partnerBalance: { not: null } }
          ]
        },
        // Fallback: any transaction involving this partner
        { from_partner_id: partnerId },
        { to_partner_id: partnerId }
      ]
    },
    orderBy: [
      { date: 'desc' },
      { createdAt: 'desc' }
    ],
    select: { 
      partnerBalance: true, 
      type: true, 
      amount: true, 
      from_partner_id: true, 
      to_partner_id: true 
    }
  });

  // If we found a transaction with stored balance, return it
  if (lastTransaction?.partnerBalance !== null && lastTransaction?.partnerBalance !== undefined) {
    return lastTransaction.partnerBalance;
  }

  // Fallback: calculate balance from scratch by going through all transactions
  console.log(`No stored balance found for partner ${partnerId}, calculating from scratch`);
  
  // Get all transactions involving this partner, ordered chronologically
  const allTransactions = await prisma.transaction.findMany({
    where: {
      createdById: userId,
      OR: [
        { from_partner_id: partnerId },
        { to_partner_id: partnerId }
      ],
      ...(beforeDate ? { date: { lt: beforeDate } } : {})
    },
    orderBy: [
      { date: 'asc' },
      { createdAt: 'asc' }
    ],
    select: {
      type: true,
      amount: true,
      from_partner_id: true,
      to_partner_id: true
    }
  });

  let balance = 0;
  for (const transaction of allTransactions) {
    const balanceChange = calculateTransactionBalance(
      {
        type: transaction.type,
        amount: transaction.amount,
        from_partner_id: transaction.from_partner_id,
        to_partner_id: transaction.to_partner_id
      },
      partnerId,
      balance,
      0 // We don't need total balance for this calculation
    );
    balance = balanceChange.partnerBalance;
  }

  return balance;
}

/**
 * Get the current total balance across all partners
 */
export async function getCurrentTotalBalance(
  userId: number,
  beforeDate?: Date
): Promise<number> {
  const whereClause: any = {
    createdById: userId
  };

  if (beforeDate) {
    whereClause.date = { lt: beforeDate };
  }

  const lastTransaction = await prisma.transaction.findFirst({
    where: whereClause,
    orderBy: [
      { date: 'desc' },
      { createdAt: 'desc' }
    ],
    select: { totalBalance: true }
  });

  return lastTransaction?.totalBalance || 0;
}

/**
 * Recalculate balances for all transactions after a specific date/time
 * This is used when a transaction is deleted to update subsequent transaction balances
 */
export async function recalculateBalancesAfterDeletion(
  userId: number,
  deletedTransactionDate: Date,
  deletedTransactionId: number
): Promise<void> {
  // Get the balance state just before the deleted transaction
  const transactionBeforeDeletion = await prisma.transaction.findFirst({
    where: {
      createdById: userId,
      OR: [
        { date: { lt: deletedTransactionDate } },
        { 
          AND: [
            { date: deletedTransactionDate },
            { id: { lt: deletedTransactionId } }
          ]
        }
      ]
    },
    orderBy: [
      { date: 'desc' },
      { createdAt: 'desc' }
    ],
    select: { 
      totalBalance: true,
      partnerBalance: true,
      to_partner_id: true,
      from_partner_id: true
    }
  });

  // Get starting balances
  const startingTotalBalance = transactionBeforeDeletion?.totalBalance || 0;
  
  // Get all partner balances at this point
  const partnerBalances = new Map<number, number>();
  
  // Get the latest balance for each partner before the deletion point
  const partners = await prisma.partner.findMany({
    where: { createdById: userId },
    select: { id: true }
  });

  for (const partner of partners) {
    const partnerBalanceBeforeDeletion = await getCurrentPartnerBalance(
      partner.id, 
      userId, 
      deletedTransactionDate
    );
    partnerBalances.set(partner.id, partnerBalanceBeforeDeletion);
  }

  // Get all transactions that need to be recalculated (after the deletion point)
  const transactionsToUpdate = await prisma.transaction.findMany({
    where: {
      createdById: userId,
      OR: [
        { date: { gt: deletedTransactionDate } },
        { 
          AND: [
            { date: deletedTransactionDate },
            { id: { gt: deletedTransactionId } }
          ]
        }
      ]
    },
    orderBy: [
      { date: 'asc' },
      { createdAt: 'asc' }
    ]
  });

  let currentTotalBalance = startingTotalBalance;

  // Recalculate each transaction
  for (const transaction of transactionsToUpdate) {
    // Calculate balance changes based on transaction type
    let totalBalanceChange = 0;
    const affectedPartners = new Map(); // partnerId -> balanceChange
    
    switch (transaction.type) {
      case 'collection':
      case 'CHIT_CONTRIBUTION':
      case 'LOAN_REPAYMENT':
        // Money coming in
        totalBalanceChange = transaction.amount;
        if (transaction.to_partner_id) {
          affectedPartners.set(transaction.to_partner_id, transaction.amount);
        }
        break;

      case 'expense':
      case 'LOAN_DISBURSEMENT':
      case 'AUCTION_PAYOUT':
        // Money going out
        totalBalanceChange = -transaction.amount;
        if (transaction.from_partner_id) {
          affectedPartners.set(transaction.from_partner_id, -transaction.amount);
        }
        break;

      case 'transfer':
      case 'PARTNER_TO_PARTNER':
        // Internal transfer
        totalBalanceChange = 0;
        if (transaction.from_partner_id) {
          affectedPartners.set(transaction.from_partner_id, -transaction.amount);
        }
        if (transaction.to_partner_id) {
          affectedPartners.set(transaction.to_partner_id, transaction.amount);
        }
        break;

      case 'balance_adjustment':
        // Manual adjustment
        totalBalanceChange = transaction.amount;
        if (transaction.to_partner_id) {
          affectedPartners.set(transaction.to_partner_id, transaction.amount);
        }
        break;

      case 'RECORD_AMOUNT':
        // Record amount - can be either credit (to_partner) or debit (from_partner)
        if (transaction.to_partner_id) {
          // Money coming in to to_partner (credit)
          totalBalanceChange = transaction.amount;
          affectedPartners.set(transaction.to_partner_id, transaction.amount);
        } else if (transaction.from_partner_id) {
          // Money going out from from_partner (debit)
          totalBalanceChange = -transaction.amount;
          affectedPartners.set(transaction.from_partner_id, -transaction.amount);
        }
        break;
    }

    // Update running balances
    currentTotalBalance += totalBalanceChange;

    for (const [partnerId, balanceChange] of affectedPartners) {
      const currentBalance = partnerBalances.get(partnerId) || 0;
      partnerBalances.set(partnerId, currentBalance + balanceChange);
    }

    // Determine which partner balance to store
    const primaryPartnerId = transaction.to_partner_id || transaction.from_partner_id;
    const transactionPartnerBalance = primaryPartnerId ? (partnerBalances.get(primaryPartnerId) || 0) : 0;

    // Update the transaction record
    await prisma.transaction.update({
      where: { id: transaction.id },
      data: {
        partnerBalance: transactionPartnerBalance,
        totalBalance: currentTotalBalance
      }
    });
  }
}

/**
 * Recalculate balances for all transactions of a user
 * This should be used when migrating existing data or fixing balance inconsistencies
 */
export async function recalculateAllBalances(userId: number): Promise<void> {
  // Get all transactions ordered by date and creation time
  const transactions = await prisma.transaction.findMany({
    where: { createdById: userId },
    orderBy: [
      { date: 'asc' },
      { createdAt: 'asc' }
    ],
    include: {
      fromPartner: true,
      toPartner: true
    }
  });

  let totalBalance = 0;
  const partnerBalances = new Map<number, number>();

  for (const transaction of transactions) {
    // Calculate balance changes based on transaction type
    let totalBalanceChange = 0;
    const affectedPartners = new Map(); // partnerId -> balanceChange
    
    switch (transaction.type) {
      case 'collection':
      case 'CHIT_CONTRIBUTION':
      case 'LOAN_REPAYMENT':
        // Money coming in - increases total and receiving partner's balance
        totalBalanceChange = transaction.amount;
        if (transaction.to_partner_id) {
          affectedPartners.set(transaction.to_partner_id, transaction.amount);
        }
        break;

      case 'expense':
      case 'LOAN_DISBURSEMENT':
      case 'AUCTION_PAYOUT':
        // Money going out - decreases total and sending partner's balance
        totalBalanceChange = -transaction.amount;
        if (transaction.from_partner_id) {
          affectedPartners.set(transaction.from_partner_id, -transaction.amount);
        }
        break;

      case 'transfer':
      case 'PARTNER_TO_PARTNER':
        // Internal transfer - no change to total, but affects both partners
        totalBalanceChange = 0;
        if (transaction.from_partner_id) {
          affectedPartners.set(transaction.from_partner_id, -transaction.amount);
        }
        if (transaction.to_partner_id) {
          affectedPartners.set(transaction.to_partner_id, transaction.amount);
        }
        break;

      case 'balance_adjustment':
        // Manual adjustment - affects total and target partner
        totalBalanceChange = transaction.amount;
        if (transaction.to_partner_id) {
          affectedPartners.set(transaction.to_partner_id, transaction.amount);
        }
        break;

      case 'RECORD_AMOUNT':
        // Record amount - can be either credit (to_partner) or debit (from_partner)
        if (transaction.to_partner_id) {
          // Money coming in to to_partner (credit)
          totalBalanceChange = transaction.amount;
          affectedPartners.set(transaction.to_partner_id, transaction.amount);
        } else if (transaction.from_partner_id) {
          // Money going out from from_partner (debit)
          totalBalanceChange = -transaction.amount;
          affectedPartners.set(transaction.from_partner_id, -transaction.amount);
        }
        break;
    }

    // Update total balance
    totalBalance += totalBalanceChange;

    // Update partner balances
    for (const [partnerId, balanceChange] of affectedPartners) {
      const currentBalance = partnerBalances.get(partnerId) || 0;
      partnerBalances.set(partnerId, currentBalance + balanceChange);
    }

    // Determine which partner balance to store in the transaction record
    const primaryPartnerId = transaction.to_partner_id || transaction.from_partner_id;
    const transactionPartnerBalance = primaryPartnerId ? (partnerBalances.get(primaryPartnerId) || 0) : 0;

    // Update the transaction record
    await prisma.transaction.update({
      where: { id: transaction.id },
      data: {
        partnerBalance: transactionPartnerBalance,
        totalBalance: totalBalance
      }
    });
  }

  console.log(`Recalculated balances for ${transactions.length} transactions for user ${userId}`);
}

/**
 * Get balance summary for all partners
 */
export async function getBalanceSummary(userId: number): Promise<{
  totalBalance: number;
  partnerBalances: Array<{ partnerId: number; partnerName: string; balance: number }>;
}> {
  const partners = await prisma.partner.findMany({
    where: { createdById: userId },
    select: { id: true, name: true }
  });

  const balanceSummary = {
    totalBalance: await getCurrentTotalBalance(userId),
    partnerBalances: [] as Array<{ partnerId: number; partnerName: string; balance: number }>
  };

  for (const partner of partners) {
    const balance = await getCurrentPartnerBalance(partner.id, userId);
    balanceSummary.partnerBalances.push({
      partnerId: partner.id,
      partnerName: partner.name,
      balance
    });
  }

  return balanceSummary;
}
