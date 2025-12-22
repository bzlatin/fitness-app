'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';

const waitlistUrl = (() => {
  const rawApiBase = (process.env.NEXT_PUBLIC_API_URL || '').trim().replace(/\/+$/, '');
  if (rawApiBase) {
    return rawApiBase.endsWith('/api') ? `${rawApiBase}/waitlist` : `${rawApiBase}/api/waitlist`;
  }

  const siteBase = (process.env.NEXT_PUBLIC_SITE_URL || 'https://push-pull.app')
    .trim()
    .replace(/\/+$/, '');
  return `${siteBase}/api/waitlist`;
})();

export default function Home() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(waitlistUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, source: 'landing' }),
      });

      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
      };

      if (!response.ok) {
        throw new Error(data.error || 'Something went wrong. Please try again.');
      }

      setSubmitted(true);
      setEmail('');
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'Something went wrong. Please try again.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-background flex flex-col">
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">
        <div className="mb-6">
          <Image
            src="/push-pull-logo.svg"
            alt="Push/Pull Logo"
            width={80}
            height={80}
            priority
            className="rounded-2xl"
          />
        </div>

        <h1 className="text-3xl sm:text-4xl font-bold text-text-primary mb-2 tracking-tight">
          Push Pull<span className="text-primary">:</span> Gym Tracker
        </h1>

        <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-primary/10 border border-primary/20 rounded-full mb-6">
          <span className="w-2 h-2 bg-primary rounded-full animate-pulse" />
          <span className="text-sm font-medium text-primary">Coming Soon</span>
        </div>

        <p className="text-text-secondary text-center text-lg mb-4 max-w-md">
          Smart Workouts &amp; Gym Tracking
        </p>
        <p className="text-text-secondary text-center text-base mb-10 max-w-xl">
          Push Pull is a social workout log and strength training planner that keeps your
          workouts simple, structured, and personalized to your goals. Log sets instantly,
          track progress over time, and stay motivated with squads and shared routines.
        </p>

        <div className="w-full max-w-sm" id="waitlist">
          {!submitted ? (
            <form onSubmit={handleSubmit} className="space-y-3">
              <input
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-3 bg-surface border border-border rounded-xl text-text-primary placeholder:text-text-secondary/50 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
              />
              <button
                type="submit"
                disabled={loading}
                className="w-full px-4 py-3 bg-primary hover:bg-primary/90 disabled:bg-primary/50 text-white font-semibold rounded-xl transition-colors"
              >
                {loading ? 'Joining...' : 'Get Notified'}
              </button>
              {error && (
                <p className="text-error text-sm text-center">{error}</p>
              )}
            </form>
          ) : (
            <div className="flex items-center justify-center gap-2 px-4 py-3 bg-primary/10 border border-primary/20 rounded-xl">
              <svg
                className="w-5 h-5 text-primary"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
              <span className="text-text-primary font-medium">
                You&apos;re on the list!
              </span>
            </div>
          )}

          {!submitted && (
            <p className="text-text-secondary/60 text-sm text-center mt-3">
              Be the first to know when we launch.
            </p>
          )}
        </div>
      </div>

      <section className="px-6 pb-10">
        <div className="max-w-4xl mx-auto rounded-3xl border border-border/60 bg-surface/70 p-6 sm:p-8 shadow-[0_24px_70px_rgba(5,8,22,0.25)] backdrop-blur">
          <h2 className="text-2xl font-semibold text-text-primary mb-4">
            Free and Pro features built for consistency
          </h2>
          <div className="grid gap-6 md:grid-cols-2 text-text-secondary">
            <div>
              <p className="text-sm uppercase tracking-[0.2em] text-text-secondary mb-3">Free features</p>
              <ul className="list-disc list-inside space-y-2">
                <li>Log unlimited workouts with 800+ exercises</li>
                <li>Create up to 3 custom routines and templates</li>
                <li>Track sets, reps, and weight with progressive overload support</li>
                <li>Join squads, share workouts, and follow friends</li>
                <li>Review history, streaks, and training trends</li>
              </ul>
            </div>
            <div>
              <p className="text-sm uppercase tracking-[0.2em] text-text-secondary mb-3">Pro features</p>
              <ul className="list-disc list-inside space-y-2">
                <li>Unlimited routine templates and planning</li>
                <li>AI workout generation tailored to your goals</li>
                <li>Recovery and fatigue indicators</li>
                <li>Personalized progression recommendations</li>
                <li>Muscle group balance and analytics</li>
              </ul>
              <p className="mt-4 text-sm text-text-secondary">
                Pro subscription: $4.99 monthly or $49.99 annually.
              </p>
            </div>
          </div>
        </div>
      </section>

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
          <Link href="/features" className="hover:text-text-primary transition-colors">
            Features
          </Link>
          <span className="hidden sm:inline">·</span>
          <Link href="/about" className="hover:text-text-primary transition-colors">
            About
          </Link>
          <span className="hidden sm:inline">·</span>
          <Link href="/blog" className="hover:text-text-primary transition-colors">
            Blog
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
