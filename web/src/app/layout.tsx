import type { Metadata } from 'next';
import ScrollReveal from '../components/ScrollReveal';
import SiteNav from '../components/SiteNav';
import './globals.css';

const siteUrl = new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'https://push-pull.app');
const defaultOgImage = '/SCREENSHOT_HOME.PNG';
const logoUrl = new URL('/push-pull-logo.png', siteUrl).toString();
const structuredData = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      name: 'Push/Pull',
      url: siteUrl.toString(),
      logo: logoUrl,
    },
    {
      '@type': 'WebSite',
      name: 'Push/Pull',
      url: siteUrl.toString(),
    },
    {
      '@type': 'SoftwareApplication',
      name: 'Push/Pull',
      applicationCategory: 'HealthApplication',
      operatingSystem: 'iOS, Android',
      description:
        'A workout tracker built for lifters with fast logging, clear progress, squads for accountability, and optional AI planning.',
      url: siteUrl.toString(),
      publisher: {
        '@type': 'Organization',
        name: 'Push/Pull',
      },
      offers: [
        {
          '@type': 'Offer',
          price: '4.99',
          priceCurrency: 'USD',
          url: siteUrl.toString(),
        },
        {
          '@type': 'Offer',
          price: '49.99',
          priceCurrency: 'USD',
          url: siteUrl.toString(),
        },
      ],
    },
  ],
};

export const metadata: Metadata = {
  metadataBase: siteUrl,
  title: {
    default: 'Push Pull: Gym Tracker',
    template: '%s - Push/Pull',
  },
  description:
    'Push Pull is a gym tracker with smart workouts, fast logging, clear progress, squads for accountability, and optional AI planning.',
  keywords: [
    'workout logger',
    'gym tracker',
    'strength training',
    'ai planner',
    'home workouts',
    'weightlifting',
    'routine',
    'progression',
    'fitness app',
    'push pull',
  ],
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: 'Push Pull: Gym Tracker',
    description:
      'Push Pull is a gym tracker with smart workouts, fast logging, clear progress, squads for accountability, and optional AI planning.',
    url: siteUrl.toString(),
    siteName: 'Push/Pull',
    locale: 'en_US',
    type: 'website',
    images: [
      {
        url: defaultOgImage,
        width: 1200,
        height: 630,
        alt: 'Push/Pull workout tracker preview',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Push/Pull - Workout Tracker for Lifters',
    description:
      'The workout tracker built for lifters. Fast logging, clear progress, squads for accountability, and optional AI planning.',
    images: [defaultOgImage],
  },
  icons: {
    icon: '/push-pull-logo.png',
    shortcut: '/push-pull-logo.png',
    apple: '/push-pull-logo.png',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
      'max-video-preview': -1,
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <script type="application/ld+json">
          {JSON.stringify(structuredData)}
        </script>
      </head>
      <body className="bg-background text-text-primary">
        <SiteNav />
        {children}
        <ScrollReveal />
      </body>
    </html>
  );
}
