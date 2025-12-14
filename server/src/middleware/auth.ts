import { RequestHandler } from "express";
import { auth } from "express-oauth2-jwt-bearer";
import { query } from "../db";

const { AUTH0_DOMAIN, AUTH0_AUDIENCE } = process.env;
const isProduction = process.env.NODE_ENV === "production";
const ALLOW_DEV_AUTH_BYPASS =
  process.env.ALLOW_DEV_AUTH_BYPASS === "true" && !isProduction;
const DEV_USER_ID = process.env.DEV_USER_ID || "demo-user";

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
    const headerValue = req.headers["x-dev-user-id"];
    const devUserId =
      typeof headerValue === "string"
        ? headerValue
        : Array.isArray(headerValue)
        ? headerValue[0]
        : undefined;
    res.locals.userId = devUserId?.trim() ? devUserId.trim() : DEV_USER_ID;
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

  const rawShareCodeHeader = req.headers["x-template-share-code"];
  const shareCode =
    typeof rawShareCodeHeader === "string"
      ? rawShareCodeHeader
      : Array.isArray(rawShareCodeHeader)
      ? rawShareCodeHeader[0]
      : undefined;
  const normalizedShareCode = shareCode?.toLowerCase().trim();
  const isValidShareCode =
    typeof normalizedShareCode === "string" && /^[0-9a-z]{8}$/.test(normalizedShareCode);

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

    if (isNewUser && isValidShareCode) {
      await query(
        `
          WITH share AS (
            SELECT id
            FROM template_shares
            WHERE share_code = $1
              AND is_revoked = false
              AND (expires_at IS NULL OR expires_at > NOW())
            LIMIT 1
          )
          INSERT INTO template_share_signups (share_id, user_id)
          SELECT share.id, $2
          FROM share
          ON CONFLICT (share_id, user_id) DO NOTHING
        `,
        [normalizedShareCode, userId]
      );
    }

    // No auto-friending - new users start with 0 friends
    return next();
  } catch (err) {
    console.error("Failed to sync user profile", err);
    return res.status(500).json({ error: "Failed to sync user profile" });
  }
};
