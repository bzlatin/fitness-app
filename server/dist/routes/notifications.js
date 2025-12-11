"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_1 = require("../db");
const nanoid_1 = require("nanoid");
const router = (0, express_1.Router)();
const nanoid = (0, nanoid_1.customAlphabet)("0123456789abcdefghijklmnopqrstuvwxyz", 12);
/**
 * Register/update user's push notification token
 */
router.post("/register-token", async (req, res) => {
    const userId = res.locals.userId;
    const { pushToken } = req.body;
    if (!pushToken) {
        return res.status(400).json({ error: "Push token is required" });
    }
    try {
        await (0, db_1.query)(`
        UPDATE users
        SET push_token = $1, updated_at = NOW()
        WHERE id = $2
        `, [pushToken, userId]);
        res.json({ success: true });
    }
    catch (error) {
        console.error("[Notifications] Error registering token:", error);
        res.status(500).json({ error: "Failed to register push token" });
    }
});
/**
 * Get user's notification preferences
 */
router.get("/preferences", async (req, res) => {
    const userId = res.locals.userId;
    try {
        const result = await (0, db_1.query)(`
        SELECT notification_preferences
        FROM users
        WHERE id = $1
        `, [userId]);
        if (!result.rows.length) {
            return res.status(404).json({ error: "User not found" });
        }
        res.json(result.rows[0].notification_preferences);
    }
    catch (error) {
        console.error("[Notifications] Error fetching preferences:", error);
        res.status(500).json({ error: "Failed to fetch preferences" });
    }
});
/**
 * Update user's notification preferences
 */
router.put("/preferences", async (req, res) => {
    const userId = res.locals.userId;
    const preferences = req.body;
    // Validate preferences structure
    const validKeys = [
        "goalReminders",
        "inactivityNudges",
        "squadActivity",
        "weeklyGoalMet",
        "quietHoursStart",
        "quietHoursEnd",
        "maxNotificationsPerWeek",
    ];
    const invalidKeys = Object.keys(preferences).filter((key) => !validKeys.includes(key));
    if (invalidKeys.length > 0) {
        return res.status(400).json({
            error: `Invalid preference keys: ${invalidKeys.join(", ")}`,
        });
    }
    // Validate quiet hours
    if (preferences.quietHoursStart !== undefined &&
        (preferences.quietHoursStart < 0 || preferences.quietHoursStart > 23)) {
        return res
            .status(400)
            .json({ error: "quietHoursStart must be between 0 and 23" });
    }
    if (preferences.quietHoursEnd !== undefined &&
        (preferences.quietHoursEnd < 0 || preferences.quietHoursEnd > 23)) {
        return res
            .status(400)
            .json({ error: "quietHoursEnd must be between 0 and 23" });
    }
    // Validate maxNotificationsPerWeek
    if (preferences.maxNotificationsPerWeek !== undefined &&
        (preferences.maxNotificationsPerWeek < 0 ||
            preferences.maxNotificationsPerWeek > 20)) {
        return res.status(400).json({
            error: "maxNotificationsPerWeek must be between 0 and 20",
        });
    }
    try {
        // Merge with existing preferences
        const result = await (0, db_1.query)(`
        UPDATE users
        SET notification_preferences = notification_preferences || $1::jsonb,
            updated_at = NOW()
        WHERE id = $2
        RETURNING notification_preferences
        `, [JSON.stringify(preferences), userId]);
        if (!result.rows.length) {
            return res.status(404).json({ error: "User not found" });
        }
        res.json(result.rows[0].notification_preferences);
    }
    catch (error) {
        console.error("[Notifications] Error updating preferences:", error);
        res.status(500).json({ error: "Failed to update preferences" });
    }
});
/**
 * Get user's notification inbox (last 30 days)
 */
router.get("/inbox", async (req, res) => {
    const userId = res.locals.userId;
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;
    try {
        const result = await (0, db_1.query)(`
      SELECT
        id,
        notification_type,
        trigger_reason,
        title,
        body,
        data,
        sent_at,
        read_at,
        clicked_at,
        delivery_status
      FROM notification_events
      WHERE user_id = $1
        AND sent_at >= NOW() - INTERVAL '30 days'
      ORDER BY sent_at DESC
      LIMIT $2 OFFSET $3
      `, [userId, limit, offset]);
        // Get unread count
        const unreadResult = await (0, db_1.query)(`
      SELECT COUNT(*) as count
      FROM notification_events
      WHERE user_id = $1
        AND read_at IS NULL
        AND sent_at >= NOW() - INTERVAL '30 days'
      `, [userId]);
        const unreadCount = parseInt(unreadResult.rows[0]?.count || "0", 10);
        res.json({
            notifications: result.rows,
            unreadCount,
            hasMore: result.rows.length === limit,
        });
    }
    catch (error) {
        console.error("[Notifications] Error fetching inbox:", error);
        res.status(500).json({ error: "Failed to fetch notifications" });
    }
});
/**
 * Mark notification as read
 */
