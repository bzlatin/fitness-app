'use client';

import { useEffect, useId, useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

type NavItem = {
  href: string;
  label: string;
};

const isActivePath = (pathname: string, href: string) => {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
};

export default function SiteNav() {
  const pathname = usePathname();
  const menuId = useId();
  const [openOnPath, setOpenOnPath] = useState<string | null>(null);
  const open = openOnPath === pathname;

  const items = useMemo<NavItem[]>(
    () => [
      { href: '/', label: 'Home' },
      { href: '/features', label: 'Features' },
      { href: '/blog', label: 'Blog' },
      { href: '/about', label: 'About' },
      { href: '/support', label: 'Support' },
    ],
    []
  );

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpenOnPath(null);
    };

    document.addEventListener('keydown', onKeyDown);
    document.body.classList.add('overflow-hidden');

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.classList.remove('overflow-hidden');
    };
  }, [open]);

  return (
    <>
      <header className='sticky top-0 z-50 border-b border-border/70 bg-background/75 backdrop-blur supports-[backdrop-filter]:bg-background/55'>
        <div className='mx-auto flex h-16 max-w-6xl items-center justify-between px-6'>
          <Link href='/' className='inline-flex items-center gap-3'>
            <Image
              src='/push-pull-logo.svg'
              alt='Push/Pull'
              width={34}
              height={34}
              className='rounded-xl'
              priority
            />
            <span className='font-display text-lg font-semibold tracking-tight text-text-primary'>
              Push/Pull
            </span>
          </Link>

          <nav className='hidden items-center gap-1 md:flex' aria-label='Primary'>
            {items.map((item) => {
              const active = isActivePath(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                    active
                      ? 'bg-primary/15 text-primary'
                      : 'text-text-secondary hover:bg-surface/60 hover:text-text-primary'
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <button
            type='button'
            className='inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border/70 bg-surface/40 text-text-primary transition hover:bg-surface/70 md:hidden'
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
            aria-controls={menuId}
            onClick={() => setOpenOnPath((current) => (current === pathname ? null : pathname))}
          >
            <svg
              className='h-5 w-5'
              viewBox='0 0 24 24'
              fill='none'
              stroke='currentColor'
              strokeWidth='2'
              strokeLinecap='round'
              strokeLinejoin='round'
            >
              {open ? (
                <>
                  <path d='M18 6L6 18' />
                  <path d='M6 6l12 12' />
                </>
              ) : (
                <>
                  <path d='M4 6h16' />
                  <path d='M4 12h16' />
                  <path d='M4 18h16' />
                </>
              )}
            </svg>
          </button>
        </div>
      </header>

      <div
        id={menuId}
        className={`fixed inset-0 z-[999] isolate md:hidden ${open ? '' : 'pointer-events-none'}`}
        aria-hidden={!open}
      >
        <div
          className={`absolute inset-0 bg-background transition-opacity ${
            open ? 'opacity-100' : 'opacity-0'
          }`}
          onClick={() => setOpenOnPath(null)}
        />
        <div
          role='dialog'
          aria-modal='true'
          aria-label='Navigation menu'
          className={`absolute right-0 top-0 h-full w-[86%] max-w-sm border-l border-border/70 bg-background shadow-[0_24px_80px_rgba(0,0,0,0.65)] transition-transform ${
            open ? 'translate-x-0' : 'translate-x-full'
          }`}
        >
          <div className='flex items-center justify-between px-6 py-5'>
            <span className='text-sm uppercase tracking-[0.28em] text-text-secondary'>Navigate</span>
            <button
              type='button'
              onClick={() => setOpenOnPath(null)}
              className='rounded-xl border border-border/70 bg-surface/40 px-3 py-2 text-sm font-medium text-text-primary hover:bg-surface/70 transition'
            >
              Close
            </button>
          </div>
          <div className='px-3'>
            {items.map((item) => {
              const active = isActivePath(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  onClick={() => setOpenOnPath(null)}
                  className={`flex items-center justify-between rounded-2xl px-4 py-4 text-base font-semibold transition ${
                    active
                      ? 'bg-primary/15 text-primary'
                      : 'text-text-primary hover:bg-surface/60'
                  }`}
                >
                  <span>{item.label}</span>
                  <svg
                    className='h-4 w-4 opacity-70'
                    viewBox='0 0 24 24'
                    fill='none'
                    stroke='currentColor'
                    strokeWidth='2'
                    strokeLinecap='round'
                    strokeLinejoin='round'
                  >
                    <path d='M9 18l6-6-6-6' />
                  </svg>
                </Link>
              );
            })}
          </div>

          <div className='mt-6 px-6'>
            <Link
              href='/#waitlist'
              className='inline-flex w-full items-center justify-center rounded-2xl bg-white px-5 py-4 text-sm font-semibold text-background shadow-sm hover:shadow-md transition-shadow'
            >
              Join the waitlist
            </Link>
            <div className='mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-text-secondary'>
              <Link href='/privacy' className='hover:text-text-primary transition-colors'>
                Privacy
              </Link>
              <Link href='/terms' className='hover:text-text-primary transition-colors'>
                Terms
              </Link>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
