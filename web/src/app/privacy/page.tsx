import type { Metadata } from 'next';
import Link from 'next/link';

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://push-pull.app').replace(/\/+$/, '');
const defaultOgImage = '/SCREENSHOT_HOME.PNG';

export const metadata: Metadata = {
  title: 'Privacy Policy - Push/Pull',
  description: 'Privacy Policy for the Push/Pull workout tracking app.',
  alternates: {
    canonical: '/privacy',
  },
  openGraph: {
    title: 'Privacy Policy - Push/Pull',
    description: 'Privacy Policy for the Push/Pull workout tracking app.',
    url: `${siteUrl}/privacy`,
    type: 'website',
    images: [
      {
        url: defaultOgImage,
        width: 1200,
        height: 630,
        alt: 'Push/Pull privacy policy',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Privacy Policy - Push/Pull',
    description: 'Privacy Policy for the Push/Pull workout tracking app.',
    images: [defaultOgImage],
  },
};

export default function PrivacyPolicy() {
  return (
    <main className='min-h-screen bg-background'>
      <div className='max-w-3xl mx-auto px-6 py-12'>
        <Link
          href='/'
          className='inline-flex items-center gap-2 text-text-secondary hover:text-text-primary transition-colors mb-8'
        >
          <svg
            className='w-4 h-4'
            fill='none'
            viewBox='0 0 24 24'
            stroke='currentColor'
          >
            <path
              strokeLinecap='round'
              strokeLinejoin='round'
              strokeWidth={2}
              d='M15 19l-7-7 7-7'
            />
          </svg>
          Back to Home
        </Link>

        <h1 className='text-3xl sm:text-4xl font-bold text-text-primary mb-2'>
          Privacy Policy
        </h1>
        <p className='text-text-secondary mb-10'>Last Updated: December 2025</p>

        <div className='space-y-10'>
          <Section title='1. Introduction'>
            <p>
              Welcome to Push/Pull. We respect your privacy and are committed to
              protecting your personal information. This Privacy Policy explains
              how we collect, use, and safeguard your information when you use
              our mobile application and related services.
            </p>
          </Section>

          <Section title='2. Information We Collect'>
            <p className='mb-4'>
              We collect information that you provide directly to us:
            </p>
            <ul className='list-disc list-inside space-y-2 text-text-secondary'>
              <li>
                <strong className='text-text-primary'>
                  Account Information:
                </strong>{' '}
                Email address and profile details when you create an account.
              </li>
              <li>
                <strong className='text-text-primary'>Workout Data:</strong>{' '}
                Exercises, sets, reps, weights, and other fitness information
                you log.
              </li>
              <li>
                <strong className='text-text-primary'>
                  Device Information:
                </strong>{' '}
                Device type, operating system, and identifiers for app
                functionality.
              </li>
            </ul>
          </Section>

          <Section title='3. How We Use Your Information'>
            <p className='mb-4'>We use the information we collect to:</p>
            <ul className='list-disc list-inside space-y-2 text-text-secondary'>
              <li>Provide, maintain, and improve our services</li>
              <li>Sync your workout data across devices</li>
              <li>Send you important updates about the app</li>
              <li>Respond to your support requests</li>
            </ul>
          </Section>

          <Section title='4. Data Security'>
            <p>
              We implement appropriate security measures to protect your
              personal information. Your data is encrypted in transit and at
              rest. We store your data on secure cloud infrastructure with
              regular security monitoring.
            </p>
          </Section>

          <Section title='5. Your Rights'>
            <p className='mb-4'>You have the right to:</p>
            <ul className='list-disc list-inside space-y-2 text-text-secondary'>
              <li>Access the personal data we hold about you</li>
              <li>Request correction of inaccurate data</li>
              <li>Request deletion of your data</li>
              <li>Export your workout data</li>
            </ul>
          </Section>

          <Section title='6. Children&apos;s Privacy'>
            <p>
              Our service is not intended for children under 13 years of age. We
              do not knowingly collect personal information from children under
              13. If we discover that a child under 13 has provided us with
              personal information, we will delete it immediately.
            </p>
          </Section>

          <Section title='7. Changes to This Policy'>
            <p>
              We may update this Privacy Policy from time to time. We will
              notify you of significant changes by posting the new policy on this page and updating the
              &quot;Last Updated&quot; date.
            </p>
          </Section>

          <Section title='8. Contact Us'>
            <p>
              If you have questions about this Privacy Policy, please contact us
              at:{' '}
              <a
                href='mailto:help@push-pull.app'
                className='text-primary hover:underline'
              >
                help@push-pull.app
              </a>
            </p>
          </Section>
        </div>
      </div>
    </main>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className='text-xl font-semibold text-text-primary mb-4'>{title}</h2>
      <div className='text-text-secondary leading-relaxed'>{children}</div>
    </section>
  );
}
