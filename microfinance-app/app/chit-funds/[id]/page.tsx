'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

const ChitFundDetails = () => {
  const params = useParams();
  const id = params.id;
  const [chitFund, setChitFund] = useState(null);
  const [loading, setLoading] = useState(true);

  // Mock data for chit fund details
  const mockChitFund = {
    id: id,
    name: 'Gold Chit Fund',
    totalAmount: 1200000,
    monthlyContribution: 10000,
    duration: 20,
    membersCount: 20,
    status: 'Active',
    nextAuctionDate: '2023-05-12',
    currentMonth: 8,
    nextPayoutReceiver: 'Amit Kumar',
    finalPayout: 950000,
    members: [
      { id: 1, name: 'Rahul Sharma', contribution: 80000, auctionWon: true, auctionMonth: 3 },
      { id: 2, name: 'Priya Patel', contribution: 80000, auctionWon: true, auctionMonth: 5 },
      { id: 3, name: 'Amit Kumar', contribution: 70000, auctionWon: false, auctionMonth: null },
      { id: 4, name: 'Neha Singh', contribution: 80000, auctionWon: true, auctionMonth: 7 },
      { id: 5, name: 'Vikram Malhotra', contribution: 70000, auctionWon: false, auctionMonth: null },
    ],
    auctions: [
      { month: 3, winner: 'Rahul Sharma', amount: 950000, date: '2022-12-12' },
      { month: 5, winner: 'Priya Patel', amount: 960000, date: '2023-02-12' },
      { month: 7, winner: 'Neha Singh', amount: 955000, date: '2023-04-12' },
    ]
  };

  useEffect(() => {
    // Simulate API call
    const fetchChitFund = async () => {
      try {
        // In a real app, this would be an API call:
        // const response = await fetch(`/api/chit-funds/${id}`);
        // const data = await response.json();

        // Using mock data for now
        setTimeout(() => {
          setChitFund(mockChitFund);
          setLoading(false);
        }, 500);
      } catch (error) {
        console.error('Error fetching chit fund details:', error);
        setLoading(false);
      }
    };

    fetchChitFund();
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
            <p className="text-gray-600">Loading chit fund details...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!chitFund) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          <h2 className="text-xl font-bold mb-2">Chit Fund Not Found</h2>
          <p>The chit fund you are looking for does not exist or has been removed.</p>
          <Link href="/chit-funds" className="mt-4 inline-block text-blue-600 hover:underline">
            Return to Chit Funds
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-blue-700">{chitFund.name}</h1>
        <Link href="/chit-funds" className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition duration-300">
          Back to Chit Funds
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="lg:col-span-2">
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <div className="p-6 border-b">
              <div className="flex justify-between items-start">
                <h2 className="text-xl font-semibold">Chit Fund Overview</h2>
                <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-semibold">
                  {chitFund.status}
                </span>
              </div>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-2">Total Amount</h3>
                  <p className="text-xl font-semibold">{formatCurrency(chitFund.totalAmount)}</p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-2">Monthly Contribution</h3>
                  <p className="text-xl font-semibold">{formatCurrency(chitFund.monthlyContribution)}</p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-2">Duration</h3>
                  <p className="text-xl font-semibold">{chitFund.duration} months</p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-2">Members</h3>
                  <p className="text-xl font-semibold">{chitFund.membersCount}</p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-2">Current Month</h3>
                  <p className="text-xl font-semibold">{chitFund.currentMonth} of {chitFund.duration}</p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-2">Next Auction Date</h3>
                  <p className="text-xl font-semibold">{formatDate(chitFund.nextAuctionDate)}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md overflow-hidden mt-6">
            <div className="p-6 border-b">
              <h2 className="text-xl font-semibold">Auction History</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Month
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Winner
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Amount
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {chitFund.auctions.map((auction, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{auction.month}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{formatDate(auction.date)}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-blue-600">{auction.winner}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{formatCurrency(auction.amount)}</div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {chitFund.status === 'Active' && (
              <div className="p-6 border-t">
                <Link href={`/chit-funds/${chitFund.id}/auction`} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition duration-300">
                  Conduct Next Auction
                </Link>
              </div>
            )}
          </div>
        </div>

        <div>
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <div className="p-6 border-b">
              <h2 className="text-xl font-semibold">Members</h2>
            </div>
            <div className="p-6">
              <ul className="divide-y divide-gray-200">
                {chitFund.members.map((member) => (
                  <li key={member.id} className="py-3 flex justify-between items-center">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{member.name}</p>
                      <p className="text-sm text-gray-500">
                        {member.auctionWon ? `Won auction in month ${member.auctionMonth}` : 'No auction won yet'}
                      </p>
                    </div>
                    <div className="text-sm font-semibold">
                      {formatCurrency(member.contribution)}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
            <div className="p-6 border-t">
              <Link href={`/chit-funds/${chitFund.id}/members`} className="text-blue-600 hover:underline block text-center">
                View All Members
              </Link>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md overflow-hidden mt-6">
            <div className="p-6 border-b">
              <h2 className="text-xl font-semibold">Next Payout</h2>
            </div>
            <div className="p-6">
              <div className="mb-4">
                <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-2">Receiver</h3>
                <p className="text-xl font-semibold">{chitFund.nextPayoutReceiver}</p>
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-2">Amount</h3>
                <p className="text-xl font-semibold">{formatCurrency(chitFund.finalPayout)}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChitFundDetails;