'use client';

import { useState } from 'react';
import type { FormEvent } from 'react';

type WaitlistFormProps = {
  waitlistUrl: string;
};

export default function WaitlistForm({ waitlistUrl }: WaitlistFormProps) {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
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
    <div className="w-full max-w-sm" id="waitlist">
      {!submitted ? (
        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="email"
            placeholder="Enter your email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
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
          {error && <p className="text-error text-sm text-center">{error}</p>}
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
  );
}
