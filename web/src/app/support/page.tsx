import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Support - Push/Pull',
  description: 'Support and contact information for the Push/Pull workout tracking app.',
};

const SUPPORT_EMAIL = 'help@push-pull.app';

export default function SupportPage() {
  return (
    <main className='min-h-screen bg-background'>
      <div className='max-w-3xl mx-auto px-6 py-12'>
        <Link
          href='/'
          className='inline-flex items-center gap-2 text-text-secondary hover:text-text-primary transition-colors mb-8'
        >
          <svg className='w-4 h-4' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
            <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M15 19l-7-7 7-7' />
          </svg>
          Back to Home
        </Link>

        <h1 className='text-3xl sm:text-4xl font-bold text-text-primary mb-2'>Support</h1>
        <p className='text-text-secondary mb-10'>
          Need help with Push/Pull? Start here and we&apos;ll get you unstuck fast.
        </p>

        <div className='space-y-10'>
          <Section title='Contact'>
            <p>
              Email us at{' '}
              <a href={`mailto:${SUPPORT_EMAIL}`} className='text-primary hover:underline'>
                {SUPPORT_EMAIL}
              </a>
              .
            </p>
            <p className='mt-3'>
              For quicker help, include: your device (iOS/Android), app version, and what you expected vs what
              happened.
            </p>
          </Section>

          <Section title='Common fixes'>
            <ul className='list-disc list-inside space-y-2 text-text-secondary'>
              <li>Force-quit and reopen the app.</li>
              <li>Confirm you&apos;re on the latest app version.</li>
              <li>Check that you&apos;re logged into the correct account.</li>
              <li>If syncing looks stuck, try toggling airplane mode on/off and retry.</li>
            </ul>
          </Section>

          <Section title='Account & Data'>
            <p className='mb-4'>You can request:</p>
            <ul className='list-disc list-inside space-y-2 text-text-secondary'>
              <li>Data export</li>
              <li>Account deletion</li>
              <li>Corrections to profile details</li>
            </ul>
            <p className='mt-4'>
              Send the request to{' '}
              <a href={`mailto:${SUPPORT_EMAIL}`} className='text-primary hover:underline'>
                {SUPPORT_EMAIL}
              </a>
              .
            </p>
          </Section>

          <Section title='Billing'>
            <p>
              If you have issues with upgrades or restore purchases, email{' '}
              <a href={`mailto:${SUPPORT_EMAIL}`} className='text-primary hover:underline'>
                {SUPPORT_EMAIL}
              </a>{' '}
              and include a screenshot of the subscription screen.
            </p>
          </Section>

          <Section title='Legal'>
            <p className='text-text-secondary'>
              <Link href='/terms' className='text-primary hover:underline'>
                Terms of Service
              </Link>{' '}
              ·{' '}
              <Link href='/privacy' className='text-primary hover:underline'>
                Privacy Policy
              </Link>
            </p>
          </Section>
        </div>
      </div>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className='text-xl font-semibold text-text-primary mb-4'>{title}</h2>
      <div className='text-text-secondary leading-relaxed'>{children}</div>
    </section>
  );
}

