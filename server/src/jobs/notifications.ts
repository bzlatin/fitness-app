import { Expo, ExpoPushMessage, ExpoPushTicket } from "expo-server-sdk";
import { query } from "../db";
import { createIdGenerator } from "../utils/id";
import {
  clampTzOffsetMinutes,
  computeNextNotificationAt,
} from "../utils/notificationSchedule";

const nanoid = createIdGenerator("0123456789abcdefghijklmnopqrstuvwxyz", 12);

const expo = new Expo();

interface NotificationPreferences {
  goalReminders: boolean;
  inactivityNudges: boolean;
  squadActivity: boolean;
  weeklyGoalMet: boolean;
  quietHoursStart: number; // 0-23
  quietHoursEnd: number; // 0-23
  maxNotificationsPerWeek: number;
}

interface User {
  id: string;
  name: string;
  email: string;
  weeklyGoal: number;
  pushToken: string | null;
  timezoneOffsetMinutes: number | null;
  nextNotificationAt: string | null;
  notificationPreferences: NotificationPreferences;
}

/**
 * Local-time helpers (timezone offset is minutes behind UTC, like JS getTimezoneOffset).
 */
const getUserTzOffsetMinutes = (user: User): number =>
  clampTzOffsetMinutes(user.timezoneOffsetMinutes);

const getUserLocalDate = (date: Date, tzOffsetMinutes: number): Date =>
  new Date(date.getTime() - tzOffsetMinutes * 60 * 1000);

const getUtcDateFromUserLocal = (
  localDate: Date,
  tzOffsetMinutes: number
): Date => new Date(localDate.getTime() + tzOffsetMinutes * 60 * 1000);

