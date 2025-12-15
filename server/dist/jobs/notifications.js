"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendFriendAcceptanceNotification = exports.sendFriendRequestNotification = exports.sendSquadActivityNotification = exports.processNotifications = void 0;
const db_1 = require("../db");
const expo_server_sdk_1 = require("expo-server-sdk");
const id_1 = require("../utils/id");
const nanoid = (0, id_1.createIdGenerator)("0123456789abcdefghijklmnopqrstuvwxyz", 12);
const expo = new expo_server_sdk_1.Expo();
/**
 * Check if current time is within quiet hours (local to server timezone)
 */
const isQuietHours = (preferences) => {
    const now = new Date();
    const currentHour = now.getHours();
    const { quietHoursStart, quietHoursEnd } = preferences;
    // Handle overnight quiet hours (e.g., 22:00 to 8:00)
    if (quietHoursStart > quietHoursEnd) {
        return currentHour >= quietHoursStart || currentHour < quietHoursEnd;
    }
    return currentHour >= quietHoursStart && currentHour < quietHoursEnd;
};
/**
 * Check if user has hit their weekly notification cap
 */
const hasReachedWeeklyCap = async (userId, maxNotifications) => {
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const result = await (0, db_1.query)(`
    SELECT COUNT(*) as count
    FROM notification_events
    WHERE user_id = $1
      AND sent_at >= $2
      AND delivery_status = 'sent'
    `, [userId, oneWeekAgo.toISOString()]);
    const count = parseInt(result.rows[0]?.count || "0", 10);
    return count >= maxNotifications;
};
/**
 * Send a push notification to a user and log to database
 */
const sendNotification = async (user, notification) => {
    const notificationId = nanoid();
    // Check quiet hours
    if (isQuietHours(user.notificationPreferences)) {
        console.log(`[Notifications] Skipped ${notification.type} for ${user.id} - quiet hours`);
        return;
    }
    // Check weekly cap
    const reachedCap = await hasReachedWeeklyCap(user.id, user.notificationPreferences.maxNotificationsPerWeek);
    if (reachedCap) {
        console.log(`[Notifications] Skipped ${notification.type} for ${user.id} - weekly cap reached`);
        return;
    }
    let deliveryStatus = "sent";
    let errorMessage = null;
    // Send push notification if user has a valid push token
    if (user.pushToken && expo_server_sdk_1.Expo.isExpoPushToken(user.pushToken)) {
        try {
            const message = {
                to: user.pushToken,
                sound: "default",
                title: notification.title,
                body: notification.body,
                data: notification.data || {},
            };
            const ticketChunk = await expo.sendPushNotificationsAsync([message]);
            const ticket = ticketChunk[0];
            if (ticket.status === "error") {
                deliveryStatus = "failed";
                errorMessage =
                    "message" in ticket ? ticket.message : "Unknown error";
                console.error(`[Notifications] Error sending to ${user.id}:`, ticket);
            }
        }
        catch (error) {
            deliveryStatus = "failed";
            errorMessage =
                error instanceof Error ? error.message : "Unknown error";
            console.error(`[Notifications] Exception sending to ${user.id}:`, error);
        }
    }
    else {
        deliveryStatus = "no_token";
    }
    // Log notification event to database
    await (0, db_1.query)(`
    INSERT INTO notification_events (
      id,
      user_id,
      notification_type,
      trigger_reason,
      title,
      body,
      data,
      delivery_status,
      error_message
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `, [
        notificationId,
        user.id,
        notification.type,
        notification.triggerReason,
        notification.title,
        notification.body,
        JSON.stringify(notification.data || {}),
        deliveryStatus,
        errorMessage,
    ]);
    console.log(`[Notifications] ${deliveryStatus}: ${notification.type} to ${user.id}`);
};
/**
 * Calculate how many workouts a user has completed this week
 */
const getWorkoutsThisWeek = async (userId) => {
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay()); // Sunday
    weekStart.setHours(0, 0, 0, 0);
    const result = await (0, db_1.query)(`
    SELECT COUNT(*) as count
    FROM workout_sessions
    WHERE user_id = $1
      AND completed_at >= $2
      AND completed_at IS NOT NULL
    `, [userId, weekStart.toISOString()]);
    return parseInt(result.rows[0]?.count || "0", 10);
};
/**
 * Get the last workout date for a user
 */
const getLastWorkoutDate = async (userId) => {
    const result = await (0, db_1.query)(`
    SELECT completed_at
    FROM workout_sessions
    WHERE user_id = $1
      AND completed_at IS NOT NULL
    ORDER BY completed_at DESC
    LIMIT 1
    `, [userId]);
    if (!result.rows.length)
        return null;
    return new Date(result.rows[0].completed_at);
};
/**
 * Check if user is approaching weekly goal miss (24-48 hours left)
 */
