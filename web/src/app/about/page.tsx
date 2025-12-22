import type { Metadata } from 'next';
import Link from 'next/link';

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://push-pull.app').replace(/\/+$/, '');
const defaultOgImage = '/SCREENSHOT_HOME.PNG';

export const metadata: Metadata = {
  title: 'About - Push/Pull',
  description:
    'About Push Pull: Gym Tracker, the social workout log with smart workouts, AI planning, and accountability.',
  alternates: {
    canonical: '/about',
  },
  openGraph: {
    title: 'About - Push/Pull',
    description:
      'About Push Pull: Gym Tracker, the social workout log with smart workouts, AI planning, and accountability.',
    url: `${siteUrl}/about`,
    type: 'website',
    images: [
      {
        url: defaultOgImage,
        width: 1200,
        height: 630,
        alt: 'Push Pull gym tracker preview',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'About - Push/Pull',
    description:
      'About Push Pull: Gym Tracker, the social workout log with smart workouts, AI planning, and accountability.',
    images: [defaultOgImage],
  },
};

const faqData = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [
    {
      '@type': 'Question',
      name: 'Is Push Pull free?',
      acceptedAnswer: {
        '@type': 'Answer',
        text:
          'Yes. You can log unlimited workouts, build up to 3 routines, and track progress for free. Pro unlocks unlimited planning, AI workout generation, and recovery insights.',
      },
    },
    {
      '@type': 'Question',
      name: 'Does it work for gym and home workouts?',
      acceptedAnswer: {
        '@type': 'Answer',
        text:
          'Yes. Push Pull supports strength and cardio sessions with flexible templates and goal-based planning.',
      },
    },
    {
      '@type': 'Question',
      name: 'How does the AI planning work?',
      acceptedAnswer: {
        '@type': 'Answer',
        text:
          'If you opt in, the AI suggests workouts based on your goals, equipment, and recent training history. You can edit anything before you start.',
      },
    },
  ],
};

export default function AboutPage() {
  return (
    <main className='min-h-screen bg-background'>
      <script type='application/ld+json'>{JSON.stringify(faqData)}</script>
      <div className='max-w-5xl mx-auto px-6 py-12'>
        <Link
          href='/'
          className='inline-flex items-center gap-2 text-text-secondary hover:text-text-primary transition-colors reveal'
          data-reveal
        >
          <svg className='w-4 h-4' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
            <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M15 19l-7-7 7-7' />
          </svg>
          Back to Home
        </Link>

        <header className='mt-8 reveal' data-reveal>
          <p className='text-sm uppercase tracking-[0.3em] text-text-secondary'>About Push Pull</p>
          <h1 className='text-4xl sm:text-5xl font-bold text-text-primary mt-3 font-display'>
            A gym tracker built by lifters who wanted a cleaner log.
          </h1>
          <p className='text-lg text-text-secondary mt-4 max-w-3xl'>
            Push Pull: Gym Tracker is a social workout log and strength training planner that keeps your workouts
            simple, structured, and personalized to your goals. Log sets instantly, track progress over time, and stay
            motivated with squads and shared routines.
          </p>
        </header>

        <section
          className='mt-10 rounded-3xl border border-border/60 bg-surface/70 p-6 sm:p-8 shadow-[0_24px_70px_rgba(5,8,22,0.25)] backdrop-blur reveal'
          data-reveal
        >
          <h2 className='text-2xl font-semibold text-text-primary'>Why Push Pull exists</h2>
          <p className='text-text-secondary mt-3'>
            We built Push Pull because most trackers were slow, cluttered, or easy to ignore. The goal is to make
            training feel obvious again: faster logging, clearer progress, and a community that keeps you consistent
            without the noise.
          </p>
          <p className='text-text-secondary mt-3'>
            Whether you train at the gym or at home, Push Pull keeps routines flexible and results visible. You decide
            how social you want to be, and you can opt into AI planning when you want help.
          </p>
        </section>

        <section
          className='mt-8 rounded-3xl border border-border/60 bg-surface/70 p-6 sm:p-8 shadow-[0_24px_70px_rgba(5,8,22,0.25)] backdrop-blur reveal'
          data-reveal
        >
          <h2 className='text-2xl font-semibold text-text-primary'>FAQ</h2>
          <div className='mt-4 space-y-5 text-text-secondary'>
            <div>
              <h3 className='text-base font-semibold text-text-primary'>Is Push Pull free?</h3>
              <p className='mt-1'>
                Yes. You can log unlimited workouts, build up to 3 routines, and track progress for free. Pro unlocks
                unlimited planning, AI workout generation, and recovery insights.
              </p>
            </div>
            <div>
              <h3 className='text-base font-semibold text-text-primary'>Does it work for gym and home workouts?</h3>
              <p className='mt-1'>
                Yes. Push Pull supports strength and cardio sessions with flexible templates and goal-based planning.
              </p>
            </div>
            <div>
              <h3 className='text-base font-semibold text-text-primary'>How does the AI planning work?</h3>
              <p className='mt-1'>
                If you opt in, the AI suggests workouts based on your goals, equipment, and recent training history.
                You can edit anything before you start.
              </p>
            </div>
          </div>
        </section>

        <section
          className='mt-8 rounded-3xl border border-border/60 bg-surface/70 p-6 sm:p-8 shadow-[0_24px_70px_rgba(5,8,22,0.25)] backdrop-blur reveal'
          data-reveal
        >
          <h2 className='text-2xl font-semibold text-text-primary'>Ready to train smarter?</h2>
          <p className='text-text-secondary mt-3'>
            Push Pull is in private beta testing. Join the waitlist and we will reach out as spots open up.
          </p>
          <div className='mt-6'>
            <Link
              href='/#waitlist'
              className='inline-flex items-center justify-center px-5 py-3 rounded-xl bg-white text-background font-semibold shadow-sm hover:shadow-md transition-shadow'
            >
              Join the private beta waitlist
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
