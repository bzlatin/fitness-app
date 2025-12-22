import type { ReactNode } from 'react';
import Image from 'next/image';
import Link from 'next/link';

export type BlogPost = {
  slug: string;
  title: string;
  seoTitle: string;
  description: string;
  metaDescription: string;
  keywords: string[];
  readTime: string;
  tags: string[];
  published: string;
  content: () => ReactNode;
};

const InlineLink = ({ href, children }: { href: string; children: ReactNode }) => (
  <Link href={href} className='text-primary hover:underline'>
    {children}
  </Link>
);

const Screenshot = ({
  src,
  alt,
  caption,
  align = 'right',
}: {
  src: string;
  alt: string;
  caption?: string;
  align?: 'left' | 'right';
}) => (
  <figure
    className={`rounded-3xl border border-border/60 bg-surface/70 p-4 shadow-[0_20px_60px_rgba(5,8,22,0.25)] md:w-[45%] ${
      align === 'left'
        ? 'md:float-left md:mr-6 md:mt-2 md:mb-6'
        : 'md:float-right md:ml-6 md:mt-2 md:mb-6'
    }`}
  >
    <div className='rounded-2xl bg-background/60 p-3'>
      <div className='max-h-[320px] sm:max-h-[380px] lg:max-h-[420px] flex items-center justify-center'>
        <Image
          src={src}
          alt={alt}
          width={1200}
          height={2000}
          sizes='(min-width: 1024px) 460px, 100vw'
          className='w-full h-auto max-h-[320px] sm:max-h-[380px] lg:max-h-[420px] rounded-xl object-contain'
        />
      </div>
    </div>
    {caption && <figcaption className='text-sm text-text-secondary mt-3'>{caption}</figcaption>}
  </figure>
);

