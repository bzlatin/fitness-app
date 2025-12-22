'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

const ScrollReveal = () => {
  const pathname = usePathname();

  useEffect(() => {
    const root = document.documentElement;
    const elements = Array.from(document.querySelectorAll<HTMLElement>('.reveal'));

    if (!elements.length) {
      return;
    }

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const revealAll = () => {
      root.classList.remove('reveal-ready');
      elements.forEach((element) => element.classList.add('is-visible'));
    };

    if (prefersReducedMotion) {
      revealAll();
      return;
    }

    if (typeof window === 'undefined' || !('IntersectionObserver' in window)) {
      revealAll();
      return;
    }

    root.classList.add('reveal-ready');
    let remaining = elements.length;

    const emergencyTimer = window.setTimeout(() => {
      revealAll();
    }, 1500);

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting || entry.intersectionRatio > 0) {
            const target = entry.target as HTMLElement;
            if (!target.classList.contains('is-visible')) {
              target.classList.add('is-visible');
              remaining -= 1;
            }
            observer.unobserve(target);

            if (remaining <= 0) {
              window.clearTimeout(emergencyTimer);
              root.classList.remove('reveal-ready');
              observer.disconnect();
            }
          }
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -10% 0px' }
    );

    elements.forEach((element) => observer.observe(element));

    return () => {
      window.clearTimeout(emergencyTimer);
      observer.disconnect();
      root.classList.remove('reveal-ready');
    };
  }, [pathname]);

  return null;
};

export default ScrollReveal;
