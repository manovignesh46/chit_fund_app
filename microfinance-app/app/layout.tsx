import React from 'react';
import '../styles/globals.css';
import { PartnerProvider } from './contexts/PartnerContext';
import { ThemeProvider, ThemeScript } from './theme';
import { Providers } from './providers';
import { AppShell } from '@/components/kit/app-shell/app-shell';

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
  // Light; the inline theme script swaps in the dark top-bar colour (app/theme/config.ts).
  themeColor: '#2563eb',
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
            <Providers>
              <AppShell>{children}</AppShell>
            </Providers>
          </PartnerProvider>
        </ThemeProvider>
      </body>
    </html>
  );
};

export default RootLayout;