const checkGoalRisk = async (user) => {
    if (!user.notificationPreferences.goalReminders)
        return;
    const workoutsThisWeek = await getWorkoutsThisWeek(user.id);
    const remaining = user.weeklyGoal - workoutsThisWeek;
    if (remaining <= 0)
        return; // Already met goal
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0 = Sunday, 6 = Saturday
    const daysLeftInWeek = 6 - dayOfWeek; // Days until Saturday
    // Only send if 1-2 days left and still need 1+ workouts
    if (daysLeftInWeek >= 1 && daysLeftInWeek <= 2 && remaining >= 1) {
        const sessionWord = remaining === 1 ? "session" : "sessions";
        const dayWord = daysLeftInWeek === 1 ? "day" : "days";
        await sendNotification(user, {
            type: "goal_risk",
            triggerReason: `${remaining} sessions remaining, ${daysLeftInWeek} days left`,
            title: `${remaining} ${sessionWord} to hit your goal! 🎯`,
            body: `You have ${daysLeftInWeek} ${dayWord} left to complete your weekly goal. Keep going!`,
            data: { remaining, daysLeft: daysLeftInWeek },
        });
    }
};
/**
 * Check if user has been inactive for 5-7 days
 */
const checkInactivity = async (user) => {
    if (!user.notificationPreferences.inactivityNudges)
        return;
    const lastWorkout = await getLastWorkoutDate(user.id);
    if (!lastWorkout)
        return;
    const daysSinceLastWorkout = Math.floor((Date.now() - lastWorkout.getTime()) / (1000 * 60 * 60 * 24));
    // Send nudge if 5-7 days inactive (only once in this range)
    if (daysSinceLastWorkout >= 5 && daysSinceLastWorkout <= 7) {
        // Check if we already sent an inactivity nudge in the last 7 days
        const recentNudge = await (0, db_1.query)(`
      SELECT COUNT(*) as count
      FROM notification_events
      WHERE user_id = $1
        AND notification_type = 'inactivity'
        AND sent_at >= NOW() - INTERVAL '7 days'
      `, [user.id]);
        const alreadySent = parseInt(recentNudge.rows[0]?.count || "0", 10) > 0;
        if (alreadySent)
            return;
        await sendNotification(user, {
            type: "inactivity",
            triggerReason: `${daysSinceLastWorkout} days since last workout`,
            title: "We miss you! 💪",
            body: `It's been ${daysSinceLastWorkout} days since your last workout. Ready to get back to it?`,
            data: { daysSinceLastWorkout },
        });
    }
};
/**
 * Check if user just met their weekly goal and send celebration
 */
const checkWeeklyGoalMet = async (user) => {
    if (!user.notificationPreferences.weeklyGoalMet)
        return;
    const workoutsThisWeek = await getWorkoutsThisWeek(user.id);
    // Only send if they just hit the goal (exactly equal)
    if (workoutsThisWeek !== user.weeklyGoal)
        return;
    // Check if we already sent this notification this week
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    weekStart.setHours(0, 0, 0, 0);
    const alreadySent = await (0, db_1.query)(`
    SELECT COUNT(*) as count
    FROM notification_events
    WHERE user_id = $1
      AND notification_type = 'goal_met'
      AND sent_at >= $2
    `, [user.id, weekStart.toISOString()]);
    if (parseInt(alreadySent.rows[0]?.count || "0", 10) > 0)
        return;
    await sendNotification(user, {
        type: "goal_met",
        triggerReason: `Completed ${workoutsThisWeek}/${user.weeklyGoal} sessions`,
        title: "Weekly goal complete! 🎉",
        body: `Amazing work! You hit your goal of ${user.weeklyGoal} workouts this week.`,
        data: { weeklyGoal: user.weeklyGoal, completed: workoutsThisWeek },
    });
};
/**
 * Check for recent squad activity (teammate hitting goal or reacting to workout)
 * This runs less frequently to avoid spam
 */
const checkSquadActivity = async (user) => {
    if (!user.notificationPreferences.squadActivity)
        return;
    // Get user's squads
    const squadsResult = await (0, db_1.query)(`
    SELECT s.id as squad_id, s.name as squad_name
    FROM squad_members sm
    JOIN squads s ON s.id = sm.squad_id
    WHERE sm.user_id = $1
    `, [user.id]);
    if (!squadsResult.rows.length)
        return;
    // Check for recent reactions to user's workouts (last 24 hours)
    const recentReactions = await (0, db_1.query)(`
    SELECT u.name as reactor_name, COUNT(*) as count
    FROM workout_reactions wr
    JOIN workout_shares ws ON (wr.target_type = 'share' AND wr.target_id = ws.id)
    JOIN users u ON u.id = wr.user_id
    WHERE ws.user_id = $1
      AND wr.user_id != $1
      AND wr.created_at >= NOW() - INTERVAL '24 hours'
      AND NOT EXISTS (
        SELECT 1 FROM notification_events ne
        WHERE ne.user_id = $1
          AND ne.notification_type = 'squad_reaction'
          AND ne.sent_at >= NOW() - INTERVAL '24 hours'
      )
    GROUP BY u.name
    ORDER BY count DESC
    LIMIT 1
    `, [user.id]);
    if (recentReactions.rows.length > 0) {
        const { reactor_name, count } = recentReactions.rows[0];
        const reactionCount = parseInt(count, 10);
        await sendNotification(user, {
            type: "squad_reaction",
            triggerReason: `${reactionCount} reactions from ${reactor_name}`,
            title: "Your squad cheered you on! 🙌",
            body: `${reactor_name} and others reacted to your workout`,
            data: { reactorName: reactor_name, reactionCount },
        });
    }
};
/**
 * Main job: Process all users and send appropriate notifications
 * Should be run once daily (recommended: 9am local time)
 */
