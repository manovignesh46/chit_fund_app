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
