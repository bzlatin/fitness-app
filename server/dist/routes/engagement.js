"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_1 = require("../db");
const router = (0, express_1.Router)();
/**
 * GET /api/engagement/widget-data
 * Fetch data for iOS widgets
 *
 * Returns:
 * - weeklyGoal: User's weekly workout goal
 * - currentProgress: Workouts completed this week
 * - userName: User's display name
 * - userHandle: User's handle
 * - currentStreak: Current workout streak in days
 * - lastWorkoutDate: ISO date of last completed workout
 */
router.get("/widget-data", async (req, res) => {
    try {
        const userId = res.locals.userId;
        if (!userId) {
            return res.status(401).json({ error: "Unauthorized" });
        }
        // Fetch user data
        const userResult = await (0, db_1.query)(`SELECT
        name,
        handle,
        weekly_goal
       FROM users
       WHERE id = $1`, [userId]);
        if (userResult.rows.length === 0) {
            return res.status(404).json({ error: "User not found" });
        }
        const user = userResult.rows[0];
        const weeklyGoal = user.weekly_goal ?? 4;
        // Calculate start of current week (Monday) in UTC - matches sessions.ts logic
        const now = new Date();
        const dayOfWeek = now.getUTCDay(); // Use UTC day
        const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Sunday is 0
        const weekStart = new Date(now);
        weekStart.setUTCDate(now.getUTCDate() - daysFromMonday);
        weekStart.setUTCHours(0, 0, 0, 0);
        // Count unique workout DAYS this week (not sessions) - matches sessions.ts logic
        // Use finished_at and started_at for consistency with sessions.ts
        const workoutsThisWeekResult = await (0, db_1.query)(`SELECT COUNT(DISTINCT DATE(started_at)) as count
       FROM workout_sessions
       WHERE user_id = $1
       AND started_at >= $2
       AND started_at < $3
       AND finished_at IS NOT NULL`, [userId, weekStart.toISOString(), new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString()]);
        const currentProgress = parseInt(workoutsThisWeekResult.rows[0]?.count || "0", 10);
        // Get last workout date (use finished_at for completed workouts)
        const lastWorkoutResult = await (0, db_1.query)(`SELECT finished_at
       FROM workout_sessions
       WHERE user_id = $1
       AND finished_at IS NOT NULL
       ORDER BY finished_at DESC
       LIMIT 1`, [userId]);
        const lastWorkoutDate = lastWorkoutResult.rows[0]?.finished_at || null;
        // Calculate current streak (use finished_at for completed workouts)
        const streakResult = await (0, db_1.query)(`WITH daily_workouts AS (
        SELECT DISTINCT DATE(finished_at) as workout_date
        FROM workout_sessions
        WHERE user_id = $1
        AND finished_at IS NOT NULL
        ORDER BY workout_date DESC
      ),
      streaks AS (
        SELECT
          workout_date,
          workout_date - ROW_NUMBER() OVER (ORDER BY workout_date DESC)::int as streak_group
        FROM daily_workouts
      )
      SELECT COUNT(*) as streak_days
      FROM streaks
      WHERE streak_group = (
        SELECT streak_group
        FROM streaks
        LIMIT 1
      )
      AND workout_date >= CURRENT_DATE - interval '1 day'`, [userId]);
        const currentStreak = parseInt(streakResult.rows[0]?.streak_days || "0", 10);
        // Return widget data
        const widgetData = {
            weeklyGoal,
            currentProgress,
            userName: user.name,
            userHandle: user.handle,
            currentStreak,
            lastWorkoutDate: lastWorkoutDate ? new Date(lastWorkoutDate).toISOString() : null,
        };
        // Set cache headers for widget refresh optimization
        res.set("Cache-Control", "private, max-age=900"); // 15 minutes cache
        return res.json(widgetData);
    }
    catch (error) {
        console.error("Error fetching widget data:", error);
        return res.status(500).json({ error: "Failed to fetch widget data" });
    }
});
exports.default = router;
