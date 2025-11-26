"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ensureUser = exports.attachUser = exports.maybeRequireAuth = exports.requireAuth = void 0;
const express_oauth2_jwt_bearer_1 = require("express-oauth2-jwt-bearer");
const db_1 = require("../db");
const workouts_1 = require("../types/workouts");
const mockUsers_1 = require("../data/mockUsers");
const { AUTH0_DOMAIN, AUTH0_AUDIENCE } = process.env;
const ALLOW_DEV_AUTH_BYPASS = process.env.ALLOW_DEV_AUTH_BYPASS === "true";
const DEV_USER_ID = process.env.DEV_USER_ID || workouts_1.DEMO_USER_ID;
if (!AUTH0_DOMAIN) {
    throw new Error("AUTH0_DOMAIN is not set. Please add it to your .env.");
}
if (!AUTH0_AUDIENCE) {
    throw new Error("AUTH0_AUDIENCE is not set. Please add it to your .env.");
}
exports.requireAuth = (0, express_oauth2_jwt_bearer_1.auth)({
    audience: AUTH0_AUDIENCE,
    issuerBaseURL: `https://${AUTH0_DOMAIN}/`,
    tokenSigningAlg: "RS256",
});
const maybeRequireAuth = (req, res, next) => {
    // Helpful during local dev when Auth0 tokens are missing; do NOT enable in prod.
    if (ALLOW_DEV_AUTH_BYPASS && !req.headers.authorization) {
        res.locals.userId = DEV_USER_ID;
        return next();
    }
    return (0, exports.requireAuth)(req, res, next);
};
exports.maybeRequireAuth = maybeRequireAuth;
const attachUser = (_req, res, next) => {
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
exports.attachUser = attachUser;
const normalizeClaim = (value) => typeof value === "string" && value.trim().length > 0 ? value : undefined;
const insertFollowPairs = async (pairs) => {
    if (pairs.length === 0)
        return;
    const values = pairs
        .map((_, index) => `($${index * 2 + 1}, $${index * 2 + 2})`)
        .join(", ");
    const params = pairs.flat();
    await (0, db_1.query)(`
      INSERT INTO follows (user_id, target_user_id)
      SELECT v.user_id, v.target_user_id
      FROM (VALUES ${values}) AS v(user_id, target_user_id)
      WHERE EXISTS (SELECT 1 FROM users u WHERE u.id = v.user_id)
        AND EXISTS (SELECT 1 FROM users u WHERE u.id = v.target_user_id)
      ON CONFLICT DO NOTHING
    `, params);
};
const ensureUser = async (req, res, next) => {
    const userId = res.locals.userId;
    if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
    }
    const payload = req.auth?.payload ?? {};
    const email = normalizeClaim(payload.email);
    const name = normalizeClaim(payload.name) ??
        normalizeClaim(payload.nickname);
    // Only seed mutual follows with mock users on the very first creation of a user
    // to avoid re-adding follows after someone intentionally unfriends.
    try {
        const insertResult = await (0, db_1.query)(`
        INSERT INTO users (id, email, name)
        VALUES ($1, $2, $3)
        ON CONFLICT (id) DO NOTHING
        RETURNING id
      `, [userId, email ?? null, name ?? null]);
        const isNewUser = (insertResult?.rowCount ?? 0) > 0;
        if (!isNewUser) {
            await (0, db_1.query)(`
          UPDATE users
          SET email = COALESCE($2, users.email),
              name = COALESCE($3, users.name),
              plan = COALESCE(users.plan, 'free'),
              updated_at = NOW()
          WHERE id = $1
        `, [userId, email ?? null, name ?? null]);
        }
        if (isNewUser && userId !== workouts_1.DEMO_USER_ID) {
            const followTargets = mockUsers_1.MOCK_USER_IDS.filter((id) => id !== userId);
            const followPairs = [];
            for (const targetId of followTargets) {
                followPairs.push([userId, targetId], [targetId, userId]);
            }
            await insertFollowPairs(followPairs);
        }
        return next();
    }
    catch (err) {
        console.error("Failed to sync user profile", err);
        return res.status(500).json({ error: "Failed to sync user profile" });
    }
};
exports.ensureUser = ensureUser;
