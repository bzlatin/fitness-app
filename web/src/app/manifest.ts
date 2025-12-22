import type { MetadataRoute } from 'next';

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://push-pull.app').replace(/\/+$/, '');

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Push/Pull',
    short_name: 'Push/Pull',
    description:
      'A workout tracker built for lifters with fast logging, clear progress, squads for accountability, and optional AI planning.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#050816',
    theme_color: '#050816',
    icons: [
      {
        src: `${siteUrl}/push-pull-logo.png`,
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  };
}
