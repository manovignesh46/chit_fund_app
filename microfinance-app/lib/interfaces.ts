/**
 * Standardized interfaces for the application
 */

/**
 * Global Member interface
 */
export interface GlobalMember {
  id: number;
  name: string;
  contact: string;
  email?: string | null;
  address?: string | null;
  notes?: string | null;
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

/**
 * Chit Fund interface
 */
export interface ChitFund {
  id: number;
  name: string;
  totalAmount: number;
  monthlyContribution: number;
  duration: number;
  membersCount: number;
  status: string;
  startDate: Date | string;
  currentMonth: number;
  nextAuctionDate?: Date | string | null;
  description?: string | null;
  createdAt?: Date | string;
  updatedAt?: Date | string;
  createdById: number;
  members?: ChitFundMember[];
  contributions?: Contribution[];
  auctions?: Auction[];
  _count?: {
    members?: number;
    contributions?: number;
    auctions?: number;
  };
}

/**
 * Chit Fund Member interface
 */
export interface ChitFundMember {
  id: number;
  globalMemberId: number;
  chitFundId: number;
  joinDate: Date | string;
  auctionWon: boolean;
  auctionMonth?: number | null;
  contribution: number;
  createdAt?: Date | string;
  updatedAt?: Date | string;
  globalMember?: GlobalMember;
  chitFund?: ChitFund;
  name?: string; // For convenience when including globalMember data
}

/**
 * Contribution interface
 */
export interface Contribution {
  id: number;
  amount: number;
  month: number;
  paidDate: Date | string;
  memberId: number;
  chitFundId: number;
  balance: number;
  balancePaymentDate?: Date | string | null;
  balancePaymentStatus?: string | null;
  actualBalancePaymentDate?: Date | string | null;
  notes?: string | null;
  createdAt?: Date | string;
  updatedAt?: Date | string;
  member?: ChitFundMember;
  chitFund?: ChitFund;
}

/**
 * Auction interface
 */
export interface Auction {
  id: number;
  chitFundId: number;
  month: number;
  date: Date | string;
  winnerId: number;
  amount: number;
  lowestBid?: number | null;
  highestBid?: number | null;
  numberOfBidders?: number | null;
  notes?: string | null;
  createdAt?: Date | string;
  updatedAt?: Date | string;
  chitFund?: ChitFund;
  winner?: ChitFundMember;
}

/**
 * Loan interface
 */
export interface Loan {
  id: number;
  borrowerId: number;
  borrower: GlobalMember;
  loanType: string;
  amount: number;
  interestRate: number;
  documentCharge: number;
  installmentAmount: number;
  duration: number;
  disbursementDate: Date | string;
  repaymentType: string;
  remainingAmount: number;
  overdueAmount: number;
  missedPayments: number;
  currentMonth: number;
  nextPaymentDate: Date | string | null;
  status: string;
  purpose?: string | null;
  createdAt?: Date | string;
  updatedAt?: Date | string;
  repayments?: Repayment[];
}

/**
 * Repayment interface
 */
export interface Repayment {
  id: number;
  loanId: number;
  amount: number;
  paidDate: Date | string;
  paymentType: 'full' | 'interestOnly';
  period: number;
  createdAt?: Date | string;
  updatedAt?: Date | string;
  loan?: Loan;
}

/**
 * Payment Schedule interface
 */
export interface PaymentSchedule {
  id: number;
  period: number;
  dueDate: Date | string;
  amount: number;
  status: string;
  actualPaymentDate?: Date | string | null;
  notes?: string | null;
  repayment?: Repayment;
}

/**
 * Pagination response interface
 */
export interface PaginatedResponse<T> {
  data?: T[];
  repayments?: T[]; // For backward compatibility with repayments API
  loans?: T[]; // For backward compatibility with loans API
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/**
 * Loan form data interface
 */
export interface LoanFormData {
  borrowerName: string;
  contact: string;
  loanType: string;
  amount: string;
  interestRate: string;
  documentCharge: string;
  installmentAmount: string;
  duration: string;
  purpose: string;
  disbursementDate: string;
  status?: string;
}

/**
 * Loan form errors interface
 */
export interface LoanFormErrors {
  borrowerName?: string;
  contact?: string;
  loanType?: string;
  amount?: string;
  interestRate?: string;
  documentCharge?: string;
  installmentAmount?: string;
  duration?: string;
  purpose?: string;
  disbursementDate?: string;
  status?: string;
  general?: string;
}

/**
 * Repayment form data interface
 */
export interface RepaymentFormData {
  amount: string;
  paidDate: string;
  paymentType: 'full' | 'interestOnly';
  scheduleId: string;
}

/**
 * Repayment form errors interface
 */
export interface RepaymentFormErrors {
  amount?: string;
  paidDate?: string;
  paymentType?: string;
  scheduleId?: string;
  general?: string;
}

/**
 * Loan type option interface
 */
export interface LoanTypeOption {
  value: string;
  label: string;
}

/**
 * Loan status option interface
 */
export interface LoanStatusOption {
  value: string;
  label: string;
}

/**
 * Error response interface
 */
export interface ErrorResponse {
  error: string;
  details?: string;
}
