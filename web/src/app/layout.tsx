import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Push/Pull - Coming Soon',
  description:
    'The workout tracker built for lifters. Track your gains, push your limits.',
  keywords: ['workout tracker', 'fitness app', 'push pull', 'strength training'],
  openGraph: {
    title: 'Push/Pull - Coming Soon',
    description: 'The workout tracker built for lifters.',
    url: 'https://pushpull.app',
    siteName: 'Push/Pull',
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Push/Pull - Coming Soon',
    description: 'The workout tracker built for lifters.',
  },
  icons: {
    icon: '/push-pull-logo.png',
    shortcut: '/push-pull-logo.png',
    apple: '/push-pull-logo.png',
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-background text-text-primary`}>
        {children}
      </body>
    </html>
  );
}