const formatLocalDateKey = (date: Date): string => {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const getUserLocalWeekRange = (user: User) => {
  const tzOffsetMinutes = getUserTzOffsetMinutes(user);
  const localNow = getUserLocalDate(new Date(), tzOffsetMinutes);
  const localWeekStart = new Date(localNow.getTime());
  localWeekStart.setUTCHours(0, 0, 0, 0);
  localWeekStart.setUTCDate(
    localWeekStart.getUTCDate() - localWeekStart.getUTCDay()
  );
  const localWeekEnd = new Date(localWeekStart.getTime());
  localWeekEnd.setUTCDate(localWeekEnd.getUTCDate() + 7);
  const weekStartUtc = getUtcDateFromUserLocal(
    localWeekStart,
    tzOffsetMinutes
  );
  const weekEndUtc = getUtcDateFromUserLocal(localWeekEnd, tzOffsetMinutes);

  return {
    tzOffsetMinutes,
    localNow,
    localWeekStart,
    weekStartUtc,
    weekEndUtc,
  };
};

/**
 * Check if current time is within quiet hours (user local time)
 */
const isQuietHours = (user: User): boolean => {
  const localNow = getUserLocalDate(
    new Date(),
    getUserTzOffsetMinutes(user)
  );
  const currentHour = localNow.getUTCHours();
  const { quietHoursStart, quietHoursEnd } = user.notificationPreferences;

  // Handle overnight quiet hours (e.g., 22:00 to 8:00)
  if (quietHoursStart > quietHoursEnd) {
    return currentHour >= quietHoursStart || currentHour < quietHoursEnd;
  }

  return currentHour >= quietHoursStart && currentHour < quietHoursEnd;
};

/**
 * Check if user has hit their weekly notification cap
 */
const hasReachedWeeklyCap = async (
  userId: string,
  maxNotifications: number
): Promise<boolean> => {
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

  const result = await query<{ count: string }>(
    `
    SELECT COUNT(*) as count
    FROM notification_events
    WHERE user_id = $1
      AND sent_at >= $2
      AND delivery_status = 'sent'
    `,
    [userId, oneWeekAgo.toISOString()]
  );

  const count = parseInt(result.rows[0]?.count || "0", 10);
  return count >= maxNotifications;
};

const hasSentNotificationSince = async (
  userId: string,
  notificationType: string,
  since: Date
): Promise<boolean> => {
  const result = await query<{ count: string }>(
    `
    SELECT COUNT(*) as count
    FROM notification_events
    WHERE user_id = $1
      AND notification_type = $2
      AND sent_at >= $3
    `,
    [userId, notificationType, since.toISOString()]
  );

  return parseInt(result.rows[0]?.count || "0", 10) > 0;
};

const formatCommentPreview = (comment: string, maxLength = 90): string => {
  const normalized = comment.replace(/\s+/g, " ").trim();
  if (!normalized) return "Tap to view the comment.";
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 3)}...`;
};

const scheduleNextNotification = async (user: User): Promise<void> => {
  const tzOffsetMinutes = getUserTzOffsetMinutes(user);
  const nextAt = computeNextNotificationAt({
    userId: user.id,
    tzOffsetMinutes,
  });

  await query(
    `
    UPDATE users
    SET next_notification_at = $1, updated_at = NOW()
    WHERE id = $2
    `,
    [nextAt.toISOString(), user.id]
  );
};

/**
 * Send a push notification to a user and log to database
 */
type NotificationSendOptions = {
  bypassQuietHours?: boolean;
  bypassWeeklyCap?: boolean;
  deliverSilentlyInQuietHours?: boolean;
};

const sendNotification = async (
  user: User,
  notification: {
    type: string;
    triggerReason: string;
    title: string;
    body: string;
    data?: Record<string, unknown>;
  },
  options: NotificationSendOptions = {}
): Promise<void> => {
  const notificationId = nanoid();
  const isQuietTime = isQuietHours(user);
  const shouldSendDuringQuiet =
    options.bypassQuietHours || options.deliverSilentlyInQuietHours;

  // Check quiet hours
  if (isQuietTime && !shouldSendDuringQuiet) {
    console.log(
      `[Notifications] Skipped ${notification.type} for ${user.id} - quiet hours`
    );
    return;
  }

  // Check weekly cap
  if (!options.bypassWeeklyCap) {
    const reachedCap = await hasReachedWeeklyCap(
      user.id,
      user.notificationPreferences.maxNotificationsPerWeek
    );
    if (reachedCap) {
      console.log(
        `[Notifications] Skipped ${notification.type} for ${user.id} - weekly cap reached`
      );
      return;
    }
  }

  const isSilent = isQuietTime && options.deliverSilentlyInQuietHours;
  let deliveryStatus = isSilent ? "silent" : "sent";
  let errorMessage: string | null = null;

  // Send push notification if user has a valid push token
  if (user.pushToken && Expo.isExpoPushToken(user.pushToken)) {
    try {
      const message: ExpoPushMessage = {
        to: user.pushToken,
        title: notification.title,
        body: notification.body,
        data: notification.data || {},
        ...(isSilent
          ? { priority: "normal", channelId: "silent" }
          : { sound: "default" }),
      };

      const ticketChunk = await expo.sendPushNotificationsAsync([message]);
      const ticket: ExpoPushTicket = ticketChunk[0];

      if (ticket.status === "error") {
        deliveryStatus = "failed";
        errorMessage =
          "message" in ticket ? ticket.message : "Unknown error";
        console.error(`[Notifications] Error sending to ${user.id}:`, ticket);
      }
    } catch (error) {
      deliveryStatus = "failed";
      errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      console.error(
        `[Notifications] Exception sending to ${user.id}:`,
        error
      );
    }
  } else {
    deliveryStatus = "no_token";
  }

  // Log notification event to database
  await query(
    `
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
    `,
    [
      notificationId,
      user.id,
      notification.type,
      notification.triggerReason,
      notification.title,
      notification.body,
      JSON.stringify(notification.data || {}),
      deliveryStatus,
      errorMessage,
    ]
  );

  console.log(
    `[Notifications] ${deliveryStatus}: ${notification.type} to ${user.id}`
  );
};

const getWorkoutsInRange = async (
  userId: string,
  startUtc: Date,
  endUtc: Date
): Promise<number> => {
  const result = await query<{ count: string }>(
    `
    SELECT COUNT(*) as count
    FROM workout_sessions
    WHERE user_id = $1
      AND finished_at >= $2
      AND finished_at < $3
      AND finished_at IS NOT NULL
      AND ended_reason IS DISTINCT FROM 'auto_inactivity'
    `,
    [userId, startUtc.toISOString(), endUtc.toISOString()]
  );

  return parseInt(result.rows[0]?.count || "0", 10);
};

/**
 * Calculate how many workouts a user has completed this week (user local week)
 */
const getWorkoutsThisWeek = async (user: User): Promise<number> => {
  const { weekStartUtc, weekEndUtc } = getUserLocalWeekRange(user);
  return getWorkoutsInRange(user.id, weekStartUtc, weekEndUtc);
};

/**
 * Get the last workout date for a user
 */
const getLastWorkoutDate = async (
  userId: string
): Promise<Date | null> => {
  const result = await query<{ finished_at: string }>(
    `
    SELECT finished_at
    FROM workout_sessions
    WHERE user_id = $1
      AND finished_at IS NOT NULL
      AND ended_reason IS DISTINCT FROM 'auto_inactivity'
    ORDER BY finished_at DESC
    LIMIT 1
    `,
    [userId]
  );

  if (!result.rows.length) return null;
  return new Date(result.rows[0].finished_at);
};

const getCurrentStreakInfo = async (
  user: User
): Promise<{ currentStreak: number; lastWorkoutDate: string | null }> => {
  const tzOffsetMinutes = getUserTzOffsetMinutes(user);
  const result = await query<{
    streak_days: string;
    last_workout_date: string | null;
  }>(
    `
    WITH daily_workouts AS (
      SELECT DISTINCT DATE(finished_at - make_interval(mins => $2)) as workout_date
      FROM workout_sessions
      WHERE user_id = $1
        AND finished_at IS NOT NULL
        AND ended_reason IS DISTINCT FROM 'auto_inactivity'
      ORDER BY workout_date DESC
    ),
    streaks AS (
      SELECT
        workout_date,
        workout_date - ROW_NUMBER() OVER (ORDER BY workout_date DESC)::int as streak_group
      FROM daily_workouts
    )
    SELECT COUNT(*) as streak_days, MAX(workout_date) as last_workout_date
    FROM streaks
    WHERE streak_group = (SELECT streak_group FROM streaks LIMIT 1)
    `,
    [user.id, tzOffsetMinutes]
  );

  if (!result.rows.length) {
    return { currentStreak: 0, lastWorkoutDate: null };
  }

  const row = result.rows[0];
  return {
    currentStreak: parseInt(row.streak_days || "0", 10),
    lastWorkoutDate: row.last_workout_date ?? null,
  };
};

/**
 * Check if user is about to lose their streak (yesterday was last workout)
 */
const checkStreakRisk = async (user: User): Promise<void> => {
  if (!user.notificationPreferences.goalReminders) return;

  const { tzOffsetMinutes } = getUserLocalWeekRange(user);
  const { currentStreak, lastWorkoutDate } = await getCurrentStreakInfo(user);
  if (!lastWorkoutDate || currentStreak < 3) return;

  const localNow = getUserLocalDate(new Date(), tzOffsetMinutes);
  const localToday = new Date(localNow.getTime());
  localToday.setUTCHours(0, 0, 0, 0);
  const localYesterday = new Date(localToday.getTime());
  localYesterday.setUTCDate(localYesterday.getUTCDate() - 1);

  if (lastWorkoutDate !== formatLocalDateKey(localYesterday)) return;

  const alreadySent = await hasSentNotificationSince(
    user.id,
    "streak_risk",
    getUtcDateFromUserLocal(localToday, tzOffsetMinutes)
  );
  if (alreadySent) return;

  await sendNotification(user, {
    type: "streak_risk",
    triggerReason: `streak ${currentStreak} days, last workout yesterday`,
    title: "Keep your streak alive 🔥",
    body: `You're on a ${currentStreak}-day streak. Log a session today to keep it going.`,
    data: { currentStreak },
  });
};

