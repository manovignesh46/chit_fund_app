'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from '@/lib/toast';

import { usePartner } from '@/app/contexts/PartnerContext';
import { EMPTY_LOAN_FORM, LoanForm, type LoanFormValues } from '@/app/components/loans/LoanForm';
import { invalidateLoans, loanWrites } from '@/lib/query/loans';
import { errorMessage } from '@/components/kit/error-state';
import { PageContainer } from '@/components/kit/page-container';
import { PageHeader } from '@/components/kit/page-header';
import { Button } from '@/components/ui/button';

/** The request body /loans/new has always sent (strings as typed; RB sends duration 60, installment 0). */
function createBody(v: LoanFormValues) {
  return {
    globalMemberId: parseInt(v.globalMemberId),
    borrowerName: v.borrowerName,
    contact: v.contact,
    loanType: v.loanType,
    amount: v.amount,
    interestRate: v.interestRate,
    interestPercentage: v.interestPercentage,
    documentCharge: v.documentCharge,
    duration: v.loanType === 'Reducing Balance' ? '60' : v.duration,
    installmentAmount: v.loanType === 'Reducing Balance' ? '0' : v.installmentAmount,
    purpose: v.purpose,
    disbursementDate: new Date(v.disbursementDate).toISOString(),
    repaymentType: v.loanType,
    status: 'Active',
  };
}

export default function NewLoanPage() {
  const router = useRouter();
  const { selectedPartner } = usePartner();
  const [initialValues] = React.useState<LoanFormValues>(() => ({
    ...EMPTY_LOAN_FORM,
    disbursementDate: new Date().toISOString().split('T')[0],
  }));

  const submit = async (values: LoanFormValues) => {
    try {
      const created = await loanWrites.create(createBody(values), selectedPartner ? selectedPartner.name.toString() : '');
      void invalidateLoans(parseInt(values.globalMemberId));
      toast.success('Loan created', { description: values.borrowerName });
      router.push('/loans');
      void created;
    } catch (error) {
      toast.error('Failed to create loan', { description: `${errorMessage(error) ?? 'An unknown error occurred'}. Please try again.` });
      throw error;
    }
  };

  return (
    <PageContainer>
      <PageHeader
        title="New loan"
        description="Disburse a loan to an existing member."
        actions={
          <Button variant="ghost" asChild>
            <Link href="/loans">Cancel</Link>
          </Button>
        }
      />
      <LoanForm mode="create" initialValues={initialValues} onSubmit={submit} cancelHref="/loans" />
    </PageContainer>
  );
}
