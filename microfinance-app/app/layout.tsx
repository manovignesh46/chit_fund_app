// @ts-nocheck
import React from 'react';
import '../styles/globals.css';
import Layout from './components/Layout';
import { PartnerProvider } from './contexts/PartnerContext';

// Initialize the application (including schedulers)
import '../lib/init';

// Force static rendering for the layout to avoid hydration issues
export const dynamic = 'force-static';

export const metadata = {
  title: 'AM Fincorp - Microfinance and Chit Fund Management',
  description: 'A full-stack application for managing microfinance and chit funds.',
};

const RootLayout = ({ children }: { children: React.ReactNode }) => {
  return (
    <html lang="en">
      <body>
        <PartnerProvider>
          <Layout>
            {children}
          </Layout>
        </PartnerProvider>
      </body>
    </html>
  );
};

export default RootLayout;