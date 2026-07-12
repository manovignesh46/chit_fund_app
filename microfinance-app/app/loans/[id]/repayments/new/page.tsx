// @ts-nocheck
'use client';

import React from 'react';
import { useParams, useRouter } from 'next/navigation';
import RepaymentForm from '../../../../components/loans/RepaymentForm';
import BackTitle from '../../../../components/common/BackTitle';
import { invalidateDashboardCache } from '../../../../../lib/dashboardCache';

export default function NewRepaymentPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id;

  const handleSuccess = () => {
    invalidateDashboardCache();
    router.push(`/loans/${id}`);
  };

  const handleCancel = () => {
    router.push(`/loans/${id}`);
  };

  if (!id) return null;

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <BackTitle title="Record Payment" href={`/loans/${id}`} ariaLabel="Back to Loan Details" />
      </div>

      <div className="max-w-4xl mx-auto">
        <RepaymentForm 
          loanId={parseInt(id as string)} 
          onSuccess={handleSuccess}
          onCancel={handleCancel}
        />
      </div>
    </div>
  );
}
