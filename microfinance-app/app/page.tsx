import React from 'react';
import Link from 'next/link';

export default function HomePage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <section className="mb-10">
        <h1 className="text-3xl font-bold text-blue-700 mb-4">Welcome to Microfinance & Chit Fund Management</h1>
        <p className="text-lg text-gray-700 mb-6">
          A comprehensive solution for managing microfinance operations and chit funds efficiently.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Link href="/chit-funds" className="block p-6 bg-blue-100 rounded-lg shadow-md hover:bg-blue-200 transition duration-300">
            <h2 className="text-xl font-semibold text-blue-700 mb-2">Chit Funds</h2>
            <p className="text-gray-700">Manage chit fund groups, members, auctions, and payouts in one place.</p>
          </Link>
          <Link href="/loans" className="block p-6 bg-green-100 rounded-lg shadow-md hover:bg-green-200 transition duration-300">
            <h2 className="text-xl font-semibold text-green-700 mb-2">Loans</h2>
            <p className="text-gray-700">Track loan applications, approvals, disbursements, and repayments.</p>
          </Link>
          <Link href="/dashboard" className="block p-6 bg-purple-100 rounded-lg shadow-md hover:bg-purple-200 transition duration-300">
            <h2 className="text-xl font-semibold text-purple-700 mb-2">Dashboard</h2>
            <p className="text-gray-700">Get a comprehensive overview of all financial activities and performance metrics.</p>
          </Link>
        </div>
      </section>

      <section className="mb-10">
        <h2 className="text-2xl font-bold text-blue-700 mb-4">Key Features</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="p-6 bg-gray-100 rounded-lg shadow-md">
            <h3 className="text-lg font-semibold text-blue-700 mb-2">Chit Fund Management</h3>
            <ul className="list-disc list-inside text-gray-700 space-y-2">
              <li>Create and manage multiple chit fund schemes</li>
              <li>Track member contributions and auction details</li>
              <li>Automated dividend calculations</li>
              <li>Comprehensive reporting system</li>
            </ul>
          </div>
          <div className="p-6 bg-gray-100 rounded-lg shadow-md">
            <h3 className="text-lg font-semibold text-green-700 mb-2">Loan Management</h3>
            <ul className="list-disc list-inside text-gray-700 space-y-2">
              <li>Process loan applications efficiently</li>
              <li>Track repayment schedules</li>
              <li>Monitor overdue payments</li>
              <li>Generate loan statements for borrowers</li>
            </ul>
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-2xl font-bold text-blue-700 mb-4">Get Started</h2>
        <p className="text-lg text-gray-700 mb-6">
          Navigate to any of the sections above to begin managing your microfinance operations.
        </p>
        <div className="flex flex-col md:flex-row gap-4">
          <Link href="/chit-funds" className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition duration-300 text-center">
            Explore Chit Funds
          </Link>
          <Link href="/loans" className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition duration-300 text-center">
            Manage Loans
          </Link>
          <Link href="/dashboard" className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition duration-300 text-center">
            View Dashboard
          </Link>
        </div>
      </section>
    </div>
  );
}
