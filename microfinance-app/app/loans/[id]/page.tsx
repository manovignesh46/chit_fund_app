'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

const LoanDetailPage = () => {
  const params = useParams();
  const id = params.id;
  const [loan, setLoan] = useState(null);
  const [loading, setLoading] = useState(true);

  // Mock data for loan details
  const mockLoan = {
    id: id,
    borrowerName: 'Rahul Sharma',
    contact: '+91 9876543210',
    amount: 50000,
    interestRate: 12,
    loanType: 'Business',
    disbursementDate: '2023-01-15',
    duration: 12,
    repaymentType: 'Monthly',
    remainingBalance: 35000,
    nextPaymentDate: '2023-05-15',
    status: 'Active',
    repayments: [
      { id: 1, paidDate: '2023-02-15', amount: 5000 },
      { id: 2, paidDate: '2023-03-15', amount: 5000 },
      { id: 3, paidDate: '2023-04-15', amount: 5000 },
    ]
  };

  useEffect(() => {
    // Simulate API call
    const fetchLoanDetails = async () => {
      try {
        // In a real app, this would be an API call:
        // const response = await fetch(`/api/loans/${id}`);
        // const data = await response.json();

        // Using mock data for now
        setTimeout(() => {
          setLoan(mockLoan);
          setLoading(false);
        }, 500);
      } catch (error) {
        console.error('Error fetching loan details:', error);
        setLoading(false);
      }
    };

    fetchLoanDetails();
  }, [id]);

  // Format currency
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  // Format date
  const formatDate = (dateString) => {
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
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-700 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading loan details...</p>
          </div>
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
        <h1 className="text-3xl font-bold text-green-700">Loan Details</h1>
        <Link href="/loans" className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition duration-300">
          Back to Loans
        </Link>
      </div>

      <div className="bg-white rounded-lg shadow-md overflow-hidden mb-8">
        <div className="p-6 border-b">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-2xl font-semibold">{loan.borrowerName}</h2>
              <p className="text-gray-600">{loan.contact}</p>
            </div>
            <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-semibold">
              {loan.status}
            </span>
          </div>
        </div>

        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div>
              <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-2">Loan Amount</h3>
              <p className="text-xl font-semibold">{formatCurrency(loan.amount)}</p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-2">Remaining Balance</h3>
              <p className="text-xl font-semibold">{formatCurrency(loan.remainingBalance)}</p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-2">Interest Rate</h3>
              <p className="text-xl font-semibold">{loan.interestRate}%</p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-2">Loan Type</h3>
              <p className="text-xl font-semibold">{loan.loanType}</p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-2">Repayment Type</h3>
              <p className="text-xl font-semibold">{loan.repaymentType}</p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-2">Duration</h3>
              <p className="text-xl font-semibold">{loan.duration} months</p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-2">Disbursement Date</h3>
              <p className="text-xl font-semibold">{formatDate(loan.disbursementDate)}</p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-2">Next Payment Date</h3>
              <p className="text-xl font-semibold">{formatDate(loan.nextPaymentDate)}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="p-6 border-b">
          <h2 className="text-xl font-semibold">Repayment History</h2>
        </div>
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
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loan.repayments.map((repayment) => (
                <tr key={repayment.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{formatDate(repayment.paidDate)}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{formatCurrency(repayment.amount)}</div>
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
              <span className="ml-2 text-lg font-semibold">{formatCurrency(loan.repayments.reduce((sum, item) => sum + item.amount, 0))}</span>
            </div>
            {loan.status === 'Active' && (
              <Link href={`/loans/${loan.id}/repayments/new`} className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition duration-300">
                Record New Payment
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoanDetailPage;