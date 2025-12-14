import { Router } from "express";
import { query } from "../db";
import { generateId } from "../utils/id";
import { validateProfanity } from "../middleware/profanityFilter";
import { feedbackCreateLimiter, feedbackReportLimiter } from "../middleware/rateLimit";
import { z } from "zod";
import { validateBody } from "../middleware/validate";

const router = Router();

const createFeedbackSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    description: z.string().trim().min(1).max(2000),
    category: z.enum([
      "feature_request",
      "bug_report",
      "ui_ux_improvement",
      "performance",
      "social_features",
    ]),
    impact: z.enum([
      "critical",
      "high",
      "medium",
      "low",
      "must_have",
      "nice_to_have",
    ]),
  })
  .strip();

const reportFeedbackSchema = z
  .object({
    reason: z.string().trim().min(1).max(500),
  })
  .strip();

type FeedbackCategory =
  | "feature_request"
  | "bug_report"
  | "ui_ux_improvement"
  | "performance"
  | "social_features";

type FeedbackImpact =
  | "critical"
  | "high"
  | "medium"
  | "low"
  | "must_have"
  | "nice_to_have";

type FeedbackStatus =
  | "submitted"
  | "under_review"
  | "planned"
  | "in_progress"
  | "shipped"
  | "wont_fix"
  | "duplicate";

type FeedbackItemRow = {
  id: string;
  user_id: string;
  title: string;
  description: string;
  category: FeedbackCategory;
  impact: FeedbackImpact;
  status: FeedbackStatus;
  vote_count: number;
  is_hidden: boolean;
  auto_hidden_at: string | null;
  created_at: string;
  updated_at: string;
  status_updated_at: string | null;
  status_updated_by: string | null;
  user_name: string | null;
  user_handle: string | null;
  user_avatar_url: string | null;
  user_has_voted: boolean;
  report_count: number;
};

type FeedbackItem = {
  id: string;
  userId: string;
  title: string;
  description: string;
  category: FeedbackCategory;
  impact: FeedbackImpact;
  status: FeedbackStatus;
  voteCount: number;
  isHidden: boolean;
  autoHiddenAt: string | null;
  createdAt: string;
  updatedAt: string;
  statusUpdatedAt: string | null;
  statusUpdatedBy: string | null;
  user: {
    name: string;
    handle: string | null;
    avatarUrl: string | null;
  };
  userHasVoted: boolean;
  reportCount: number;
};

const mapFeedbackRow = (row: FeedbackItemRow): FeedbackItem => ({
  id: row.id,
  userId: row.user_id,
  title: row.title,
  description: row.description,
  category: row.category,
  impact: row.impact,
  status: row.status,
  voteCount: row.vote_count,
  isHidden: row.is_hidden,
  autoHiddenAt: row.auto_hidden_at,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  statusUpdatedAt: row.status_updated_at,
  statusUpdatedBy: row.status_updated_by,
  user: {
    name: row.user_name ?? "Anonymous",
    handle: row.user_handle,
    avatarUrl: row.user_avatar_url,
  },
  userHasVoted: row.user_has_voted,
  reportCount: row.report_count,
});

/**
 * Check if user is an admin
 */
const isAdmin = async (userId: string): Promise<boolean> => {
  const result = await query(
    `SELECT 1 FROM admin_users WHERE user_id = $1 LIMIT 1`,
    [userId]
  );
  return (result.rowCount ?? 0) > 0;
};

/**
 * GET /api/feedback
 * List all feedback items with filtering and sorting
 */
