import React from 'react';
import '../styles/globals.css';

export const metadata = {
  title: 'Microfinance and Chit Fund Management',
  description: 'A full-stack application for managing microfinance and chit funds.',
};

const RootLayout = ({ children }: { children: React.ReactNode }) => {
  return (
    <html lang="en">
      <body>
        <header className="bg-blue-600 text-white p-4">
          <h1 className="text-2xl">Microfinance & Chit Fund Management</h1>
          <nav>
            <ul className="flex space-x-4">
              <li><a href="/chit-funds" className="hover:underline">Chit Funds</a></li>
              <li><a href="/loans" className="hover:underline">Loans</a></li>
              <li><a href="/dashboard" className="hover:underline">Dashboard</a></li>
            </ul>
          </nav>
        </header>
        <main className="p-4">{children}</main>
      </body>
    </html>
  );
};

export default RootLayout;