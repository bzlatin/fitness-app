import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Push/Pull - Coming Soon',
  description:
    'The workout tracker built for lifters. Track your gains, push your limits.',
  keywords: ['workout tracker', 'fitness app', 'push pull', 'strength training'],
  openGraph: {
    title: 'Push/Pull - Coming Soon',
    description: 'The workout tracker built for lifters.',
    url: 'https://push-pull.app',
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
      <body className="bg-background text-text-primary">{children}</body>
    </html>
  );
}
