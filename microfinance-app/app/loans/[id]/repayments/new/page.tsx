// @ts-nocheck
'use client';

import React from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import RepaymentForm from '../../../../components/loans/RepaymentForm';

export default function NewRepaymentPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id;

  const handleSuccess = () => {
    router.push(`/loans/${id}`);
  };

  const handleCancel = () => {
    router.push(`/loans/${id}`);
  };

  if (!id) return null;

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-green-700">Record Payment</h1>
        <Link 
          href={`/loans/${id}`} 
          className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition duration-300"
        >
          Back to Loan Details
        </Link>
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