/**
 * Check if user missed their weekly goal (previous week summary)
 */
const checkWeeklyGoalMissed = async (user: User): Promise<void> => {
  if (!user.notificationPreferences.goalReminders) return;

  const { localNow, localWeekStart, weekStartUtc, tzOffsetMinutes } =
    getUserLocalWeekRange(user);

  // Only send on the first day of the week (Sunday) at the daily window
  if (localNow.getUTCDay() !== 0) return;

  const previousWeekStartLocal = new Date(localWeekStart.getTime());
  previousWeekStartLocal.setUTCDate(previousWeekStartLocal.getUTCDate() - 7);

  const previousWeekStartUtc = getUtcDateFromUserLocal(
    previousWeekStartLocal,
    tzOffsetMinutes
  );

  const workoutsLastWeek = await getWorkoutsInRange(
    user.id,
    previousWeekStartUtc,
    weekStartUtc
  );

  if (workoutsLastWeek >= user.weeklyGoal) return;
  if (workoutsLastWeek === 0) return;

  const alreadySent = await hasSentNotificationSince(
    user.id,
    "goal_missed",
    weekStartUtc
  );
  if (alreadySent) return;

  await sendNotification(user, {
    type: "goal_missed",
    triggerReason: `completed ${workoutsLastWeek}/${user.weeklyGoal} last week`,
    title: "Fresh week, fresh start 💫",
    body: `Last week you logged ${workoutsLastWeek}/${user.weeklyGoal} sessions. Want to plan one for today?`,
    data: { weeklyGoal: user.weeklyGoal, completed: workoutsLastWeek },
  });
};

