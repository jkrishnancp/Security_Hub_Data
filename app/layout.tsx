'use client';

import './globals.css';
import { Inter } from 'next/font/google';
import { SessionProvider } from 'next-auth/react';
import { ThemeProvider } from '@/components/theme-provider';
import OnboardingGuard from '@/components/onboarding-guard';

const inter = Inter({ subsets: ['latin'] });

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider defaultTheme="dark" storageKey="security-data-hub-theme">
          <SessionProvider>
            <OnboardingGuard>
              {children}
            </OnboardingGuard>
          </SessionProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
