'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

const ScrollReveal = () => {
  const pathname = usePathname();

  useEffect(() => {
    document.documentElement.classList.add('reveal-ready');

    const elements = Array.from(document.querySelectorAll<HTMLElement>('[data-reveal]'));

    if (!elements.length) {
      document.documentElement.classList.remove('reveal-ready');
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.2 }
    );

    elements.forEach((element) => observer.observe(element));

    return () => {
      observer.disconnect();
      document.documentElement.classList.remove('reveal-ready');
    };
  }, [pathname]);

  return null;
};

export default ScrollReveal;
