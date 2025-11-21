import { RequestHandler } from "express";
import { auth } from "express-oauth2-jwt-bearer";
import { query } from "../db";
import { DEMO_USER_ID } from "../types/workouts";
import { MOCK_USER_IDS } from "../data/mockUsers";

const { AUTH0_DOMAIN, AUTH0_AUDIENCE } = process.env;
const ALLOW_DEV_AUTH_BYPASS = process.env.ALLOW_DEV_AUTH_BYPASS === "true";
const DEV_USER_ID = process.env.DEV_USER_ID || DEMO_USER_ID;

if (!AUTH0_DOMAIN) {
  throw new Error("AUTH0_DOMAIN is not set. Please add it to your .env.");
}

if (!AUTH0_AUDIENCE) {
  throw new Error("AUTH0_AUDIENCE is not set. Please add it to your .env.");
}

export const requireAuth = auth({
  audience: AUTH0_AUDIENCE,
  issuerBaseURL: `https://${AUTH0_DOMAIN}/`,
  tokenSigningAlg: "RS256",
});

export const maybeRequireAuth: RequestHandler = (req, res, next) => {
  // Helpful during local dev when Auth0 tokens are missing; do NOT enable in prod.
  if (ALLOW_DEV_AUTH_BYPASS && !req.headers.authorization) {
    res.locals.userId = DEV_USER_ID;
    return next();
  }
  return requireAuth(req, res, next);
};

export const attachUser: RequestHandler = (_req, res, next) => {
  if (res.locals.userId) {
    return next();
  }
  const userId = _req.auth?.payload?.sub;
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  res.locals.userId = userId;
  return next();
};

const normalizeClaim = (value: unknown) =>
  typeof value === "string" && value.trim().length > 0 ? value : undefined;

const insertFollowPairs = async (pairs: [string, string][]) => {
  if (pairs.length === 0) return;
  const values = pairs
    .map((_, index) => `($${index * 2 + 1}, $${index * 2 + 2})`)
    .join(", ");
  const params = pairs.flat();
  await query(
    `
      INSERT INTO follows (user_id, target_user_id)
      SELECT v.user_id, v.target_user_id
      FROM (VALUES ${values}) AS v(user_id, target_user_id)
      WHERE EXISTS (SELECT 1 FROM users u WHERE u.id = v.user_id)
        AND EXISTS (SELECT 1 FROM users u WHERE u.id = v.target_user_id)
      ON CONFLICT DO NOTHING
    `,
    params
  );
};

export const ensureUser: RequestHandler = async (req, res, next) => {
  const userId = res.locals.userId;
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const payload = req.auth?.payload ?? {};
  const email = normalizeClaim((payload as Record<string, unknown>).email);
  const name =
    normalizeClaim((payload as Record<string, unknown>).name) ??
    normalizeClaim((payload as Record<string, unknown>).nickname);

  // Only seed mutual follows with mock users on the very first creation of a user
  // to avoid re-adding follows after someone intentionally unfriends.
  try {
    const insertResult = await query(
      `
        INSERT INTO users (id, email, name)
        VALUES ($1, $2, $3)
        ON CONFLICT (id) DO NOTHING
        RETURNING id
      `,
      [userId, email ?? null, name ?? null]
    );
    const isNewUser = (insertResult?.rowCount ?? 0) > 0;

    if (!isNewUser) {
      await query(
        `
          UPDATE users
          SET email = COALESCE($2, users.email),
              name = COALESCE($3, users.name),
              plan = COALESCE(users.plan, 'free'),
              updated_at = NOW()
          WHERE id = $1
        `,
        [userId, email ?? null, name ?? null]
      );
    }

    if (isNewUser && userId !== DEMO_USER_ID) {
      const followTargets = MOCK_USER_IDS.filter((id) => id !== userId);
      const followPairs: [string, string][] = [];
      for (const targetId of followTargets) {
        followPairs.push([userId, targetId], [targetId, userId]);
      }
      await insertFollowPairs(followPairs);
    }
    return next();
  } catch (err) {
    console.error("Failed to sync user profile", err);
    return res.status(500).json({ error: "Failed to sync user profile" });
  }
};