const Callout = ({ title, children }: { title: string; children: ReactNode }) => (
  <div className='rounded-2xl border border-primary/30 bg-primary/10 p-5'>
    <div className='text-sm font-semibold text-primary uppercase tracking-[0.2em]'>{title}</div>
    <div className='mt-3 text-text-primary'>{children}</div>
  </div>
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

export const posts: BlogPost[] = [
  {
    slug: 'not-logging-workouts-missing-gains',
    title: 'Not Logging Workouts Costs You Gains: The Simple Fix That Works',
    seoTitle: 'Not Logging Workouts Costs You Gains: The Simple Fix That Works',
    description:
      'If you are not tracking sets, reps, and weight, you are leaving progress on the table. Here is a clean, low-friction way to log.',
    metaDescription:
      'Not logging workouts costs you gains. Learn the simple workout logging system that boosts consistency, progressive overload, and results.',
    keywords: [
      'workout logging',
      'track workouts',
      'workout tracker app',
      'progressive overload',
      'strength training log',
      'gym tracker',
      'how to log workouts',
    ],
    readTime: '7 min read',
    tags: ['Tracking', 'Progress', 'Habits'],
    published: 'Mar 12, 2025',
    content: () => (
      <>
        <p className='text-lg text-text-secondary'>
          If you are not logging your workouts, you are training on guesswork. You might feel busy, but you are missing
          the tiny adjustments that drive real gains.
        </p>
        <p className='text-text-secondary'>
          Logging is not about spreadsheets. It is about knowing what you did last time so you can do a little more
          next time. That is progressive overload in its simplest form, and it is the fastest route to consistent
          results.
        </p>
        <p className='text-text-secondary'>
          <InlineLink href='/'>Push/Pull gym tracker app</InlineLink>
        </p>

        <h2 className='text-2xl font-semibold text-text-primary mt-12 mb-4'>The real cost of not logging workouts</h2>
        <p className='text-text-secondary'>When you do not log, three things happen:</p>
        <ul className='list-disc list-inside text-text-secondary mt-4 space-y-2'>
          <li>You repeat the same weights and reps without realizing it.</li>
          <li>You forget what worked, so every session starts from scratch.</li>
          <li>You cannot spot trends in strength or fatigue.</li>
        </ul>
        <p className='text-text-secondary mt-4'>
          The result is slow progress and wasted effort. Logging is the small habit that keeps your training honest.
        </p>

        <h2 className='text-2xl font-semibold text-text-primary mt-12 mb-4'>What to log (keep it simple)</h2>
        <p className='text-text-secondary'>You only need a few data points to make progress:</p>
        <ul className='list-disc list-inside text-text-secondary mt-4 space-y-2'>
          <li>Exercise name</li>
          <li>Weight</li>
          <li>Reps</li>
          <li>Sets</li>
          <li>Optional notes for effort or form</li>
        </ul>
        <p className='text-text-secondary mt-4'>If your log captures these five, you are covered.</p>

        <div className='mt-6 md:mt-2 md:contents'>
          <Screenshot
            src='/SCREENSHOT_WORKOUT_LOG.PNG'
            alt='Push/Pull workout log showing a simple set and rep tracker'
            caption='A clean log makes progressive overload easy to spot.'
            align='right'
          />
        </div>

        <h2 className='text-2xl font-semibold text-text-primary mt-12 mb-4'>A low-friction logging system</h2>
        <Callout title='The 3-Step Log'>
          <ol className='list-decimal list-inside space-y-2 text-text-primary'>
            <li>Save a template once for your main lifts.</li>
            <li>Log sets as you go with quick taps.</li>
            <li>Review last week before you start.</li>
          </ol>
        </Callout>
        <p className='text-text-secondary mt-4'>
          The key is speed. If logging takes more than a few seconds, you will skip it. Build a system that takes
          almost no willpower.
        </p>

        <h2 className='text-2xl font-semibold text-text-primary mt-12 mb-4'>How logging unlocks progressive overload</h2>
        <p className='text-text-secondary'>
          Progressive overload is simple: do a little more than last time. Without a log, you are guessing. With a log,
          you can plan the next small win: one extra rep, 2.5 lb more, or a cleaner set.
        </p>
        <p className='text-text-secondary mt-2'>
          <InlineLink href='/features#tracking'>Clear progress tracking</InlineLink>
        </p>

        <div className='mt-6 md:mt-2 md:contents'>
          <Screenshot
            src='/SCREENSHOT_HISTORY_CALENDAR.PNG'
            alt='Push/Pull workout history calendar with recent sessions'
            caption='History makes progress visible and keeps momentum alive.'
            align='left'
          />
        </div>

        <h2 className='text-2xl font-semibold text-text-primary mt-12 mb-4'>Why consistency beats intensity</h2>
        <p className='text-text-secondary'>
          People overestimate what they can do in one week and underestimate what they can do in twelve. Logging keeps
          you consistent, and consistency is where gains live.
        </p>
        <p className='text-text-secondary mt-2'>
          If you are training with friends, a quick check-in helps even more.
          <span className='ml-1'>
            <InlineLink href='/features#squads'>Squads and accountability</InlineLink>
          </span>
        </p>

        <h2 className='text-2xl font-semibold text-text-primary mt-12 mb-4'>FAQ</h2>
        <div className='space-y-6'>
          <div>
            <h3 className='text-lg font-semibold text-text-primary'>Do I need a workout tracker app to log?</h3>
            <p className='text-text-secondary mt-2'>No, but an app makes it faster and more consistent.</p>
          </div>
          <div>
            <h3 className='text-lg font-semibold text-text-primary'>How often should I log workouts?</h3>
            <p className='text-text-secondary mt-2'>Every session. The habit only works when it is automatic.</p>
          </div>
          <div>
            <h3 className='text-lg font-semibold text-text-primary'>What if I miss a workout?</h3>
            <p className='text-text-secondary mt-2'>Log the next one. Consistency wins over perfection.</p>
          </div>
        </div>

        <div className='mt-12 rounded-3xl border border-border/60 bg-surface/60 p-6'>
          <h2 className='text-2xl font-semibold text-text-primary'>Ready to log without friction?</h2>
          <p className='text-text-secondary mt-3'>
            Push/Pull is in private beta testing. It is a social-first gym tracker with fast logging, clear progress
            history, squads for accountability, and optional AI planning. Join the waitlist and we will reach out as
            spots open up.
          </p>
          <div className='mt-6'>
            <BetaCta />
          </div>
        </div>
      </>
    ),
  },
  {
    slug: 'best-gym-tracker-app',
    title: 'Best Gym Tracker App: How to Choose One You Will Actually Use',
    seoTitle: 'Best Gym Tracker App: How to Choose One You Will Actually Use',
    description:
      'A simple checklist and 5-minute test to find a tracker that fits your lifting style and keeps you consistent.',
    metaDescription:
      'Find the best gym tracker app for strength training with a simple checklist and 5-minute test. Learn what matters most.',
    keywords: [
      'best gym tracker app',
      'workout tracker app',
      'strength training tracker',
      'workout tracker for strength training',
      'gym tracking app',
      'progressive overload tracking',
    ],
    readTime: '9 min read',
    tags: ['Tracking', 'Strength', 'Progress'],
    published: 'Mar 10, 2025',
    content: () => (
      <>
        <p className='text-lg text-text-secondary'>
          If you have ever left the gym and realized you forgot the weights you used, you are not alone. The
          problem is not motivation. It is friction. Most trackers make you do too much work before you get
          any value.
        </p>
        <p className='text-text-secondary'>
          I built Push/Pull because I wanted a log that is fast, flexible, and actually helps you improve. Push/Pull
          is a social-first gym tracker with an AI workout generator and clear progress history. This guide is the
          simplest way I know to pick the best gym tracker app for real life.
        </p>
        <p className='text-text-secondary'>
          <InlineLink href='/'>Push/Pull gym tracker app</InlineLink>
        </p>

        <h2 className='text-2xl font-semibold text-text-primary mt-12 mb-4'>What &quot;best&quot; really means for a gym tracker</h2>
        <p className='text-text-secondary'>
          A gym tracker is only useful if you actually use it. That means the best app is the one that fits your
          routine and keeps you consistent.
        </p>
        <ul className='list-disc list-inside text-text-secondary mt-4 space-y-2'>
          <li>Fast logging with minimal taps</li>
          <li>Custom workouts that match how you train</li>
          <li>Clear progress history you can read at a glance</li>
          <li>Built-in support for progressive overload</li>
          <li>Optional accountability (friends or a small group)</li>
        </ul>
        <p className='text-text-secondary mt-4'>If an app misses two or more of these, it will probably sit on your phone unused.</p>

        <h2 className='text-2xl font-semibold text-text-primary mt-12 mb-4'>A simple framework: the 5-minute test</h2>
        <Callout title='The 5-Minute Test'>
          <ol className='list-decimal list-inside space-y-2 text-text-primary'>
            <li>Create a workout template in under 2 minutes.</li>
            <li>Log a set with weight and reps in under 10 seconds.</li>
            <li>Find your last workout history in under 15 seconds.</li>
            <li>Adjust today&apos;s plan without starting over.</li>
            <li>See progress in a way that makes sense to you.</li>
          </ol>
        </Callout>
        <p className='text-text-secondary mt-4'>If it fails the test, move on. Time in the gym is too valuable.</p>

        <h2 className='text-2xl font-semibold text-text-primary mt-12 mb-4'>What to track for strength training (without overthinking)</h2>
        <p className='text-text-secondary'>You do not need to track everything. Start with the basics:</p>
        <ul className='list-disc list-inside text-text-secondary mt-4 space-y-2'>
          <li>Exercise name</li>
          <li>Weight</li>
          <li>Reps</li>
          <li>Sets</li>
          <li>Optional note for effort or form</li>
        </ul>
        <p className='text-text-secondary mt-4'>That is enough to spot trends and push for small improvements.</p>

        <div className='mt-6 md:mt-2 md:contents'>
          <Screenshot
            src='/SCREENSHOT_WORKOUT_LOG.PNG'
            alt='Push/Pull workout log screen showing sets and reps'
            caption='Workout logging stays fast so you can focus on lifting.'
            align='right'
          />
        </div>

        <h2 className='text-2xl font-semibold text-text-primary mt-12 mb-4'>Gym tracking vs pen and paper</h2>
        <p className='text-text-secondary'>A notebook can work, but it has two gaps:</p>
        <ul className='list-disc list-inside text-text-secondary mt-4 space-y-2'>
          <li>It does not surface trends automatically.</li>
          <li>It is easy to lose, forget, or abandon.</li>
        </ul>
        <p className='text-text-secondary mt-4'>A good app lets you see progress without hunting through pages.</p>

        <div className='mt-6 md:mt-2 md:contents'>
          <Screenshot
            src='/SCREENSHOT_HISTORY_CALENDAR.PNG'
            alt='Push/Pull workout history calendar with training highlights'
            caption='History views make progress obvious without digging through notes.'
            align='left'
          />
        </div>

        <h2 className='text-2xl font-semibold text-text-primary mt-12 mb-4'>Recovery and fatigue, tracked without drama</h2>
        <p className='text-text-secondary'>
          Progress is not just about doing more. It is about recovering well enough to train again. Push/Pull keeps
          recovery notes and a simple body heatmap so you can see where fatigue is building up.
        </p>
        <p className='text-text-secondary mt-2'>
          <InlineLink href='/features#recovery'>Recovery heatmap and fatigue notes</InlineLink>
        </p>
        <div className='mt-6 md:mt-2 md:contents'>
          <Screenshot
            src='/SCREENSHOT_RECOVERY.PNG'
            alt='Push/Pull recovery heatmap showing fatigue patterns'
            caption='Use the recovery heatmap to spot patterns and avoid overdoing it.'
            align='right'
          />
        </div>

        <h2 className='text-2xl font-semibold text-text-primary mt-12 mb-4'>Where Push/Pull fits (and who it is for)</h2>
        <p className='text-text-secondary'>Push/Pull is for lifters who want:</p>
        <ul className='list-disc list-inside text-text-secondary mt-4 space-y-2'>
          <li>Fast logging without extra clutter</li>
          <li>Custom routines that fit any style</li>
          <li>Clear progress history that is easy to review</li>
          <li>Optional social accountability with friends</li>
          <li>Smart suggestions when you want help planning</li>
        </ul>
        <p className='text-text-secondary mt-4'>If that sounds like you, join the waitlist for the private beta.</p>
        <p className='text-text-secondary mt-2'>
          <InlineLink href='/features'>clear progress tracking</InlineLink>
        </p>

        <h2 className='text-2xl font-semibold text-text-primary mt-12 mb-4'>When an AI workout generator actually helps</h2>
        <p className='text-text-secondary'>
          If you are tired of planning every session, an AI workout generator can save time. Push/Pull uses your goals,
          equipment, and recent fatigue to suggest something realistic. You can always edit the plan before you lift.
        </p>
        <p className='text-text-secondary mt-2'>
          <InlineLink href='/features#ai'>AI-powered workout generation</InlineLink>
        </p>

        <h2 className='text-2xl font-semibold text-text-primary mt-12 mb-4'>A practical example: logging a push day</h2>
        <p className='text-text-secondary'>Here is a simple log you could do in two minutes:</p>
        <ul className='list-disc list-inside text-text-secondary mt-4 space-y-2'>
          <li>Bench Press: 3 sets of 5</li>
          <li>Overhead Press: 3 sets of 6</li>
          <li>Incline Dumbbell Press: 3 sets of 8</li>
          <li>Triceps Pressdown: 3 sets of 10</li>
        </ul>
        <p className='text-text-secondary mt-4'>Next week, add 2.5 to 5 lbs or one extra rep. That is progressive overload without the noise.</p>

        <div className='mt-6 md:mt-2 md:contents'>
          <Screenshot
            src='/SCREENSHOT_HOME.PNG'
            alt='Push/Pull home screen with today workout and quick actions'
            caption='The Today screen keeps your next session one tap away.'
            align='left'
          />
        </div>

        <h2 className='text-2xl font-semibold text-text-primary mt-12 mb-4'>How social features can keep you consistent</h2>
        <p className='text-text-secondary'>You do not need social features, but a small group can make consistency easier.</p>
        <p className='text-text-secondary mt-2'>
          Push/Pull uses Squads so friends can nudge you, celebrate wins, and help you show up.
        </p>

        <div className='mt-6 md:mt-2 md:contents'>
          <Screenshot
            src='/SCREENSHOT_SQUADS_FEED.PNG'
            alt='Push/Pull squads feed showing friend check-ins'
            caption='Small-group check-ins keep accountability simple.'
            align='right'
          />
        </div>
        <p className='text-text-secondary mt-4'>
          <InlineLink href='/features#squads'>Squads and social accountability</InlineLink>
        </p>

        <h2 className='text-2xl font-semibold text-text-primary mt-12 mb-4'>FAQ</h2>
        <div className='space-y-6'>
          <div>
            <h3 className='text-lg font-semibold text-text-primary'>Is the best gym tracker app the one with the most features?</h3>
            <p className='text-text-secondary mt-2'>No. The best tracker is the one you will use every session.</p>
          </div>
          <div>
            <h3 className='text-lg font-semibold text-text-primary'>What should I track if I am a beginner?</h3>
            <p className='text-text-secondary mt-2'>Exercise, weight, reps, and sets are enough to start improving.</p>
          </div>
          <div>
            <h3 className='text-lg font-semibold text-text-primary'>Do I need an app to make progress?</h3>
            <p className='text-text-secondary mt-2'>No, but a tracker makes progress easier to measure and repeat.</p>
          </div>
          <div>
            <h3 className='text-lg font-semibold text-text-primary'>Are social workout apps worth it?</h3>
            <p className='text-text-secondary mt-2'>They can be, especially with a small group that trains regularly.</p>
          </div>
          <div>
            <h3 className='text-lg font-semibold text-text-primary'>How does Push/Pull help compared to other apps?</h3>
            <p className='text-text-secondary mt-2'>Push/Pull focuses on fast logging, clear history, and optional social accountability.</p>
          </div>
        </div>

        <div className='mt-12 rounded-3xl border border-border bg-surface/60 p-6'>
          <h2 className='text-2xl font-semibold text-text-primary'>Ready to keep it simple?</h2>
          <p className='text-text-secondary mt-3'>
            Push/Pull is in private beta testing. It is a social-first gym tracker app with clear progress history,
            squads for accountability, and an optional AI workout generator. If you want flexible tracking and a small
            push to stay consistent, join the waitlist and we will reach out as spots open up.
          </p>
          <div className='mt-6'>
            <BetaCta />
          </div>
        </div>
      </>
    ),
  },
  {
    slug: 'social-workout-app-accountability',
    title: 'Social Workout App: Accountability That Actually Sticks',
    seoTitle: 'Social Workout App: Accountability That Actually Sticks',
    description:
      'Why social accountability works, a simple check-in loop, and how small groups keep training consistent.',
    metaDescription:
      'Learn how a social workout app helps you stay consistent, plus a simple accountability framework you can use today.',
    keywords: [
      'social workout app',
      'gym app for friends',
      'workout accountability app',
      'social fitness app',
      'workout consistency with friends',
      'gym tracker app',
    ],
    readTime: '8 min read',
    tags: ['Social', 'Consistency', 'Habits'],
    published: 'Mar 10, 2025',
    content: () => (
      <>
        <p className='text-lg text-text-secondary'>
          Most people do not quit the gym because they do not care. They quit because it is easy to fall off without
          feedback or momentum.
        </p>
        <p className='text-text-secondary'>
          I built Push/Pull to make that momentum easier. Push/Pull is a social workout app and gym tracker that keeps
          accountability lightweight, not noisy. It lets lifters create custom workouts, track progress clearly, and
          use squads for consistency.
        </p>
        <p className='text-text-secondary'>
          <InlineLink href='/'>Push/Pull gym tracker app</InlineLink>
        </p>

        <h2 className='text-2xl font-semibold text-text-primary mt-12 mb-4'>Why social accountability works (when it is done right)</h2>
        <p className='text-text-secondary'>Social features work when they are:</p>
        <ul className='list-disc list-inside text-text-secondary mt-4 space-y-2'>
          <li>Small (a few people, not a huge crowd)</li>
          <li>Consistent (the same people see your progress)</li>
          <li>Low pressure (no guilt, no streak anxiety)</li>
          <li>Visible (you can see what your friends actually did)</li>
        </ul>
        <p className='text-text-secondary mt-4'>A social workout app should make you feel supported, not judged.</p>

        <h2 className='text-2xl font-semibold text-text-primary mt-12 mb-4'>A simple framework: the check-in loop</h2>
        <Callout title='The Check-In Loop'>
          <ol className='list-decimal list-inside space-y-2 text-text-primary'>
            <li>Log your workout.</li>
            <li>Share a short check-in.</li>
            <li>React or comment.</li>
            <li>Plan the next session.</li>
          </ol>
        </Callout>
        <p className='text-text-secondary mt-4'>No long posts. No pressure. Just small signals that you are still in the game.</p>

        <div className='mt-6 md:mt-2 md:contents'>
          <Screenshot
            src='/SCREENSHOT_SQUADS_FEED.PNG'
            alt='Push/Pull squads feed with reactions and comments'
            caption='The check-in loop is quick, supportive, and low pressure.'
            align='right'
          />
        </div>

        <h2 className='text-2xl font-semibold text-text-primary mt-12 mb-4'>How Push/Pull handles social features</h2>
        <p className='text-text-secondary'>Push/Pull uses Squads for small group accountability:</p>
        <ul className='list-disc list-inside text-text-secondary mt-4 space-y-2'>
          <li>See when your friends log a workout</li>
          <li>Drop a quick reaction or comment</li>
          <li>Celebrate consistency, not just PRs</li>
          <li>Stay focused on your own progress</li>
        </ul>
        <p className='text-text-secondary mt-4'>
          <InlineLink href='/features#squads'>Squads and social accountability</InlineLink>
        </p>

        <h2 className='text-2xl font-semibold text-text-primary mt-12 mb-4'>Social does not replace good tracking</h2>
        <p className='text-text-secondary'>Accountability only works if logging is easy. Push/Pull keeps it fast.</p>
        <div className='mt-6 md:mt-2 md:contents'>
          <Screenshot
            src='/SCREENSHOT_WORKOUT_LOG.PNG'
            alt='Push/Pull workout log showing sets, reps, and weight'
            caption='Fast logging makes it easier to stay accountable.'
            align='left'
          />
        </div>

        <h2 className='text-2xl font-semibold text-text-primary mt-12 mb-4'>Where AI can help without making it weird</h2>
        <p className='text-text-secondary'>Sometimes you want a little structure. AI can suggest a simple plan based on your goals.</p>
        <p className='text-text-secondary mt-2'>
          <InlineLink href='/features#ai'>AI-powered workout generation</InlineLink>
        </p>

        <h2 className='text-2xl font-semibold text-text-primary mt-12 mb-4'>A real-world example: two friends, different schedules</h2>
        <ul className='list-disc list-inside text-text-secondary mt-4 space-y-2'>
          <li>Alex trains early mornings and logs fast with a saved routine.</li>
          <li>Sam trains nights and swaps exercises based on equipment.</li>
          <li>They both check in twice a week and react to each other&apos;s posts.</li>
          <li>The result: consistency without micromanaging.</li>
        </ul>
        <div className='mt-6 md:mt-2 md:contents'>
          <Screenshot
            src='/SCREENSHOT_HISTORY_CALENDAR.PNG'
            alt='Push/Pull training calendar showing consistent streaks'
            caption='Consistency is easier to see when your history is clear.'
            align='right'
          />
        </div>

        <h2 className='text-2xl font-semibold text-text-primary mt-12 mb-4'>FAQ</h2>
        <div className='space-y-6'>
          <div>
            <h3 className='text-lg font-semibold text-text-primary'>Do social workout apps help you stay consistent?</h3>
            <p className='text-text-secondary mt-2'>They can, especially with a small group and low-pressure check-ins.</p>
          </div>
          <div>
            <h3 className='text-lg font-semibold text-text-primary'>What if I do not want a public feed?</h3>
            <p className='text-text-secondary mt-2'>You do not need one. A small private group is usually better.</p>
          </div>
          <div>
            <h3 className='text-lg font-semibold text-text-primary'>Does Push/Pull work if I train alone?</h3>
            <p className='text-text-secondary mt-2'>Yes. Use it purely as a tracker and add social features only if you want them.</p>
          </div>
          <div>
            <h3 className='text-lg font-semibold text-text-primary'>Is a gym app for friends a distraction?</h3>
            <p className='text-text-secondary mt-2'>It can be if it is built around endless feeds. Small groups avoid that.</p>
          </div>
          <div>
            <h3 className='text-lg font-semibold text-text-primary'>Can I use accountability without changing my routine?</h3>
            <p className='text-text-secondary mt-2'>Yes. Social features should support your existing training, not replace it.</p>
          </div>
        </div>

        <div className='mt-12 rounded-3xl border border-border bg-surface/60 p-6'>
          <h2 className='text-2xl font-semibold text-text-primary'>A social workout app without the noise</h2>
          <p className='text-text-secondary mt-3'>
            Push/Pull is in private beta testing. It is a social workout app with clear workout tracking, small-group
            accountability, and optional AI planning support. If you want flexible tracking and a small group that
            keeps you consistent, join the waitlist and we will reach out as spots open up.
          </p>
          <div className='mt-6'>
            <BetaCta />
          </div>
        </div>
      </>
    ),
  },
];

export const getPostBySlug = (slug: string) => posts.find((post) => post.slug === slug);
