import type { MetadataRoute } from 'next';
import { posts } from './blog/posts';

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://push-pull.app').replace(/\/+$/, '');

export default function sitemap(): MetadataRoute.Sitemap {
  const staticRoutes = ['', '/features', '/blog', '/support', '/privacy', '/terms'];
  const staticEntries = staticRoutes.map((route) => ({
    url: `${siteUrl}${route || '/'}`,
    lastModified: new Date(),
    changeFrequency: 'weekly' as const,
    priority: route ? 0.7 : 1,
  }));

  const blogEntries = posts.map((post) => {
    const parsedDate = Date.parse(post.published);
    const lastModified = Number.isNaN(parsedDate) ? new Date() : new Date(parsedDate);

    return {
      url: `${siteUrl}/blog/${post.slug}`,
      lastModified,
      changeFrequency: 'monthly' as const,
      priority: 0.8,
    };
  });

  return [...staticEntries, ...blogEntries];
}
