'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';

const apiBase = (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/$/, '');

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
      const response = await fetch(`${apiBase}/api/waitlist`, {
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
          Push<span className="text-primary">/</span>Pull
        </h1>

        <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-primary/10 border border-primary/20 rounded-full mb-6">
          <span className="w-2 h-2 bg-primary rounded-full animate-pulse" />
          <span className="text-sm font-medium text-primary">Coming Soon</span>
        </div>

        <p className="text-text-secondary text-center text-lg mb-10 max-w-md">
          The workout tracker built for lifters.
        </p>

        <div className="w-full max-w-sm">
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
        </div>
      </footer>
    </main>
  );
}
