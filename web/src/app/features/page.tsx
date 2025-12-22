import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://push-pull.app').replace(/\/+$/, '');
const defaultOgImage = '/SCREENSHOT_HOME.PNG';

export const metadata: Metadata = {
  title: 'Features - Push/Pull',
  description:
    'Push/Pull keeps workout tracking simple with fast logging, clear progress, social accountability, and AI planning.',
  alternates: {
    canonical: '/features',
  },
  openGraph: {
    title: 'Features - Push/Pull',
    description:
      'Push/Pull keeps workout tracking simple with fast logging, clear progress, social accountability, and AI planning.',
    url: `${siteUrl}/features`,
    type: 'website',
    images: [
      {
        url: defaultOgImage,
        width: 1200,
        height: 630,
        alt: 'Push/Pull features preview',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Features - Push/Pull',
    description:
      'Push/Pull keeps workout tracking simple with fast logging, clear progress, social accountability, and AI planning.',
    images: [defaultOgImage],
  },
};

const Screenshot = ({ src, alt, caption }: { src: string; alt: string; caption?: string }) => (
  <figure className='rounded-3xl border border-border/60 bg-surface/70 p-4 shadow-[0_20px_60px_rgba(5,8,22,0.25)]'>
    <div className='rounded-2xl bg-background/60 p-3'>
      <div className='max-h-[320px] sm:max-h-[380px] lg:max-h-[420px] flex items-center justify-center'>
        <Image
          src={src}
          alt={alt}
          width={1200}
          height={2000}
          sizes='(min-width: 1024px) 420px, 100vw'
          className='w-full h-auto max-h-[320px] sm:max-h-[380px] lg:max-h-[420px] rounded-xl object-contain'
        />
      </div>
    </div>
    {caption && <figcaption className='text-sm text-text-secondary mt-3'>{caption}</figcaption>}
  </figure>
);

const BetaCta = () => (
  <div className='flex flex-col sm:flex-row gap-3 items-start sm:items-center'>
    <Link
      href='/#waitlist'
      className='inline-flex items-center justify-center px-5 py-3 rounded-xl bg-white text-background font-semibold shadow-sm hover:shadow-md transition-shadow'
    >
      Join the private beta waitlist
    </Link>
    <span className='text-sm text-text-secondary'>Private beta testing now. Public launch coming soon.</span>
  </div>
);

export default function FeaturesPage() {
  return (
    <main className='min-h-screen bg-background'>
      <div className='max-w-6xl mx-auto px-6 py-12'>
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

        <header className='mt-8 max-w-3xl reveal' data-reveal>
          <p className='text-sm uppercase tracking-[0.3em] text-text-secondary'>Features</p>
          <h1 className='text-4xl sm:text-5xl font-bold text-text-primary mt-3 font-display'>
            Push/Pull keeps tracking fast, clear, and social when you want it.
          </h1>
          <p className='text-lg text-text-secondary mt-4'>
            Built by a lifter who wanted fewer taps and more progress. Use the pieces that help you and skip the rest.
          </p>
          <p className='text-text-secondary mt-4'>
            Push Pull: Gym Tracker is a social workout log and strength training planner that helps you stay
            consistent, build smarter routines, and track real progress with AI-powered programming and community
            motivation. Train at the gym or at home with workouts tailored to your goals.
          </p>
          <div className='mt-6 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-2 text-sm text-primary'>
            Private beta testing now. Public launch coming soon.
          </div>
        </header>

          <div className='mt-8 flex flex-wrap gap-3 text-sm text-text-secondary reveal' data-reveal>
            <Link
              href='#tracking'
              className='rounded-full border border-border/60 bg-surface/60 px-4 py-2 hover:border-primary/40 hover:text-text-primary transition'
            >
              Tracking
            </Link>
            <Link
              href='#squads'
              className='rounded-full border border-border/60 bg-surface/60 px-4 py-2 hover:border-primary/40 hover:text-text-primary transition'
            >
              Squads
            </Link>
            <Link
              href='#ai'
              className='rounded-full border border-border/60 bg-surface/60 px-4 py-2 hover:border-primary/40 hover:text-text-primary transition'
            >
              AI Planning
            </Link>
            <Link
              href='#recovery'
              className='rounded-full border border-border/60 bg-surface/60 px-4 py-2 hover:border-primary/40 hover:text-text-primary transition'
            >
              Recovery
            </Link>
            <Link
              href='#templates'
              className='rounded-full border border-border/60 bg-surface/60 px-4 py-2 hover:border-primary/40 hover:text-text-primary transition'
            >
              Templates
            </Link>
            <Link
              href='#pricing'
              className='rounded-full border border-border/60 bg-surface/60 px-4 py-2 hover:border-primary/40 hover:text-text-primary transition'
            >
              Pricing
            </Link>
          </div>

          <section
            id='tracking'
            className='mt-12 rounded-3xl border border-border/60 bg-surface/70 p-6 sm:p-8 shadow-[0_24px_70px_rgba(5,8,22,0.35)] backdrop-blur reveal'
            data-reveal
          >
            <div className='grid gap-6 md:grid-cols-[1.1fr_0.9fr] items-start'>
              <div>
                <h2 className='text-2xl font-semibold text-text-primary'>Clear progress tracking</h2>
                <p className='text-text-secondary mt-3'>
                  Log sets quickly, review history in seconds, and see what changed from last week. It is the fastest path
                  from workout to insight.
                </p>
                <ul className='list-disc list-inside text-text-secondary mt-4 space-y-2'>
                  <li>One-tap logging for weight and reps</li>
                  <li>Simple progress history you can scan</li>
                  <li>Notes that help you remember what mattered</li>
                </ul>
              </div>
              <Screenshot
                src='/SCREENSHOT_HISTORY_CALENDAR.PNG'
                alt='Push/Pull workout history calendar with recent sessions'
                caption='Progress history stays easy to scan.'
              />
            </div>
          </section>

          <section
            id='squads'
            className='mt-12 rounded-3xl border border-border/60 bg-surface/70 p-6 sm:p-8 shadow-[0_24px_70px_rgba(5,8,22,0.35)] backdrop-blur reveal'
            data-reveal
          >
            <div className='grid gap-6 md:grid-cols-[0.9fr_1.1fr] items-start'>
              <div className='order-2 lg:order-1'>
                <Screenshot
                  src='/SCREENSHOT_SQUADS_FEED.PNG'
                  alt='Push/Pull squads feed with workout check-ins'
                  caption='Small-group accountability without the noise.'
                />
              </div>
              <div className='order-1 lg:order-2'>
                <h2 className='text-2xl font-semibold text-text-primary'>Squads that keep you consistent</h2>
                <p className='text-text-secondary mt-3'>
                  Stay accountable with a small group of friends. See their check-ins, react quickly, and keep showing up
                  without pressure.
                </p>
                <ul className='list-disc list-inside text-text-secondary mt-4 space-y-2'>
                  <li>Small groups instead of noisy feeds</li>
                  <li>Quick reactions and supportive comments</li>
                  <li>Celebrate consistency, not just PRs</li>
                </ul>
              </div>
            </div>
          </section>

          <section
            id='ai'
            className='mt-12 rounded-3xl border border-border/60 bg-surface/70 p-6 sm:p-8 shadow-[0_24px_70px_rgba(5,8,22,0.35)] backdrop-blur reveal'
            data-reveal
          >
            <div className='grid gap-6 md:grid-cols-[1.1fr_0.9fr] items-start'>
              <div>
                <h2 className='text-2xl font-semibold text-text-primary'>AI-powered workout generation</h2>
                <p className='text-text-secondary mt-3'>
                  If you want help planning, Push/Pull can generate workouts based on your goals, equipment, and fatigue.
                  It is optional, practical, and built to reduce decision fatigue.
                </p>
                <ul className='list-disc list-inside text-text-secondary mt-4 space-y-2'>
                  <li>Personalized workouts in seconds</li>
                  <li>Flexible enough to edit on the fly</li>
                  <li>Designed to keep training sustainable</li>
                </ul>
              </div>
              <Screenshot
                src='/SCREENSHOT_HOME.PNG'
                alt='Push/Pull home screen with suggested workout'
                caption='AI suggestions stay flexible and easy to edit.'
              />
            </div>
          </section>

          <section
            id='recovery'
            className='mt-12 rounded-3xl border border-border/60 bg-surface/70 p-6 sm:p-8 shadow-[0_24px_70px_rgba(5,8,22,0.35)] backdrop-blur reveal'
            data-reveal
          >
            <div className='grid gap-6 md:grid-cols-[0.9fr_1.1fr] items-start'>
              <div className='order-2 lg:order-1'>
                <Screenshot
                  src='/SCREENSHOT_RECOVERY.PNG'
                  alt='Push/Pull recovery heatmap showing muscle fatigue'
                  caption='Spot fatigue patterns with a clean recovery heatmap.'
                />
              </div>
              <div className='order-1 lg:order-2'>
                <h2 className='text-2xl font-semibold text-text-primary'>Recovery heatmap and fatigue notes</h2>
                <p className='text-text-secondary mt-3'>
                  Recovery matters. Push/Pull highlights where fatigue is building so you can train smarter without
                  getting stuck in spreadsheets.
                </p>
                <ul className='list-disc list-inside text-text-secondary mt-4 space-y-2'>
                  <li>Quick recovery check-ins after sessions</li>
                  <li>Body heatmap to spot overworked areas</li>
                  <li>Simple notes that guide your next session</li>
                </ul>
              </div>
            </div>
          </section>

          <section
            id='templates'
            className='mt-12 rounded-3xl border border-border/60 bg-surface/70 p-6 sm:p-8 shadow-[0_24px_70px_rgba(5,8,22,0.35)] backdrop-blur reveal'
            data-reveal
          >
            <div className='grid gap-6 md:grid-cols-[1.1fr_0.9fr] items-start'>
              <div>
                <h2 className='text-2xl font-semibold text-text-primary'>Custom workouts without friction</h2>
                <p className='text-text-secondary mt-3'>
                  Build routines that match how you train. Save templates, swap exercises, and keep each session flexible.
                </p>
                <ul className='list-disc list-inside text-text-secondary mt-4 space-y-2'>
                  <li>Flexible templates for any split</li>
                  <li>Quick edits for new equipment</li>
                  <li>Simple notes that carry over</li>
                </ul>
              </div>
              <Screenshot
                src='/SCREENSHOT_WORKOUT_LOG.PNG'
                alt='Push/Pull custom workout builder and log'
                caption='Templates stay easy to edit and repeat.'
              />
            </div>
          </section>

          <section
            id='pricing'
            className='mt-12 rounded-3xl border border-border/60 bg-surface/70 p-6 sm:p-8 shadow-[0_24px_70px_rgba(5,8,22,0.35)] backdrop-blur reveal'
            data-reveal
          >
            <h2 className='text-2xl font-semibold text-text-primary'>Free and Pro features</h2>
            <p className='text-text-secondary mt-3'>
              Start for free and upgrade to Pro for unlimited planning, AI programming, and recovery insights.
            </p>
            <div className='mt-6 grid gap-6 md:grid-cols-2'>
              <div>
                <p className='text-sm uppercase tracking-[0.2em] text-text-secondary mb-3'>Free features</p>
                <ul className='list-disc list-inside text-text-secondary space-y-2'>
                  <li>Log unlimited workouts with 800+ strength and cardio exercises</li>
                  <li>Create up to 3 custom routines and templates</li>
                  <li>Track sets, reps, and weight with progressive overload support</li>
                  <li>Join squads and share workouts for accountability</li>
                  <li>Follow friends and view real-time activity feeds</li>
                  <li>Review history, streaks, and training trends</li>
                </ul>
              </div>
              <div>
                <p className='text-sm uppercase tracking-[0.2em] text-text-secondary mb-3'>Pro features</p>
                <ul className='list-disc list-inside text-text-secondary space-y-2'>
                  <li>Unlimited routine templates and planning</li>
                  <li>AI workout generation tailored to your goals and experience level</li>
                  <li>Recovery and fatigue indicators for smarter strength training</li>
                  <li>Personalized progression recommendations</li>
                  <li>Muscle group balance and analytics for optimized results</li>
                </ul>
                <div className='mt-4 text-text-secondary'>
                  <p className='font-semibold text-text-primary'>Subscription pricing</p>
                  <p>Monthly: $4.99</p>
                  <p>Annual: $49.99 (17% savings)</p>
                  <p className='mt-3 text-sm'>
                    Subscriptions renew automatically unless canceled at least 24 hours before the end of the current
                    period. Manage or cancel anytime in Account Settings.
                  </p>
                </div>
              </div>
            </div>
          </section>

        <section
          className='mt-16 rounded-3xl border border-border/60 bg-surface/70 p-8 shadow-[0_24px_70px_rgba(5,8,22,0.25)] backdrop-blur reveal'
          data-reveal
        >
          <div className='max-w-2xl'>
            <h2 className='text-2xl font-semibold text-text-primary'>Join the private beta</h2>
            <p className='text-text-secondary mt-3'>
              Push/Pull is in private beta testing. If you want flexible workout tracking, social motivation, AI
              planning support, and clear progress, join the waitlist and we will reach out as spots open up.
            </p>
            <div className='mt-6'>
              <BetaCta />
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
