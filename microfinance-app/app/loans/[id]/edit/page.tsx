'use client';

import * as React from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { toast } from '@/lib/toast';

import { EMPTY_LOAN_FORM, LoanForm, type LoanFormValues } from '@/app/components/loans/LoanForm';
import { invalidateLoans, loanWrites, useLoan, type LoanRecord } from '@/lib/query/loans';
import { useBreadcrumbLabel } from '@/components/kit/app-shell/breadcrumb-labels';
import { ErrorState, errorMessage } from '@/components/kit/error-state';
import { PageContainer, PageSkeleton } from '@/components/kit/page-container';
import { PageHeader } from '@/components/kit/page-header';
import { Button } from '@/components/ui/button';

/** Form values from the loan, as the edit page always prefilled them (dates as UTC YYYY-MM-DD). */
function valuesFromLoan(loan: LoanRecord): LoanFormValues {
  const dateForInput = (value: string | null | undefined) => (value ? new Date(value).toISOString().split('T')[0] : '');
  return {
    ...EMPTY_LOAN_FORM,
    borrowerName: loan.borrower?.name || '',
    contact: loan.borrower?.contact || '',
    loanType: loan.loanType || 'Monthly',
    amount: loan.amount?.toString() || '',
    interestRate: loan.interestRate?.toString() || '',
    documentCharge: (loan.documentCharge || 0).toString(),
    installmentAmount: (loan.installmentAmount || 0).toString(),
    duration: loan.duration?.toString() || '',
    purpose: loan.purpose || '',
    disbursementDate: dateForInput(loan.disbursementDate),
    status: loan.status || 'Active',
  };
}

/** The request body the edit page has always sent. */
function updateBody(id: number, v: LoanFormValues) {
  return {
    id,
    borrowerName: v.borrowerName,
    contact: v.contact,
    loanType: v.loanType,
    amount: v.amount,
    interestRate: v.interestRate,
    documentCharge: v.documentCharge,
    installmentAmount: v.installmentAmount,
    duration: v.duration,
    purpose: v.purpose,
    disbursementDate: new Date(v.disbursementDate).toISOString(),
    status: v.status,
    repaymentType: v.loanType,
  };
}

export default function EditLoanPage() {
  const params = useParams<{ id: string }>();
  const id = parseInt(params.id, 10) || 0;
  const router = useRouter();
  const { data: loan, error, mutate } = useLoan(id || null);
  useBreadcrumbLabel(id ? `/loans/${id}` : null, loan?.borrower?.name);

  // Prefill once: background revalidation must not overwrite what the user is typing.
  const [initialValues, setInitialValues] = React.useState<LoanFormValues | null>(null);
  React.useEffect(() => {
    if (loan && !initialValues) setInitialValues(valuesFromLoan(loan));
  }, [loan, initialValues]);

  const submit = async (values: LoanFormValues) => {
    try {
      await loanWrites.update(id, updateBody(id, values));
      void invalidateLoans(loan?.borrowerId);
      toast.success('Loan updated');
      router.push(`/loans/${id}`);
    } catch (err) {
      toast.error('Failed to update loan', { description: `${errorMessage(err) ?? 'An unknown error occurred'}. Please try again.` });
      throw err;
    }
  };

  return (
    <PageContainer>
      <PageHeader
        title="Edit loan"
        description={loan?.borrower?.name}
        actions={
          <Button variant="ghost" asChild>
            <Link href={`/loans/${id}`}>Cancel</Link>
          </Button>
        }
      />
      {initialValues ? (
        <LoanForm mode="edit" initialValues={initialValues} onSubmit={submit} cancelHref={`/loans/${id}`} />
      ) : error ? (
        <ErrorState title="Failed to load loan data" error={error} onRetry={() => void mutate()} />
      ) : (
        <PageSkeleton rows={8} />
      )}
    </PageContainer>
  );
}
