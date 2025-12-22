import type { Metadata } from 'next';
import Link from 'next/link';
import { posts } from './posts';

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://push-pull.app').replace(/\/+$/, '');
const defaultOgImage = '/SCREENSHOT_HOME.PNG';

export const metadata: Metadata = {
  title: 'Blog - Push/Pull',
  description:
    'Honest guides for workout tracking, social accountability, and simple training habits that actually stick.',
  alternates: {
    canonical: '/blog',
  },
  openGraph: {
    title: 'Blog - Push/Pull',
    description:
      'Honest guides for workout tracking, social accountability, and simple training habits that actually stick.',
    url: `${siteUrl}/blog`,
    type: 'website',
    images: [
      {
        url: defaultOgImage,
        width: 1200,
        height: 630,
        alt: 'Push/Pull blog preview',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Blog - Push/Pull',
    description:
      'Honest guides for workout tracking, social accountability, and simple training habits that actually stick.',
    images: [defaultOgImage],
  },
};

export default function BlogIndexPage() {
  const [featured] = posts;
  const tags = Array.from(new Set(posts.flatMap((post) => post.tags))).slice(0, 6);
  const blogPosts = posts.map((post) => {
    const parsedDate = Date.parse(post.published);
    const publishedDate = Number.isNaN(parsedDate) ? undefined : new Date(parsedDate).toISOString();

    return {
      '@type': 'BlogPosting',
      headline: post.seoTitle,
      description: post.metaDescription,
      url: `${siteUrl}/blog/${post.slug}`,
      ...(publishedDate ? { datePublished: publishedDate } : {}),
    };
  });
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'Blog',
    name: 'Push/Pull Blog',
    description:
      'Honest guides for workout tracking, social accountability, and simple training habits that actually stick.',
    url: `${siteUrl}/blog`,
    image: `${siteUrl}${defaultOgImage}`,
    blogPost: blogPosts,
  };

  return (
    <main className='min-h-screen bg-background'>
      <script type='application/ld+json'>{JSON.stringify(structuredData)}</script>
      <div className='max-w-6xl mx-auto px-6 py-14'>
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

        <header
          className='mt-10 grid gap-10 lg:grid-cols-[1.2fr_0.8fr] items-start reveal'
          data-reveal
        >
          <div className='max-w-3xl'>
            <p className='text-sm uppercase tracking-[0.3em] text-text-secondary'>Push/Pull Blog</p>
            <h1 className='text-4xl sm:text-5xl font-bold text-text-primary mt-3 font-display'>
              Practical lifting guides from a builder who got tired of bad trackers.
            </h1>
            <p className='text-lg text-text-secondary mt-4'>
              Honest systems for workout tracking, social accountability, and training consistency. Use what helps,
              skip what does not.
            </p>
            <div className='mt-6 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-2 text-sm text-primary'>
              Private beta testing now. Public launch coming soon.
            </div>
          </div>
          <aside className='rounded-3xl border border-border/60 bg-surface/70 p-6 shadow-[0_24px_70px_rgba(5,8,22,0.25)]'>
            <p className='text-xs uppercase tracking-[0.3em] text-text-secondary'>Highlights</p>
            <div className='mt-4 space-y-4'>
              {featured && (
                <div className='rounded-2xl border border-border/60 bg-background/40 p-4'>
                  <p className='text-sm text-text-secondary'>Featured guide</p>
                  <Link
                    href={`/blog/${featured.slug}`}
                    className='mt-2 block text-lg font-semibold text-text-primary hover:text-primary transition-colors'
                  >
                    {featured.title}
                  </Link>
                  <p className='mt-2 text-xs text-text-secondary'>{featured.readTime}</p>
                </div>
              )}
              <div>
                <p className='text-sm text-text-secondary'>Popular topics</p>
                <div className='mt-3 flex flex-wrap gap-2'>
                  {tags.map((tag) => (
                    <span
                      key={tag}
                      className='rounded-full border border-border/60 bg-surface/70 px-3 py-1 text-xs uppercase tracking-[0.2em] text-text-secondary'
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
              <div className='flex items-center justify-between text-sm text-text-secondary'>
                <span>Total posts</span>
                <span className='font-semibold text-text-primary'>{posts.length}</span>
              </div>
            </div>
          </aside>
        </header>

          {featured && (
            <section className='mt-12 reveal' data-reveal>
              <div className='flex items-center justify-between mb-4'>
                <h2 className='text-xl font-semibold text-text-primary'>Featured</h2>
                <span className='text-sm text-text-secondary'>{featured.readTime}</span>
              </div>
              <Link
                href={`/blog/${featured.slug}`}
                className='group block rounded-3xl border border-border/60 bg-gradient-to-br from-surface/80 via-surface/60 to-surface/40 p-6 sm:p-8 shadow-[0_26px_80px_rgba(5,8,22,0.4)] backdrop-blur hover:border-primary/40 hover:-translate-y-1 hover:shadow-[0_30px_90px_rgba(5,8,22,0.45)] transition'
              >
                <div className='flex flex-wrap gap-2 text-xs uppercase tracking-[0.2em] text-text-secondary'>
                  {featured.tags.map((tag) => (
                    <span key={tag}>{tag}</span>
                  ))}
                </div>
                <h3 className='text-2xl sm:text-3xl font-semibold text-text-primary mt-4 group-hover:text-primary transition-colors'>
                  {featured.title}
                </h3>
                <p className='text-text-secondary mt-3'>{featured.description}</p>
                <div className='mt-6 text-primary font-semibold'>Read the guide</div>
              </Link>
            </section>
          )}

            <section className='mt-12 reveal' data-reveal>
              <div className='flex items-center justify-between mb-4'>
                <h2 className='text-xl font-semibold text-text-primary'>All posts</h2>
                <span className='text-sm text-text-secondary'>{posts.length} posts</span>
              </div>
              <div className='grid gap-6 md:grid-cols-2'>
                {posts.map((post) => (
                  <Link
                    key={post.slug}
                    href={`/blog/${post.slug}`}
                    className='group block rounded-2xl border border-border/60 bg-surface/70 p-6 shadow-[0_18px_50px_rgba(5,8,22,0.28)] backdrop-blur hover:border-primary/40 hover:-translate-y-1 hover:bg-surface/80 transition'
                  >
                    <div className='flex items-center justify-between text-xs text-text-secondary'>
                      <span className='uppercase tracking-[0.2em]'>{post.tags.join(' / ')}</span>
                      <span>{post.readTime}</span>
                    </div>
                  <h3 className='text-xl font-semibold text-text-primary mt-4 group-hover:text-primary transition-colors'>
                    {post.title}
                  </h3>
                  <p className='text-text-secondary mt-3'>{post.description}</p>
                  <div className='mt-5 text-primary font-semibold'>Read more</div>
                </Link>
              ))}
            </div>
          </section>

        <section
          className='mt-16 rounded-3xl border border-border/60 bg-surface/70 p-8 shadow-[0_24px_70px_rgba(5,8,22,0.25)] backdrop-blur reveal'
          data-reveal
        >
          <div className='max-w-2xl'>
            <h2 className='text-2xl font-semibold text-text-primary'>Join the private beta</h2>
            <p className='text-text-secondary mt-3'>
              Push/Pull is in private beta testing. It is a social-first gym tracker with clear progress history,
              squads for accountability, and optional AI planning. Join the waitlist and we will reach out as spots
              open up.
            </p>
            <div className='mt-6'>
              <div className='flex flex-col sm:flex-row gap-3 items-start sm:items-center'>
                <Link
                  href='/#waitlist'
                  className='inline-flex items-center justify-center px-5 py-3 rounded-xl bg-white text-background font-semibold shadow-sm hover:shadow-md transition-shadow'
                >
                  Join the private beta waitlist
                </Link>
                <span className='text-sm text-text-secondary'>Public launch coming soon.</span>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
