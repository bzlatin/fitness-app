'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';

type WorkoutShareClientProps = {
  raw: string;
  code: string | null;
  debug: boolean;
};

const apiHost = (() => {
  const rawApiBase = (process.env.NEXT_PUBLIC_API_URL || '').trim().replace(/\/+$/, '');
  if (!rawApiBase) return 'http://localhost:4000';
  return rawApiBase.endsWith('/api') ? rawApiBase.slice(0, -4) : rawApiBase;
})();

export default function WorkoutShareClient({ raw, code, debug }: WorkoutShareClientProps) {
  const valid = Boolean(code);
  const deepLink = useMemo(() => (code ? `push-pull://workout/share/${code}` : null), [code]);
  const autoAttemptedRef = useRef(false);
  const [templateName, setTemplateName] = useState<string | null>(null);
  const [creatorHandle, setCreatorHandle] = useState<string | null>(null);

  useEffect(() => {
    if (!valid || !deepLink) return;
    if (autoAttemptedRef.current) return;
    autoAttemptedRef.current = true;
    window.location.href = deepLink;
  }, [deepLink, valid]);

  useEffect(() => {
    if (!valid || !code) return;
    const controller = new AbortController();
    const load = async () => {
      try {
        const res = await fetch(`${apiHost}/api/templates/share/${code}`, { signal: controller.signal });
        if (!res.ok) return;
        const data = (await res.json()) as { template?: { name?: string }; creator?: { handle?: string | null } };
        const name = data.template?.name?.trim();
        if (name) setTemplateName(name);
        const handle = data.creator?.handle?.toString().trim();
        if (handle) setCreatorHandle(handle.startsWith('@') ? handle : `@${handle}`);
      } catch {
        // ignore
      }
    };
    void load();
    return () => controller.abort();
  }, [code, valid]);

  if (!valid || !code) {
    return (
      <main className="min-h-screen bg-background flex flex-col items-center justify-center px-6 py-12">
        <div className="w-full max-w-md bg-surface border border-border rounded-2xl p-6 text-center">
          <h1 className="text-2xl font-bold text-text-primary mb-2">Invalid link</h1>
          <p className="text-text-secondary mb-6">This workout share link doesn&apos;t look right.</p>
          {debug ? (
            <div className="text-left bg-background/40 border border-border rounded-xl p-3 mb-4">
              <div className="text-xs text-text-secondary mb-1">Debug</div>
              <div className="text-sm text-text-primary font-mono break-all">raw: {JSON.stringify(raw)}</div>
              <div className="text-sm text-text-primary font-mono break-all">code: {JSON.stringify(code)}</div>
            </div>
          ) : null}
          <Link
            href="/"
            className="inline-flex items-center justify-center w-full px-4 py-3 bg-primary hover:bg-primary/90 text-background font-semibold rounded-xl transition-colors"
          >
            Go to Push/Pull
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background flex flex-col">
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">
        <div className="mb-6">
          <Image
            src="/push-pull-logo.svg"
            alt=""
            width={72}
            height={72}
            priority
            className="rounded-2xl"
          />
        </div>

        <h1 className="text-2xl sm:text-3xl font-bold text-text-primary mb-2 tracking-tight text-center">
          Opening your workout in Push<span className="text-primary">/</span>Pull
        </h1>

        <p className="text-text-secondary text-center text-base mb-8 max-w-md">
          {templateName ? (
            <>
              <span className="text-text-primary font-semibold">{templateName}</span>
              {creatorHandle ? (
                <>
                  {' '}
                  <span className="text-text-secondary">·</span>{' '}
                  <span className="text-text-secondary">Created by</span>{' '}
                  <span className="text-text-primary font-semibold">{creatorHandle}</span>
                </>
              ) : null}
              <br />
              <br />
            </>
          ) : null}
          If the app is installed, it should open automatically. Otherwise, you can install Push/Pull and try again.
        </p>

        <div className="w-full max-w-sm space-y-3">
          {deepLink ? (
            <a
              href={deepLink}
              className="w-full inline-flex items-center justify-center px-4 py-3 bg-primary hover:bg-primary/90 text-background font-semibold rounded-xl transition-colors"
            >
              Open in app
            </a>
          ) : null}

          <Link
            href="/"
            className="w-full inline-flex items-center justify-center px-4 py-3 bg-surface border border-border hover:border-primary/50 text-text-primary font-semibold rounded-xl transition-colors"
          >
            Learn more
          </Link>

          <p className="text-text-secondary/70 text-sm text-center mt-3">
            Share code: <span className="font-mono">{code}</span>
          </p>
        </div>
      </div>

      <footer className="py-6 px-6">
        <div className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-6 text-sm text-text-secondary">
          <span>© {new Date().getFullYear()} Push/Pull</span>
          <span className="hidden sm:inline">·</span>
          <Link href="/privacy" className="hover:text-text-primary transition-colors">
            Privacy Policy
          </Link>
          <span className="hidden sm:inline">·</span>
          <Link href="/terms" className="hover:text-text-primary transition-colors">
            Terms of Service
          </Link>
          <span className="hidden sm:inline">·</span>
          <Link href="/support" className="hover:text-text-primary transition-colors">
            Support
          </Link>
        </div>
      </footer>
    </main>
  );
}