router.post("/inbox/:id/read", async (req, res) => {
    const userId = res.locals.userId;
    const { id } = req.params;
    try {
        const result = await (0, db_1.query)(`
        UPDATE notification_events
        SET read_at = NOW()
        WHERE id = $1 AND user_id = $2 AND read_at IS NULL
        RETURNING id
        `, [id, userId]);
        if (!result.rows.length) {
            return res
                .status(404)
                .json({ error: "Notification not found or already read" });
        }
        res.json({ success: true });
    }
    catch (error) {
        console.error("[Notifications] Error marking as read:", error);
        res.status(500).json({ error: "Failed to mark notification as read" });
    }
});
/**
 * Mark notification as clicked
 */
router.post("/inbox/:id/clicked", async (req, res) => {
    const userId = res.locals.userId;
    const { id } = req.params;
    try {
        const result = await (0, db_1.query)(`
        UPDATE notification_events
        SET clicked_at = NOW(), read_at = COALESCE(read_at, NOW())
        WHERE id = $1 AND user_id = $2
        RETURNING id
        `, [id, userId]);
        if (!result.rows.length) {
            return res.status(404).json({ error: "Notification not found" });
        }
        res.json({ success: true });
    }
    catch (error) {
        console.error("[Notifications] Error marking as clicked:", error);
        res
            .status(500)
            .json({ error: "Failed to mark notification as clicked" });
    }
});
/**
 * Mark all notifications as read
 */
router.post("/inbox/mark-all-read", async (req, res) => {
    const userId = res.locals.userId;
    try {
        await (0, db_1.query)(`
        UPDATE notification_events
        SET read_at = NOW()
        WHERE user_id = $1 AND read_at IS NULL
        `, [userId]);
        res.json({ success: true });
    }
    catch (error) {
        console.error("[Notifications] Error marking all as read:", error);
        res
            .status(500)
            .json({ error: "Failed to mark all notifications as read" });
    }
});
/**
 * Delete notification from inbox
 */
router.delete("/inbox/:id", async (req, res) => {
    const userId = res.locals.userId;
    const { id } = req.params;
    try {
        const result = await (0, db_1.query)(`
        DELETE FROM notification_events
        WHERE id = $1 AND user_id = $2
        RETURNING id
        `, [id, userId]);
        if (!result.rows.length) {
            return res.status(404).json({ error: "Notification not found" });
        }
        res.json({ success: true });
    }
    catch (error) {
        console.error("[Notifications] Error deleting notification:", error);
        res.status(500).json({ error: "Failed to delete notification" });
    }
});
/**
 * Send a test notification (for development/testing)
 */
router.post("/send-test", async (req, res) => {
    const userId = res.locals.userId;
    try {
        const notificationId = nanoid();
        // Insert test notification into inbox
        await (0, db_1.query)(`
      INSERT INTO notification_events (
        id, user_id, notification_type, trigger_reason, title, body, data, sent_at, delivery_status
      ) VALUES (
        $1, $2, 'goal_risk', 'test', 'Test Notification',
        'This is a test notification to verify your inbox is working correctly.',
        $3::jsonb, NOW(), 'delivered'
      )
      `, [notificationId, userId, JSON.stringify({ test: true })]);
        res.json({
            success: true,
            notificationId,
            message: "Test notification sent to inbox"
        });
    }
    catch (error) {
        console.error("[Notifications] Error sending test notification:", error);
        res.status(500).json({ error: "Failed to send test notification" });
    }
});
/**
 * Manual trigger for notification job (testing/admin only)
 */
router.post("/admin/trigger-job", async (req, res) => {
    try {
        console.log("[Admin] Manually triggering notification job...");
        const { processNotifications } = await Promise.resolve().then(() => __importStar(require("../jobs/notifications")));
        await processNotifications();
        res.json({
            success: true,
            message: "Notification job completed successfully"
        });
    }
    catch (error) {
        console.error("[Admin] Error running notification job:", error);
        res.status(500).json({
            error: "Job failed",
            details: error instanceof Error ? error.message : "Unknown error"
        });
    }
});
exports.default = router;
