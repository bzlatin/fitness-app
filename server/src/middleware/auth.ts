import { RequestHandler } from "express";
import { auth } from "express-oauth2-jwt-bearer";
import { query } from "../db";

const { AUTH0_DOMAIN, AUTH0_AUDIENCE } = process.env;

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

export const attachUser: RequestHandler = (_req, res, next) => {
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

  try {
    await query(
      `
        INSERT INTO users (id, email, name)
        VALUES ($1, $2, $3)
        ON CONFLICT (id) DO UPDATE
        SET email = COALESCE($2, users.email),
            name = COALESCE($3, users.name),
            updated_at = NOW()
      `,
      [userId, email ?? null, name ?? null]
    );
    return next();
  } catch (err) {
    console.error("Failed to sync user profile", err);
    return res.status(500).json({ error: "Failed to sync user profile" });
  }
};
