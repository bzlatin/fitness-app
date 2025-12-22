import type { Metadata } from 'next';
import Link from 'next/link';

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://push-pull.app').replace(/\/+$/, '');
const defaultOgImage = '/SCREENSHOT_HOME.PNG';

export const metadata: Metadata = {
  title: 'Terms of Service - Push/Pull',
  description: 'Terms of Service for the Push/Pull workout tracking app.',
  alternates: {
    canonical: '/terms',
  },
  openGraph: {
    title: 'Terms of Service - Push/Pull',
    description: 'Terms of Service for the Push/Pull workout tracking app.',
    url: `${siteUrl}/terms`,
    type: 'website',
    images: [
      {
        url: defaultOgImage,
        width: 1200,
        height: 630,
        alt: 'Push/Pull terms of service',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Terms of Service - Push/Pull',
    description: 'Terms of Service for the Push/Pull workout tracking app.',
    images: [defaultOgImage],
  },
};

export default function TermsOfService() {
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
          Terms of Service
        </h1>
        <p className='text-text-secondary mb-10'>Last Updated: December 2025</p>

        <div className='space-y-10'>
          <Section title='1. Acceptance of Terms'>
            <p>
              By accessing or using Push/Pull, you agree to be bound by these
              Terms of Service. If you disagree with any part of these terms,
              you may not access the service.
            </p>
          </Section>

          <Section title='2. Description of Service'>
            <p>
              Push/Pull is a workout tracking and analytics application designed
              to help users log their fitness activities and track progress over
              time. The service includes mobile applications and related
              features.
            </p>
          </Section>

          <Section title='3. User Accounts'>
            <p className='mb-4'>
              When you create an account, you must provide accurate information.
              You are responsible for:
            </p>
            <ul className='list-disc list-inside space-y-2 text-text-secondary'>
              <li>
                Maintaining the confidentiality of your account credentials
              </li>
              <li>All activities that occur under your account</li>
              <li>Notifying us immediately of any unauthorized use</li>
            </ul>
          </Section>

          <Section title='4. Acceptable Use'>
            <p className='mb-4'>You agree not to:</p>
            <ul className='list-disc list-inside space-y-2 text-text-secondary'>
              <li>Use the service in any way that violates applicable laws</li>
              <li>
                Attempt to gain unauthorized access to any part of the service
              </li>
              <li>Interfere with or disrupt the service</li>
              <li>Transmit any malicious code or harmful content</li>
            </ul>
          </Section>

          <Section title='5. Intellectual Property'>
            <p>
              The service and its original content, features, and functionality
              are the exclusive property of Push/Pull. The service is protected
              by copyright, trademark, and other laws.
            </p>
          </Section>

          <Section title='6. User Content'>
            <p>
              You retain ownership of any workout data you submit to the
              service. By submitting content, you grant us a license to use,
              store, and process that content solely for providing the service.
              You may export or delete your data at any time.
            </p>
          </Section>

          <Section title='7. Subscriptions and Purchases'>
            <p className='mb-4'>
              Push/Pull may offer optional auto-renewing subscriptions (for
              example, a monthly or annual Pro plan) that unlock additional
              features.
            </p>
            <ul className='list-disc list-inside space-y-2 text-text-secondary'>
              <li>
                <strong className='text-text-primary'>Duration:</strong>{' '}
                Subscription terms may be monthly or annual, as shown at the
                time of purchase.
              </li>
              <li>
                <strong className='text-text-primary'>Auto-renewal:</strong>{' '}
                Subscriptions automatically renew unless cancelled at least 24
                hours before the end of the current period.
              </li>
              <li>
                <strong className='text-text-primary'>Cancellation:</strong>{' '}
                You can manage or cancel your subscription in your Apple ID / App
                Store account settings.
              </li>
              <li>
                <strong className='text-text-primary'>Refunds:</strong>{' '}
                Purchases and refunds are handled by Apple in accordance with
                their policies.
              </li>
              <li>
                <strong className='text-text-primary'>Price changes:</strong>{' '}
                Pricing may vary by region and may change over time. Any price
                changes and renewal terms are handled by Apple and will be
                presented to you as required.
              </li>
              <li>
                <strong className='text-text-primary'>Payment:</strong>{' '}
                Payment is processed by Apple for purchases made on iOS. We do
                not collect or store your payment card details.
              </li>
            </ul>
            <p className='mt-4'>
              If a free trial is offered, the trial terms will be displayed at
              the time of purchase.
            </p>
          </Section>

          <Section title='8. Disclaimers'>
            <p className='mb-4'>Important disclaimers:</p>
            <ul className='list-disc list-inside space-y-2 text-text-secondary'>
              <li>
                <strong className='text-text-primary'>
                  Not Medical Advice:
                </strong>{' '}
                The service is for informational purposes only and is not a
                substitute for professional medical advice.
              </li>
              <li>
                <strong className='text-text-primary'>
                  Exercise at Your Own Risk:
                </strong>{' '}
                Physical exercise carries inherent risks. Consult a healthcare
                professional before starting any exercise program.
              </li>
              <li>
                <strong className='text-text-primary'>No Guarantees:</strong> We
                do not guarantee any specific fitness results.
              </li>
            </ul>
          </Section>

          <Section title='9. Limitation of Liability'>
            <p>
              To the maximum extent permitted by law, Push/Pull shall not be
              liable for any indirect, incidental, special, consequential, or
              punitive damages resulting from your use of the service.
            </p>
          </Section>

          <Section title='10. Termination'>
            <p>
              We may terminate or suspend your account at any time for
              violations of these terms. Upon termination, your right to use the
              service will cease immediately. You may delete your account at any
              time.
            </p>
          </Section>

          <Section title='11. Changes to Terms'>
            <p>
              We reserve the right to modify these terms at any time. We will
              notify you of material changes. Continued use of the service after
              changes constitutes acceptance of the new terms.
            </p>
          </Section>

          <Section title='12. Contact Us'>
            <p>
              If you have questions about these Terms, please contact us at:{' '}
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