router.get("/", async (req, res) => {
  const userId = res.locals.userId;
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const {
    sort = "trending",
    status,
    category,
    showHidden = "false",
  } = req.query as {
    sort?: "trending" | "top" | "recent";
    status?: FeedbackStatus;
    category?: FeedbackCategory;
    showHidden?: string;
  };

  const userIsAdmin = await isAdmin(userId);

  try {
    let orderBy = "";
    switch (sort) {
      case "top":
        orderBy = "f.vote_count DESC, f.created_at DESC";
        break;
      case "recent":
        orderBy = "f.created_at DESC";
        break;
      case "trending":
      default:
        // Weighted score: recent votes count more
        // Score = vote_count * (1 + recency_factor)
        // recency_factor = 1 / (days_since_creation + 1)
        orderBy = `(f.vote_count * (1.0 + 1.0 / (EXTRACT(EPOCH FROM (NOW() - f.created_at)) / 86400.0 + 1.0))) DESC, f.created_at DESC`;
        break;
    }

    const conditions: string[] = [];
    const params: unknown[] = [userId];
    let paramIdx = 2;

    // Only show hidden items to admins
    if (!userIsAdmin || showHidden === "false") {
      conditions.push("f.is_hidden = false");
    }

    if (status) {
      conditions.push(`f.status = $${paramIdx}`);
      params.push(status);
      paramIdx += 1;
    }

    if (category) {
      conditions.push(`f.category = $${paramIdx}`);
      params.push(category);
      paramIdx += 1;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const result = await query<FeedbackItemRow>(
      `
        SELECT
          f.*,
          u.name AS user_name,
          u.handle AS user_handle,
          u.avatar_url AS user_avatar_url,
          EXISTS(
            SELECT 1 FROM feedback_votes fv
            WHERE fv.feedback_item_id = f.id AND fv.user_id = $1
          ) AS user_has_voted,
          (
            SELECT COUNT(*)::int FROM feedback_reports fr
            WHERE fr.feedback_item_id = f.id
          ) AS report_count
        FROM feedback_items f
        LEFT JOIN users u ON u.id = f.user_id
        ${whereClause}
        ORDER BY ${orderBy}
        LIMIT 100
      `,
      params
    );

    const items = result.rows.map(mapFeedbackRow);
    return res.json({ items });
  } catch (err) {
    console.error("Failed to fetch feedback items", err);
    return res.status(500).json({ error: "Failed to fetch feedback items" });
  }
});

/**
 * GET /api/feedback/new-shipped-count
 * Get count of newly shipped items (for badge indicator)
 */
router.get("/new-shipped-count", async (req, res) => {
  const userId = res.locals.userId;
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    // Count shipped items from the last 7 days that the user voted on
    const result = await query<{ count: string }>(
      `
        SELECT COUNT(*)::text AS count
        FROM feedback_items f
        INNER JOIN feedback_votes fv ON fv.feedback_item_id = f.id
        WHERE fv.user_id = $1
          AND f.status = 'shipped'
          AND f.status_updated_at > NOW() - INTERVAL '7 days'
          AND f.is_hidden = false
      `,
      [userId]
    );

    return res.json({ count: parseInt(result.rows[0]?.count ?? "0", 10) });
  } catch (err) {
    console.error("Failed to fetch new shipped count", err);
    return res.status(500).json({ error: "Failed to fetch count" });
  }
});

/**
 * POST /api/feedback
 * Create a new feedback item
 */
router.post(
  "/",
  async (req, res, next) => {
    // Set admin status for rate limiting
    const userId = res.locals.userId;
    if (userId) {
      res.locals.isAdmin = await isAdmin(userId);
    }
    next();
  },
  feedbackCreateLimiter,
  validateBody(createFeedbackSchema),
  validateProfanity(["title", "description"]),
  async (req, res) => {
    const userId = res.locals.userId;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { title, description, category, impact } =
      req.body as z.infer<typeof createFeedbackSchema>;

    try {
      const id = generateId();
      const result = await query<FeedbackItemRow>(
        `
          INSERT INTO feedback_items (
            id,
            user_id,
            title,
            description,
            category,
            impact,
            status,
            vote_count,
            created_at,
            updated_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, 'submitted', 0, NOW(), NOW())
          RETURNING *,
            (SELECT name FROM users WHERE id = $2) AS user_name,
            (SELECT handle FROM users WHERE id = $2) AS user_handle,
            (SELECT avatar_url FROM users WHERE id = $2) AS user_avatar_url,
            false AS user_has_voted,
            0 AS report_count
        `,
        [id, userId, title.trim(), description.trim(), category, impact]
      );

      const item = mapFeedbackRow(result.rows[0]);
      return res.status(201).json({ item });
    } catch (err) {
      console.error("Failed to create feedback item", err);
      return res.status(500).json({ error: "Failed to create feedback item" });
    }
  }
);

/**
 * POST /api/feedback/:id/vote
 * Toggle vote on a feedback item
 */
router.post("/:id/vote", async (req, res) => {
  const userId = res.locals.userId;
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { id } = req.params;

  try {
    // Check if feedback item exists
    const feedbackCheck = await query(
      `SELECT 1 FROM feedback_items WHERE id = $1 AND is_hidden = false LIMIT 1`,
      [id]
    );

    if (feedbackCheck.rowCount === 0) {
      return res.status(404).json({ error: "Feedback item not found" });
    }

    // Check if user has already voted
    const voteCheck = await query(
      `SELECT 1 FROM feedback_votes WHERE feedback_item_id = $1 AND user_id = $2 LIMIT 1`,
      [id, userId]
    );

    if ((voteCheck.rowCount ?? 0) > 0) {
      // Remove vote
      await query(
        `DELETE FROM feedback_votes WHERE feedback_item_id = $1 AND user_id = $2`,
        [id, userId]
      );

      await query(
        `UPDATE feedback_items SET vote_count = vote_count - 1 WHERE id = $1`,
        [id]
      );

      return res.json({ voted: false });
    } else {
      // Add vote
      const voteId = generateId();
      await query(
        `INSERT INTO feedback_votes (id, feedback_item_id, user_id, created_at) VALUES ($1, $2, $3, NOW())`,
        [voteId, id, userId]
      );

      await query(
        `UPDATE feedback_items SET vote_count = vote_count + 1 WHERE id = $1`,
        [id]
      );

      return res.json({ voted: true });
    }
  } catch (err) {
    console.error("Failed to toggle vote", err);
    return res.status(500).json({ error: "Failed to toggle vote" });
  }
});

