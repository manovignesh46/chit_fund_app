'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

// Define interfaces
interface Loan {
  id: number;
  borrowerId: number;
  borrower: {
    name: string;
  };
  amount: number;
  remainingAmount: number;
  status: string;
}

interface Repayment {
  id: number;
  paidDate: string;
  amount: number;
  createdAt: string;
  paymentType?: 'full' | 'interestOnly';
}

const RepaymentsPage = () => {
  const params = useParams();
  const id = params.id;
  const [loan, setLoan] = useState<Loan | null>(null);
  const [repayments, setRepayments] = useState<Repayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (id) {
      const fetchData = async () => {
        try {
          setLoading(true);

          // Fetch loan details
          const loanResponse = await fetch(`/api/loans/${id}`);
          if (!loanResponse.ok) {
            throw new Error('Failed to fetch loan details');
          }
          const loanData = await loanResponse.json();
          setLoan(loanData);

          // Fetch repayments
          const repaymentsResponse = await fetch(`/api/loans/${id}/repayments`);
          if (!repaymentsResponse.ok) {
            throw new Error('Failed to fetch repayments');
          }
          const repaymentsData = await repaymentsResponse.json();
          setRepayments(repaymentsData);

          setError(null);
        } catch (err) {
          console.error('Error fetching data:', err);
          setError(err instanceof Error ? err.message : 'An error occurred');
        } finally {
          setLoading(false);
        }
      };

      fetchData();
    }
  }, [id]);

  // Format currency
  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  // Format date
  const formatDate = (dateString: string): string => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-IN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(date);
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-center items-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-700 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading repayments...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          <h2 className="text-xl font-bold mb-2">Error</h2>
          <p>{error}</p>
          <Link href="/loans" className="mt-4 inline-block text-blue-600 hover:underline">
            Return to Loans
          </Link>
        </div>
      </div>
    );
  }

  if (!loan) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          <h2 className="text-xl font-bold mb-2">Loan Not Found</h2>
          <p>The loan you are looking for does not exist or has been removed.</p>
          <Link href="/loans" className="mt-4 inline-block text-blue-600 hover:underline">
            Return to Loans
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-green-700">Repayment History</h1>
        <div className="flex space-x-4">
          {loan.status === 'Active' && (
            <Link href={`/loans/${id}/repayments/new`} className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition duration-300">
              Record New Payment
            </Link>
          )}
          <Link href={`/loans/${id}`} className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition duration-300">
            Back to Loan Details
          </Link>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md overflow-hidden mb-6">
        <div className="p-6 border-b">
          <h2 className="text-xl font-semibold">Loan Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
            <div>
              <p className="text-sm text-gray-500">Borrower</p>
              <p className="font-medium">{loan.borrower?.name || 'Unknown'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Total Amount</p>
              <p className="font-medium">{formatCurrency(loan.amount)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Remaining Balance</p>
              <p className="font-medium">{formatCurrency(loan.remainingAmount)}</p>
            </div>
          </div>
        </div>
      </div>

      {repayments.length === 0 ? (
        <div className="bg-white rounded-lg shadow-md p-6 text-center">
          <p className="text-gray-600 mb-4">No repayments recorded yet.</p>
          {loan.status === 'Active' && (
            <Link href={`/loans/${id}/repayments/new`} className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition duration-300">
              Record First Payment
            </Link>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Payment Date
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Amount
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Recorded On
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {repayments.map((repayment) => (
                  <tr key={repayment.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{formatDate(repayment.paidDate)}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{formatCurrency(repayment.amount)}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {repayment.paymentType === 'interestOnly' ? (
                        <span className="px-2 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800">
                          Interest Only
                        </span>
                      ) : (
                        <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                          Principal + Interest
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{formatDate(repayment.createdAt)}</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="p-6 border-t">
            <div className="flex justify-between items-center">
              <div>
                <span className="text-sm text-gray-500">Total Paid:</span>
                <span className="ml-2 text-lg font-semibold">
                  {formatCurrency(repayments.reduce((sum, item) => sum + item.amount, 0))}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RepaymentsPage;