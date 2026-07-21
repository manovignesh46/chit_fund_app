// @ts-nocheck
import React from 'react';
import '../styles/globals.css';
import Layout from './components/Layout';
import { PartnerProvider } from './contexts/PartnerContext';
import { ThemeProvider, ThemeScript } from './theme';

import '../lib/init';

export const dynamic = 'force-static';

export const metadata = {
  title: 'AM Fincorp - Microfinance and Chit Fund Management',
  description: 'A full-stack application for managing microfinance and chit funds.',
  manifest: '/manifest.json',
  icons: {
    icon: [
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: '/icons/apple-touch-icon.png',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'AM Fincorp',
  },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  interactiveWidget: 'resizes-content',
  themeColor: '#4338CA',
};

const RootLayout = ({ children }: { children: React.ReactNode }) => {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <ThemeScript />
      </head>
      <body>
        <ThemeProvider>
          <PartnerProvider>
            <Layout>
              {children}
            </Layout>
          </PartnerProvider>
        </ThemeProvider>
      </body>
    </html>
  );
};

export default RootLayout;