/**
 * Check if user is approaching weekly goal miss (24-48 hours left)
 */
const checkGoalRisk = async (user: User): Promise<void> => {
  if (!user.notificationPreferences.goalReminders) return;

  const { localNow, weekStartUtc } = getUserLocalWeekRange(user);
  const workoutsThisWeek = await getWorkoutsThisWeek(user);
  const remaining = user.weeklyGoal - workoutsThisWeek;

  if (remaining <= 0) return; // Already met goal

  const dayOfWeek = localNow.getUTCDay(); // 0 = Sunday, 6 = Saturday
  const daysLeftInWeek = 6 - dayOfWeek; // Days until Saturday

  // Only send if 1-2 days left and still need 1+ workouts
  if (daysLeftInWeek >= 1 && daysLeftInWeek <= 2 && remaining >= 1) {
    const alreadySent = await hasSentNotificationSince(
      user.id,
      "goal_risk",
      weekStartUtc
    );
    if (alreadySent) return;

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
const checkInactivity = async (user: User): Promise<void> => {
  if (!user.notificationPreferences.inactivityNudges) return;

  const lastWorkout = await getLastWorkoutDate(user.id);
  if (!lastWorkout) return;

  const daysSinceLastWorkout = Math.floor(
    (Date.now() - lastWorkout.getTime()) / (1000 * 60 * 60 * 24)
  );

  // Send nudge if 5-7 days inactive (only once in this range)
  if (daysSinceLastWorkout >= 5 && daysSinceLastWorkout <= 7) {
    // Check if we already sent an inactivity nudge in the last 7 days
    const recentNudge = await query<{ count: string }>(
      `
      SELECT COUNT(*) as count
      FROM notification_events
      WHERE user_id = $1
        AND notification_type = 'inactivity'
        AND sent_at >= NOW() - INTERVAL '7 days'
      `,
      [user.id]
    );

    const alreadySent = parseInt(recentNudge.rows[0]?.count || "0", 10) > 0;
    if (alreadySent) return;

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
const checkWeeklyGoalMet = async (user: User): Promise<void> => {
  if (!user.notificationPreferences.weeklyGoalMet) return;

  const { weekStartUtc } = getUserLocalWeekRange(user);
  const workoutsThisWeek = await getWorkoutsThisWeek(user);

  // Only send if they just hit the goal (exactly equal)
  if (workoutsThisWeek !== user.weeklyGoal) return;

  // Check if we already sent this notification this week
  const alreadySent = await query<{ count: string }>(
    `
    SELECT COUNT(*) as count
    FROM notification_events
    WHERE user_id = $1
      AND notification_type = 'goal_met'
      AND sent_at >= $2
    `,
    [user.id, weekStartUtc.toISOString()]
  );

  if (parseInt(alreadySent.rows[0]?.count || "0", 10) > 0) return;

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
const checkSquadActivity = async (user: User): Promise<void> => {
  if (!user.notificationPreferences.squadActivity) return;

  // Get user's squads
  const squadsResult = await query<{ squad_id: string; squad_name: string }>(
    `
    SELECT s.id as squad_id, s.name as squad_name
    FROM squad_members sm
    JOIN squads s ON s.id = sm.squad_id
    WHERE sm.user_id = $1
    `,
    [user.id]
  );

  if (!squadsResult.rows.length) return;

  // Check for recent reactions to user's workouts (last 24 hours)
  const recentReactions = await query<{ reactor_name: string; count: string }>(
    `
    SELECT u.name as reactor_name, COUNT(*) as count
    FROM workout_reactions wr
    JOIN workout_shares ws ON (wr.target_type = 'share' AND wr.target_id = ws.id)
    JOIN users u ON u.id = wr.user_id
    WHERE ws.user_id = $1
      AND wr.user_id != $1
      AND wr.reaction_type = 'emoji'
      AND wr.created_at >= NOW() - INTERVAL '24 hours'
      AND wr.deleted_at IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM notification_events ne
        WHERE ne.user_id = $1
          AND ne.notification_type = 'squad_reaction'
          AND ne.sent_at >= NOW() - INTERVAL '24 hours'
      )
    GROUP BY u.name
    ORDER BY count DESC
    LIMIT 1
    `,
    [user.id]
  );

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
 * Run every 15 minutes; delivers near 3pm user-local based on next_notification_at.
 */
export const processNotifications = async (
  options: { force?: boolean } = {}
): Promise<void> => {
  const { force = false } = options;
  console.log("[Notifications] Starting notification job...");

  try {
    // Fetch all users with notification preferences enabled
    const usersResult = await query<User>(
      `
      SELECT
        id,
        name,
        email,
        weekly_goal as "weeklyGoal",
        push_token as "pushToken",
        timezone_offset_minutes as "timezoneOffsetMinutes",
        next_notification_at as "nextNotificationAt",
        notification_preferences as "notificationPreferences"
      FROM users
      WHERE push_token IS NOT NULL
        AND ($1::boolean OR next_notification_at IS NULL OR next_notification_at <= NOW())
      `,
      [force]
    );

    console.log(
      `[Notifications] Processing ${usersResult.rows.length} users...`
    );

    for (const user of usersResult.rows) {
      try {
        if (!force && !user.nextNotificationAt) {
          await scheduleNextNotification(user);
          continue;
        }

        // Run all notification checks
        await checkWeeklyGoalMet(user);
        await checkStreakRisk(user);
        await checkGoalRisk(user);
        await checkWeeklyGoalMissed(user);
        await checkInactivity(user);
        await checkSquadActivity(user);

        await scheduleNextNotification(user);
      } catch (error) {
        console.error(
          `[Notifications] Error processing user ${user.id}:`,
          error
        );
      }
    }

    console.log("[Notifications] Notification job complete!");
  } catch (error) {
    console.error("[Notifications] Job failed:", error);
    throw error;
  }
};

/**
 * Immediate notification for squad activity (called when event happens)
 */
export const sendSquadActivityNotification = async (
  userId: string,
  activityType: "reaction" | "goal_met",
  data: {
    actorName: string;
    squadName?: string;
    workoutName?: string;
  }
): Promise<void> => {
  const userResult = await query<User>(
    `
    SELECT
      id,
      name,
      email,
      weekly_goal as "weeklyGoal",
      push_token as "pushToken",
      timezone_offset_minutes as "timezoneOffsetMinutes",
      notification_preferences as "notificationPreferences"
    FROM users
    WHERE id = $1
    `,
    [userId]
  );

  if (!userResult.rows.length) return;
  const user = userResult.rows[0];

  if (!user.notificationPreferences.squadActivity) return;

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
  } else if (activityType === "goal_met" && data.squadName) {
    await sendNotification(user, {
      type: "squad_goal_met",
      triggerReason: "teammate_goal_completion",
      title: `${data.actorName} crushed their weekly goal! 💪`,
      body: `Your squad mate in ${data.squadName} just completed their weekly goal`,
      data,
    });
  }
};

/**
 * Send notification when someone sends a friend request
 */
export const sendFriendRequestNotification = async (
  targetUserId: string,
  requesterUserId: string,
  requesterName: string,
  requesterHandle?: string
): Promise<void> => {
  const userResult = await query<User>(
    `
    SELECT
      id,
      name,
      email,
      weekly_goal as "weeklyGoal",
      push_token as "pushToken",
      timezone_offset_minutes as "timezoneOffsetMinutes",
      notification_preferences as "notificationPreferences"
    FROM users
    WHERE id = $1
    `,
    [targetUserId]
  );

  if (!userResult.rows.length) return;
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

/**
 * Send notification when someone accepts your friend request
 */
export const sendFriendAcceptanceNotification = async (
  originalRequesterId: string,
  acceptorUserId: string,
  acceptorName: string,
  acceptorHandle?: string
): Promise<void> => {
  const userResult = await query<User>(
    `
    SELECT
      id,
      name,
      email,
      weekly_goal as "weeklyGoal",
      push_token as "pushToken",
      timezone_offset_minutes as "timezoneOffsetMinutes",
      notification_preferences as "notificationPreferences"
    FROM users
    WHERE id = $1
    `,
    [originalRequesterId]
  );

  if (!userResult.rows.length) return;
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

/**
 * Send notification when someone comments on your workout
 */
export const sendWorkoutCommentNotification = async (
  targetUserId: string,
  commenterUserId: string,
  commenterName: string,
  comment: string,
  target: {
    targetType: "share" | "status";
    targetId: string;
  }
): Promise<void> => {
  if (targetUserId === commenterUserId) return;

  const userResult = await query<User>(
    `
    SELECT
      id,
      name,
      email,
      weekly_goal as "weeklyGoal",
      push_token as "pushToken",
      timezone_offset_minutes as "timezoneOffsetMinutes",
      notification_preferences as "notificationPreferences"
    FROM users
    WHERE id = $1
    `,
    [targetUserId]
  );

  if (!userResult.rows.length) return;
  const user = userResult.rows[0];

  if (!user.notificationPreferences.squadActivity) return;

  await sendNotification(user, {
    type: "workout_comment",
    triggerReason: `comment_${target.targetType}`,
    title: `${commenterName} commented on your workout 💬`,
    body: formatCommentPreview(comment),
    data: {
      commenterId: commenterUserId,
      commenterName,
      targetType: target.targetType,
      targetId: target.targetId,
    },
  },
  {
    bypassWeeklyCap: true,
    deliverSilentlyInQuietHours: true,
  });
};
