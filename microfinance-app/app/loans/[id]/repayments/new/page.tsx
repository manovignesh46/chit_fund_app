'use client';

import * as React from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { toast } from '@/lib/toast';

import RepaymentForm from '@/app/components/loans/RepaymentForm';
import { formatMoney } from '@/lib/format';
import { invalidateLoan, loanWrites, useLoan } from '@/lib/query/loans';
import { Button } from '@/components/ui/button';
import { useBreadcrumbLabel } from '@/components/kit/app-shell/breadcrumb-labels';
import { errorMessage } from '@/components/kit/error-state';
import { PageContainer } from '@/components/kit/page-container';
import { PageHeader } from '@/components/kit/page-header';

export default function NewRepaymentPage() {
  const params = useParams<{ id: string }>();
  const id = parseInt(params.id, 10) || 0;
  const router = useRouter();
  const { data: loan } = useLoan(id || null);
  useBreadcrumbLabel(id ? `/loans/${id}` : null, loan?.borrower?.name);

  if (!id) return null;

  return (
    <PageContainer>
      <div className="mx-auto max-w-4xl">
        <PageHeader
          title="Record payment"
          description={loan?.borrower?.name}
          actions={
            <Button variant="ghost" asChild>
              <Link href={`/loans/${id}`}>Cancel</Link>
            </Button>
          }
        />
        <RepaymentForm
          loanId={id}
          onCancel={() => router.push(`/loans/${id}`)}
          onSubmit={async (body) => {
            try {
              await loanWrites.addRepayment(id, body);
            } catch (error) {
              toast.error('Payment not recorded', { description: errorMessage(error) ?? 'Failed to record payment' });
              throw error;
            }
            toast.success('Payment recorded', { description: formatMoney(body.amount) });
            void invalidateLoan(id, loan?.borrowerId);
            router.push(`/loans/${id}?tab=schedule`);
          }}
        />
      </div>
    </PageContainer>
  );
}