const processNotifications = async () => {
    console.log("[Notifications] Starting daily notification job...");
    try {
        // Fetch all users with notification preferences enabled
        const usersResult = await (0, db_1.query)(`
      SELECT
        id,
        name,
        email,
        weekly_goal as "weeklyGoal",
        push_token as "pushToken",
        notification_preferences as "notificationPreferences"
      FROM users
      WHERE push_token IS NOT NULL
      `);
        console.log(`[Notifications] Processing ${usersResult.rows.length} users...`);
        for (const user of usersResult.rows) {
            try {
                // Run all notification checks
                await checkGoalRisk(user);
                await checkInactivity(user);
                await checkWeeklyGoalMet(user);
                await checkSquadActivity(user);
            }
            catch (error) {
                console.error(`[Notifications] Error processing user ${user.id}:`, error);
            }
        }
        console.log("[Notifications] Daily notification job complete!");
    }
    catch (error) {
        console.error("[Notifications] Job failed:", error);
        throw error;
    }
};
exports.processNotifications = processNotifications;
/**
 * Immediate notification for squad activity (called when event happens)
 */
const sendSquadActivityNotification = async (userId, activityType, data) => {
    const userResult = await (0, db_1.query)(`
    SELECT
      id,
      name,
      email,
      weekly_goal as "weeklyGoal",
      push_token as "pushToken",
      notification_preferences as "notificationPreferences"
    FROM users
    WHERE id = $1
    `, [userId]);
    if (!userResult.rows.length)
        return;
    const user = userResult.rows[0];
    if (!user.notificationPreferences.squadActivity)
        return;
    if (activityType === "reaction") {
        await sendNotification(user, {
            type: "squad_reaction",
            triggerReason: "immediate_reaction",
            title: `${data.actorName} reacted to your workout! 🔥`,
            body: data.workoutName
                ? `${data.actorName} cheered on your ${data.workoutName}`
                : `${data.actorName} reacted to your workout`,
            data,
        });
    }
    else if (activityType === "goal_met" && data.squadName) {
        await sendNotification(user, {
            type: "squad_goal_met",
            triggerReason: "teammate_goal_completion",
            title: `${data.actorName} crushed their weekly goal! 💪`,
            body: `Your squad mate in ${data.squadName} just completed their weekly goal`,
            data,
        });
    }
};
exports.sendSquadActivityNotification = sendSquadActivityNotification;
/**
 * Send notification when someone sends a friend request
 */
const sendFriendRequestNotification = async (targetUserId, requesterUserId, requesterName, requesterHandle) => {
    const userResult = await (0, db_1.query)(`
    SELECT
      id,
      name,
      email,
      weekly_goal as "weeklyGoal",
      push_token as "pushToken",
      notification_preferences as "notificationPreferences"
    FROM users
    WHERE id = $1
    `, [targetUserId]);
    if (!userResult.rows.length)
        return;
    const user = userResult.rows[0];
    // Always send social notifications (not governed by squad activity preference)
    await sendNotification(user, {
        type: "friend_request",
        triggerReason: "new_follower",
        title: "New friend request 👋",
        body: requesterHandle
            ? `${requesterName} (${requesterHandle}) wants to connect`
            : `${requesterName} wants to connect`,
        data: {
            requesterId: requesterUserId,
            requesterName,
            requesterHandle,
        },
    });
};
exports.sendFriendRequestNotification = sendFriendRequestNotification;
/**
 * Send notification when someone accepts your friend request
 */
const sendFriendAcceptanceNotification = async (originalRequesterId, acceptorUserId, acceptorName, acceptorHandle) => {
    const userResult = await (0, db_1.query)(`
    SELECT
      id,
      name,
      email,
      weekly_goal as "weeklyGoal",
      push_token as "pushToken",
      notification_preferences as "notificationPreferences"
    FROM users
    WHERE id = $1
    `, [originalRequesterId]);
    if (!userResult.rows.length)
        return;
    const user = userResult.rows[0];
    // Always send social notifications
    await sendNotification(user, {
        type: "friend_acceptance",
        triggerReason: "request_accepted",
        title: "Friend request accepted! 🎉",
        body: acceptorHandle
            ? `${acceptorName} (${acceptorHandle}) accepted your friend request`
            : `${acceptorName} accepted your friend request`,
        data: {
            acceptorId: acceptorUserId,
            acceptorName,
            acceptorHandle,
        },
    });
};
exports.sendFriendAcceptanceNotification = sendFriendAcceptanceNotification;