/**
 * PUT /api/feedback/:id/status
 * Update feedback item status (admin only)
 */
router.put("/:id/status", async (req, res) => {
  const userId = res.locals.userId;
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const userIsAdmin = await isAdmin(userId);
  if (!userIsAdmin) {
    return res.status(403).json({ error: "Admin access required" });
  }

  const { id } = req.params;
  const { status } = req.body as { status: FeedbackStatus };

  const validStatuses: FeedbackStatus[] = [
    "submitted",
    "under_review",
    "planned",
    "in_progress",
    "shipped",
    "wont_fix",
    "duplicate",
  ];

  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: "Invalid status" });
  }

  try {
    const result = await query<FeedbackItemRow>(
      `
        UPDATE feedback_items
        SET status = $1,
            status_updated_at = NOW(),
            status_updated_by = $2,
            updated_at = NOW()
        WHERE id = $3
        RETURNING *,
          (SELECT name FROM users WHERE id = user_id) AS user_name,
          (SELECT handle FROM users WHERE id = user_id) AS user_handle,
          (SELECT avatar_url FROM users WHERE id = user_id) AS user_avatar_url,
          EXISTS(
            SELECT 1 FROM feedback_votes WHERE feedback_item_id = $3 AND user_id = $2
          ) AS user_has_voted,
          (SELECT COUNT(*)::int FROM feedback_reports WHERE feedback_item_id = $3) AS report_count
      `,
      [status, userId, id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Feedback item not found" });
    }

    const item = mapFeedbackRow(result.rows[0]);
    return res.json({ item });
  } catch (err) {
    console.error("Failed to update status", err);
    return res.status(500).json({ error: "Failed to update status" });
  }
});

/**
 * POST /api/feedback/:id/report
 * Report a feedback item for moderation
 */
