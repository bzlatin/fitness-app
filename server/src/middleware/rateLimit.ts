import type { Request, Response } from 'express';
import rateLimit, { ipKeyGenerator, type Options } from 'express-rate-limit';

const hasValue = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;

const userOrIpKeyGenerator: Options['keyGenerator'] = (req: Request, res: Response) => {
  const userId = res.locals.userId;
  if (hasValue(userId)) return `user:${userId}`;
  // Express sets `req.ip`, but its types allow `undefined` in some setups.
  const ip = req.ip ?? req.socket.remoteAddress ?? 'unknown';
  return `ip:${ipKeyGenerator(ip)}`;
};

type CreateLimiterOptions = {
  windowMs: number;
  max: number | ((req: Request, res: Response) => number);
  message: string;
};

const createLimiter = ({ windowMs, max, message }: CreateLimiterOptions) =>
  rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: userOrIpKeyGenerator,
    handler: (_req, res) => {
      return res.status(429).json({
        error: 'Rate limit exceeded',
        message,
      });
    },
  });

export const aiGenerateLimiter = createLimiter({
  windowMs: 60_000,
  max: 10,
  message: 'Too many workout generation requests. Please wait a minute and try again.',
});

export const aiSwapLimiter = createLimiter({
  windowMs: 60_000,
  max: 20,
  message: 'Too many swap requests. Please wait a minute and try again.',
});

export const aiRecommendLimiter = createLimiter({
  windowMs: 60_000,
  max: 30,
  message: 'Too many recommendation requests. Please wait a minute and try again.',
});

export const subscriptionWriteLimiter = createLimiter({
  windowMs: 60_000,
  max: 10,
  message: 'Too many subscription requests. Please try again shortly.',
});

export const waitlistLimiter = createLimiter({
  windowMs: 60 * 60_000,
  max: 20,
  message: 'Too many waitlist signup attempts. Please try again later.',
});

export const feedbackCreateLimiter = createLimiter({
  windowMs: 60 * 60_000,
  max: (_req, res) => (res.locals.isAdmin ? 30 : 5),
  message: "You've submitted too many feedback items. Please try again in an hour.",
});

export const feedbackReportLimiter = createLimiter({
  windowMs: 60 * 60_000,
  max: 20,
  message: "You've reported too many items. Please try again later.",
});
