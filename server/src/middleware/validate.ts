import type { RequestHandler } from 'express';
import type { ZodError, ZodTypeAny } from 'zod';

const formatZodError = (error: ZodError) =>
  error.issues.map((issue) => ({
    path: issue.path.join('.'),
    message: issue.message,
  }));

export const validateBody = (schema: ZodTypeAny): RequestHandler => {
  return (req, res, next) => {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Invalid request body',
        details: formatZodError(parsed.error),
      });
    }

    req.body = parsed.data;
    return next();
  };
};