router.post("/:id/report", feedbackReportLimiter, validateBody(reportFeedbackSchema), async (req, res) => {
  const userId = res.locals.userId;
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { id } = req.params;
  const { reason } = req.body as z.infer<typeof reportFeedbackSchema>;

  try {
    // Check if feedback item exists
    const feedbackCheck = await query<{ id: string; is_hidden: boolean }>(
      `SELECT id, is_hidden FROM feedback_items WHERE id = $1 LIMIT 1`,
      [id]
    );

    if (feedbackCheck.rowCount === 0) {
      return res.status(404).json({ error: "Feedback item not found" });
    }

    const feedbackItem = feedbackCheck.rows[0];

    // Check if user has already reported this item
    const reportCheck = await query(
      `SELECT 1 FROM feedback_reports WHERE feedback_item_id = $1 AND reported_by = $2 LIMIT 1`,
      [id, userId]
    );

    if ((reportCheck.rowCount ?? 0) > 0) {
      return res.status(409).json({ error: "You have already reported this item" });
    }

    // Create report
    const reportId = generateId();
    await query(
      `
        INSERT INTO feedback_reports (
          id,
          feedback_item_id,
          reported_by,
          reason,
          created_at,
          action_taken
        )
        VALUES ($1, $2, $3, $4, NOW(), 'pending')
      `,
      [reportId, id, userId, reason.trim()]
    );

    // Get total report count
    const reportCountResult = await query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM feedback_reports WHERE feedback_item_id = $1`,
      [id]
    );

    const reportCount = parseInt(reportCountResult.rows[0]?.count ?? "0", 10);

    // Auto-hide if 5 or more reports and not already hidden
    const AUTO_HIDE_THRESHOLD = 5;
    if (reportCount >= AUTO_HIDE_THRESHOLD && !feedbackItem.is_hidden) {
      await query(
        `
          UPDATE feedback_items
          SET is_hidden = true,
              auto_hidden_at = NOW(),
              updated_at = NOW()
          WHERE id = $1
        `,
        [id]
      );

      return res.json({
        success: true,
        message: "Report submitted. This item has been auto-hidden due to multiple reports.",
        reportCount,
      });
    }

    return res.json({
      success: true,
      message: "Report submitted successfully. Admins will review it shortly.",
      reportCount,
    });
  } catch (err) {
    console.error("Failed to report feedback item", err);
    return res.status(500).json({ error: "Failed to submit report" });
  }
});

/**
 * GET /api/feedback/reports
 * Get all pending reports (admin only)
 */
router.get("/reports", async (req, res) => {
  const userId = res.locals.userId;
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const userIsAdmin = await isAdmin(userId);
  if (!userIsAdmin) {
    return res.status(403).json({ error: "Admin access required" });
  }

  try {
    const result = await query(
      `
        SELECT
          fr.id,
          fr.feedback_item_id,
          fr.reported_by,
          fr.reason,
          fr.created_at,
          fr.reviewed_at,
          fr.reviewed_by,
          fr.action_taken,
          f.title AS feedback_title,
          f.description AS feedback_description,
          f.is_hidden AS feedback_is_hidden,
          u.name AS reporter_name,
          u.handle AS reporter_handle
        FROM feedback_reports fr
        INNER JOIN feedback_items f ON f.id = fr.feedback_item_id
        LEFT JOIN users u ON u.id = fr.reported_by
        WHERE fr.action_taken = 'pending'
        ORDER BY fr.created_at DESC
        LIMIT 100
      `
    );

    return res.json({ reports: result.rows });
  } catch (err) {
    console.error("Failed to fetch reports", err);
    return res.status(500).json({ error: "Failed to fetch reports" });
  }
});

/**
 * PUT /api/feedback/reports/:reportId
 * Review a report (admin only)
 */
router.put("/reports/:reportId", async (req, res) => {
  const userId = res.locals.userId;
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const userIsAdmin = await isAdmin(userId);
  if (!userIsAdmin) {
    return res.status(403).json({ error: "Admin access required" });
  }

  const { reportId } = req.params;
  const { action, hideFeedback } = req.body as {
    action: "hidden" | "dismissed";
    hideFeedback?: boolean;
  };

  if (!["hidden", "dismissed"].includes(action)) {
    return res.status(400).json({ error: "Invalid action" });
  }

  try {
    // Get the report and feedback item
    const reportResult = await query<{ feedback_item_id: string }>(
      `SELECT feedback_item_id FROM feedback_reports WHERE id = $1 LIMIT 1`,
      [reportId]
    );

    if (reportResult.rowCount === 0) {
      return res.status(404).json({ error: "Report not found" });
    }

    const { feedback_item_id } = reportResult.rows[0];

    // Update report
    await query(
      `
        UPDATE feedback_reports
        SET action_taken = $1,
            reviewed_at = NOW(),
            reviewed_by = $2
        WHERE id = $3
      `,
      [action, userId, reportId]
    );

    // Hide feedback item if requested
    if (hideFeedback && action === "hidden") {
      await query(
        `
          UPDATE feedback_items
          SET is_hidden = true,
              updated_at = NOW()
          WHERE id = $1
        `,
        [feedback_item_id]
      );
    }

    return res.json({ success: true });
  } catch (err) {
    console.error("Failed to review report", err);
    return res.status(500).json({ error: "Failed to review report" });
  }
});

/**
 * GET /api/feedback/admin-check
 * Check if current user is an admin
 */
router.get("/admin-check", async (req, res) => {
  const userId = res.locals.userId;
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const userIsAdmin = await isAdmin(userId);
  return res.json({ isAdmin: userIsAdmin });
});

/**
 * DELETE /api/feedback/:id
 * Delete a feedback item
 * - Users can delete their own feedback
 * - Admins can delete any feedback
 */
router.delete("/:id", async (req, res) => {
  const userId = res.locals.userId;
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { id } = req.params;

  try {
    // Check if feedback item exists and get owner
    const feedbackCheck = await query<{ user_id: string }>(
      `SELECT user_id FROM feedback_items WHERE id = $1 LIMIT 1`,
      [id]
    );

    if (feedbackCheck.rowCount === 0) {
      return res.status(404).json({ error: "Feedback item not found" });
    }

    const feedbackItem = feedbackCheck.rows[0];
    const userIsAdmin = await isAdmin(userId);

    // Check permissions: must be owner or admin
    if (feedbackItem.user_id !== userId && !userIsAdmin) {
      return res.status(403).json({ error: "You don't have permission to delete this feedback" });
    }

    // Delete the feedback item (cascade will delete votes and reports)
    await query(
      `DELETE FROM feedback_items WHERE id = $1`,
      [id]
    );

    return res.json({ success: true, message: "Feedback deleted successfully" });
  } catch (err) {
    console.error("Failed to delete feedback item", err);
    return res.status(500).json({ error: "Failed to delete feedback item" });
  }
});

export default router;
