import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getPostBySlug, posts } from '../posts';

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://push-pull.app').replace(/\/+$/, '');
const defaultOgImage = '/SCREENSHOT_HOME.PNG';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = getPostBySlug(slug);

  if (!post) {
    return {
      title: 'Blog - Push/Pull',
      description: 'Workout tracking guides and social accountability tips.',
    };
  }

  return {
    title: post.seoTitle,
    description: post.metaDescription,
    keywords: post.keywords,
    alternates: {
      canonical: `/blog/${post.slug}`,
    },
    openGraph: {
      title: post.seoTitle,
      description: post.metaDescription,
      url: `${siteUrl}/blog/${post.slug}`,
      type: 'article',
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
      title: post.seoTitle,
      description: post.metaDescription,
      images: [defaultOgImage],
    },
  };
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = getPostBySlug(slug);

  if (!post) {
    notFound();
  }

  const otherPosts = posts.filter((item) => item.slug !== post.slug).slice(0, 2);
  const parsedDate = Date.parse(post.published);
  const publishedDate = Number.isNaN(parsedDate) ? undefined : new Date(parsedDate).toISOString();
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.seoTitle,
    description: post.metaDescription,
    ...(publishedDate ? { datePublished: publishedDate, dateModified: publishedDate } : {}),
    image: `${siteUrl}${defaultOgImage}`,
    author: {
      '@type': 'Person',
      name: 'Push/Pull Team',
    },
    publisher: {
      '@type': 'Organization',
      name: 'Push/Pull',
      logo: {
        '@type': 'ImageObject',
        url: `${siteUrl}/push-pull-logo.png`,
      },
    },
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': `${siteUrl}/blog/${post.slug}`,
    },
  };

  return (
    <main className='min-h-screen bg-background'>
      <script type='application/ld+json'>{JSON.stringify(structuredData)}</script>
      <div className='max-w-5xl mx-auto px-6 py-12'>
        <Link
          href='/blog'
          className='inline-flex items-center gap-2 text-text-secondary hover:text-text-primary transition-colors reveal'
          data-reveal
        >
          <svg className='w-4 h-4' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
            <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M15 19l-7-7 7-7' />
          </svg>
          Back to Blog
        </Link>

        <header className='mt-8 reveal' data-reveal>
          <div className='flex flex-wrap items-center gap-3 text-sm text-text-secondary'>
            <span className='uppercase tracking-[0.2em]'>{post.tags.join(' / ')}</span>
            <span>{post.published}</span>
            <span>{post.readTime}</span>
            <span className='inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs text-primary'>
              Private beta testing
            </span>
          </div>
          <h1 className='text-3xl sm:text-4xl font-bold text-text-primary mt-4 font-display'>{post.title}</h1>
          <p className='text-lg text-text-secondary mt-4 max-w-2xl'>{post.description}</p>
        </header>

        <div className='mt-10 reveal' data-reveal>
          <div className='max-w-4xl mx-auto rounded-3xl border border-border/60 bg-surface/70 p-6 sm:p-10 shadow-[0_28px_80px_rgba(5,8,22,0.25)] backdrop-blur'>
            <article className='blog-article'>{post.content()}</article>
          </div>
        </div>

        {otherPosts.length > 0 && (
          <section className='mt-16 reveal' data-reveal>
            <h2 className='text-xl font-semibold text-text-primary mb-4'>Read next</h2>
            <div className='grid gap-6 md:grid-cols-2'>
              {otherPosts.map((item) => (
                <Link
                  key={item.slug}
                  href={`/blog/${item.slug}`}
                  className='group block rounded-2xl border border-border/60 bg-surface/70 p-6 shadow-[0_18px_50px_rgba(5,8,22,0.22)] backdrop-blur hover:border-primary/40 hover:-translate-y-1 hover:bg-surface/80 transition'
                >
                  <div className='text-xs uppercase tracking-[0.2em] text-text-secondary'>{item.tags.join(' / ')}</div>
                  <h3 className='text-xl font-semibold text-text-primary mt-4 group-hover:text-primary transition-colors'>
                    {item.title}
                  </h3>
                  <p className='text-text-secondary mt-2'>{item.description}</p>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
