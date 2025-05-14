import React from 'react';
import '../styles/globals.css';
import Header from './components/Header';

// Force static rendering for the layout to avoid hydration issues
export const dynamic = 'force-static';

export const metadata = {
  title: 'Microfinance and Chit Fund Management',
  description: 'A full-stack application for managing microfinance and chit funds.',
};

const RootLayout = ({ children }: { children: React.ReactNode }) => {
  return (
    <html lang="en">
      <body>
        <Header />
        <main className="p-4">{children}</main>
      </body>
    </html>
  );
};

export default RootLayout;