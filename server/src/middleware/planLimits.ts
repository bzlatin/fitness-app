import { RequestHandler } from "express";
import { query } from "../db";

/**
 * Middleware to enforce Pro plan requirement
 * Returns 403 if user is not on a Pro plan
 */
export const requireProPlan: RequestHandler = async (req, res, next) => {
  const userId = res.locals.userId;

  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const result = await query<{ plan: string; plan_expires_at: string | null }>(
      `SELECT plan, plan_expires_at FROM users WHERE id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    const user = result.rows[0];

    // Check if user has pro or lifetime plan
    if (user.plan !== "pro" && user.plan !== "lifetime") {
      return res.status(403).json({
        error: "Pro plan required",
        message:
          "This feature requires a Pro subscription. Upgrade to access smart workout generation.",
        requiresUpgrade: true,
      });
    }

    // Check if plan has expired (if expiration is set)
    if (user.plan_expires_at) {
      const expiresAt = new Date(user.plan_expires_at);
      if (expiresAt < new Date()) {
        return res.status(403).json({
          error: "Pro plan expired",
          message: "Your Pro subscription has expired. Please renew to continue using this feature.",
          requiresUpgrade: true,
        });
      }
    }

    // User has valid Pro plan
    return next();
  } catch (error) {
    console.error("[PlanLimits] Error checking plan:", error);
    return res.status(500).json({ error: "Failed to verify subscription status" });
  }
};

/**
 * Gate AI workout generation.
 * - Pro/lifetime: allowed (must not be expired)
 * - Free: 1 lifetime AI workout generation
 *
 * Note: for free users, this reserves the one-time generation up-front to avoid
 * concurrent requests consuming multiple "free" generations.
 * The caller should roll back the reservation if generation fails.
 */
export const checkAiWorkoutGenerationLimit: RequestHandler = async (
  _req,
  res,
  next
) => {
  const userId = res.locals.userId as string | undefined;

  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const userResult = await query<{
      plan: string;
      plan_expires_at: string | null;
      ai_generations_used_count: number;
    }>(
      `
        SELECT
          plan,
          plan_expires_at,
          COALESCE(ai_generations_used_count, 0) as ai_generations_used_count
        FROM users
        WHERE id = $1
      `,
      [userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    const user = userResult.rows[0];
    const plan = user.plan ?? "free";

    // Pro/lifetime users must have an active subscription (or lifetime access)
    if (plan === "pro" || plan === "lifetime") {
      if (user.plan_expires_at) {
        const expiresAt = new Date(user.plan_expires_at);
        if (expiresAt < new Date()) {
          return res.status(403).json({
            error: "Pro plan expired",
            message:
              "Your Pro subscription has expired. Please renew to continue using this feature.",
            requiresUpgrade: true,
          });
        }
      }
      return next();
    }

    const FREE_AI_GENERATION_LIMIT = 1;
    const used = Math.max(0, Number(user.ai_generations_used_count ?? 0));

    if (used >= FREE_AI_GENERATION_LIMIT) {
      return res.status(403).json({
        error: "Free smart workout used",
        message: "You've used your free smart workout. Upgrade for unlimited!",
        requiresUpgrade: true,
      });
    }

    // Reserve the free generation so concurrent requests can't double-spend it.
    const reserve = await query<{ ai_generations_used_count: number }>(
      `
        UPDATE users
        SET ai_generations_used_count = ai_generations_used_count + 1
        WHERE id = $1
          AND ai_generations_used_count < $2
        RETURNING ai_generations_used_count
      `,
      [userId, FREE_AI_GENERATION_LIMIT]
    );

    if (reserve.rows.length === 0) {
      return res.status(403).json({
        error: "Free smart workout used",
        message: "You've used your free smart workout. Upgrade for unlimited!",
        requiresUpgrade: true,
      });
    }

    res.locals.aiFreeWorkoutGenerationReserved = true;
    return next();
  } catch (error) {
    console.error("[PlanLimits] Error checking AI generation limit:", error);
    return res.status(500).json({ error: "Failed to verify AI generation limit" });
  }
};

/**
 * Check if user can create another template (free tier limit: 3)
 */
export const checkTemplateLimit: RequestHandler = async (req, res, next) => {
  const userId = res.locals.userId;

  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const userResult = await query<{ plan: string }>(
      `SELECT plan FROM users WHERE id = $1`,
      [userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    const user = userResult.rows[0];

    // Pro and lifetime users have no limit
    if (user.plan === "pro" || user.plan === "lifetime") {
      return next();
    }

    // Free users: check template count
    const countResult = await query<{ count: string }>(
      `SELECT COUNT(*) as count FROM workout_templates WHERE user_id = $1`,
      [userId]
    );

    const templateCount = parseInt(countResult.rows[0]?.count || "0");
    const FREE_TIER_LIMIT = 3;

    if (templateCount >= FREE_TIER_LIMIT) {
      return res.status(403).json({
        error: "Template limit reached",
        message: `You've reached the free tier limit of ${FREE_TIER_LIMIT} workout templates. Upgrade to Pro for unlimited templates.`,
        requiresUpgrade: true,
      });
    }

    return next();
  } catch (error) {
    console.error("[PlanLimits] Error checking template limit:", error);
    return res.status(500).json({ error: "Failed to verify template limit" });
  }
};

/**
 * Check if user can create another custom exercise
 * Free tier: 3 custom exercises max
 * Pro tier: unlimited
 */
export const checkCustomExerciseLimit: RequestHandler = async (req, res, next) => {
  const userId = res.locals.userId;

  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const userResult = await query<{ plan: string }>(
      `SELECT plan FROM users WHERE id = $1`,
      [userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    const user = userResult.rows[0];

    // Pro and lifetime users have no limit
    if (user.plan === "pro" || user.plan === "lifetime") {
      return next();
    }

    // Free users: check custom exercise count (exclude soft-deleted)
    const countResult = await query<{ count: string }>(
      `SELECT COUNT(*) as count FROM user_exercises
       WHERE user_id = $1 AND deleted_at IS NULL`,
      [userId]
    );

    const exerciseCount = parseInt(countResult.rows[0]?.count || "0");
    const FREE_TIER_LIMIT = 3;

    if (exerciseCount >= FREE_TIER_LIMIT) {
      return res.status(403).json({
        error: "Custom exercise limit reached",
        message: `You've reached the free tier limit of ${FREE_TIER_LIMIT} custom exercises. Upgrade to Pro for unlimited custom exercises.`,
        requiresUpgrade: true,
      });
    }

    return next();
  } catch (error) {
    console.error("[PlanLimits] Error checking custom exercise limit:", error);
    return res.status(500).json({ error: "Failed to verify custom exercise limit" });
  }
};
