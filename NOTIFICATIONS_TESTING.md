# Smart Goal-Based Notifications - Testing Guide

## Overview

This guide covers testing the smart notification system implemented in Phase 4.4.1. The system sends intelligent push notifications based on user goals, activity patterns, and squad interactions.

## Prerequisites

### 1. Server Setup

First, restart the server to apply database migrations:

```bash
cd server
npm run dev
```

The server will automatically create:
- `push_token` column in users table
- `notification_preferences` JSONB column with defaults
- `notification_events` table with indexes

### 2. Mobile App Setup

The app already has the necessary dependencies installed:
- `expo-notifications`
- `expo-device`

### 3. EAS Project ID

Ensure your `mobile/app.config.ts` has a valid EAS project ID in the `extra.eas.projectId` field. This is required for Expo push notifications.

## Testing Workflow

### Step 1: Enable Notifications

1. Open the app and navigate to **Profile → Settings**
2. Scroll down to the **🔔 Notifications** section
3. Tap **Enable Push Notifications**
4. Grant notification permissions when prompted
5. You should see a success alert: "Notifications Enabled"

**What happens:**
- App requests notification permissions from OS
- Gets Expo push token from Expo servers
- Registers token with backend via `POST /api/notifications/register-token`
- Backend stores token in `users.push_token`

### Step 2: Configure Notification Preferences

After enabling, you'll see toggle switches for each notification type:

- **Goal Reminders**: Alerts when at risk of missing weekly goal (1-2 days before week ends)
- **Inactivity Nudges**: Reminder after 5-7 days without a workout
- **Squad Activity**: Reactions from squad members or teammates hitting goals
- **Weekly Goal Met**: Celebration when you complete your weekly goal

Default preferences:
- All notification types: **Enabled**
- Quiet hours: **22:00 - 08:00** (no notifications during sleep)
- Max notifications per week: **3** (prevents fatigue)

**Toggle any preference** to update settings. Changes save immediately via `PUT /api/notifications/preferences`.

### Step 3: Testing Notification Triggers

#### A. Test Goal Risk Notification

**Scenario**: User hasn't hit weekly goal and time is running out

**Setup:**
1. Set your weekly goal to 4 workouts in Settings
2. Complete only 1-2 workouts this week
3. Wait until Thursday or Friday (1-2 days before week ends)
4. Run the notification scheduler manually:

```bash
# In server directory, create a test script
node -e "require('./dist/jobs/notifications').processNotifications()"
```

**Expected Result:**
- Notification sent: "X sessions to hit your goal! 🎯"
- Body: "You have Y days left to complete your weekly goal. Keep going!"
- Appears in notification inbox

#### B. Test Inactivity Nudge

**Scenario**: User hasn't worked out in 5-7 days

**Setup:**
1. Make sure your last completed workout was 5-7 days ago
   - You can backdate a workout by editing the database:
   ```sql
   UPDATE workout_sessions
   SET completed_at = NOW() - INTERVAL '6 days'
   WHERE user_id = 'your-user-id'
   ORDER BY completed_at DESC
   LIMIT 1;
   ```
2. Run the notification scheduler

**Expected Result:**
- Notification sent: "We miss you! 💪"
- Body: "It's been 6 days since your last workout. Ready to get back to it?"
- Only sent once per 7-day window (won't spam)

#### C. Test Weekly Goal Met

**Scenario**: User just completed their weekly goal

**Setup:**
1. Set weekly goal to 3 workouts
2. Complete exactly 3 workouts this week (Sunday-Saturday)
3. Run the scheduler after the 3rd workout

**Expected Result:**
- Notification sent: "Weekly goal complete! 🎉"
- Body: "Amazing work! You hit your goal of 3 workouts this week."
- Only sent once per week

#### D. Test Squad Activity

**Scenario**: Squad member reacts to your workout

**Setup:**
1. Share a completed workout to a squad
2. Have another user (or test account) add a reaction:
   ```bash
   POST /api/social/reactions
   {
     "targetType": "share",
     "targetId": "share-id",
     "reactionType": "emoji",
     "emoji": "🔥"
   }
   ```
3. Run the scheduler

**Expected Result:**
- Notification sent: "Your squad cheered you on! 🙌"
- Body: "Alex Strong and others reacted to your workout"

### Step 4: Test Notification Inbox

1. Navigate to **Settings → View Inbox** (top right of Notifications section)
2. You should see all received notifications in chronological order
3. **Unread notifications** show a green dot indicator
4. **Tap a notification** to mark it as read and clicked
5. **Swipe left or tap Delete** to remove a notification
6. **Tap "Mark all read"** to mark all as read at once
7. **Pull down** to refresh the inbox

**Expected Behavior:**
- Unread count badge updates in real-time
- Deleted notifications are removed immediately
- Last 30 days of notifications are shown
- Pagination loads more if you have 50+ notifications

### Step 5: Test Quiet Hours

**Setup:**
1. Update quiet hours via API (or add UI controls):
   ```bash
   PUT /api/notifications/preferences
   {
     "quietHoursStart": 20,
     "quietHoursEnd": 9
   }
   ```
2. Run the scheduler during quiet hours (8pm - 9am)

**Expected Result:**
- No push notifications sent
- Notifications still logged to `notification_events` table with `delivery_status: 'no_token'` or skipped
- Check server logs: "Skipped [type] for [user] - quiet hours"

### Step 6: Test Weekly Cap

**Setup:**
1. Set `maxNotificationsPerWeek` to 2:
   ```bash
   PUT /api/notifications/preferences
   {
     "maxNotificationsPerWeek": 2
   }
   ```
2. Trigger 3+ notifications within 7 days

**Expected Result:**
- First 2 notifications are sent
- 3rd+ notifications are skipped
- Server logs: "Skipped [type] for [user] - weekly cap reached"

## Manual Testing via API

### Send Test Notification (Development Only)

You can manually create a notification event for testing:

```bash
POST /api/notifications/inbox
# (Not implemented - use the scheduler or create directly in DB)

# OR insert directly into database:
INSERT INTO notification_events (
  id, user_id, notification_type, trigger_reason,
  title, body, data, delivery_status
) VALUES (
  'test123',
  'your-user-id',
  'goal_risk',
  'manual_test',
  'Test Notification',
  'This is a test notification',
  '{}',
  'sent'
);
```

### Check Notification Preferences

```bash
GET /api/notifications/preferences
Authorization: Bearer YOUR_JWT_TOKEN
```

**Response:**
```json
{
  "goalReminders": true,
  "inactivityNudges": true,
  "squadActivity": true,
  "weeklyGoalMet": true,
  "quietHoursStart": 22,
  "quietHoursEnd": 8,
  "maxNotificationsPerWeek": 3
}
```

### Query Notification Inbox

```bash
GET /api/notifications/inbox?limit=20&offset=0
Authorization: Bearer YOUR_JWT_TOKEN
```

**Response:**
```json
{
  "notifications": [
    {
      "id": "notif123",
      "notification_type": "goal_risk",
      "trigger_reason": "2 sessions remaining, 1 days left",
      "title": "2 sessions to hit your goal! 🎯",
      "body": "You have 1 day left to complete your weekly goal. Keep going!",
      "data": { "remaining": 2, "daysLeft": 1 },
      "sent_at": "2025-12-05T14:30:00Z",
      "read_at": null,
      "clicked_at": null,
      "delivery_status": "sent"
    }
  ],
  "unreadCount": 1,
  "hasMore": false
}
```

## Production Deployment

### Setting Up the Scheduler

In production, run the notification job daily at 9am local time using a cron job:

**Option 1: Node-cron (in-process)**

```typescript
// server/src/index.ts
import cron from "node-cron";
import { processNotifications } from "./jobs/notifications";

// Run daily at 9am
cron.schedule("0 9 * * *", async () => {
  console.log("[Cron] Running daily notification job...");
  await processNotifications();
});
```

Install node-cron:
```bash
npm install node-cron
npm install --save-dev @types/node-cron
```

**Option 2: External Cron (recommended for scale)**

Use a service like AWS EventBridge, Google Cloud Scheduler, or a Unix cron job:

```bash
# Create an endpoint to trigger the job
POST /api/admin/jobs/notifications/run
Authorization: Bearer ADMIN_API_KEY

# Then schedule with external cron
0 9 * * * curl -X POST https://your-api.com/api/admin/jobs/notifications/run \
  -H "Authorization: Bearer $ADMIN_API_KEY"
```

### Monitoring

**Check notification delivery:**
```sql
SELECT
  notification_type,
  delivery_status,
  COUNT(*) as count
FROM notification_events
WHERE sent_at >= NOW() - INTERVAL '7 days'
GROUP BY notification_type, delivery_status;
```

**Check user engagement:**
```sql
SELECT
  COUNT(*) FILTER (WHERE read_at IS NOT NULL) as read_count,
  COUNT(*) FILTER (WHERE clicked_at IS NOT NULL) as clicked_count,
  COUNT(*) as total_sent
FROM notification_events
WHERE sent_at >= NOW() - INTERVAL '30 days'
  AND delivery_status = 'sent';
```

## Troubleshooting

### Issue: "Push notifications only work on physical devices"

**Solution:** Notifications require a real iOS/Android device. Simulators/emulators won't work. Use Expo Go on a physical device or build a development client.

### Issue: "Missing EAS project ID"

**Solution:**
1. Run `eas init` in the mobile directory
2. Ensure `app.config.ts` has `extra.eas.projectId` set
3. Restart the dev server

### Issue: "Permission not granted for push notifications"

**Solution:**
1. Go to device Settings → [Your App] → Notifications
2. Enable "Allow Notifications"
3. Restart the app and try enabling again

### Issue: "Token not registering with backend"

**Solution:**
1. Check server logs for errors in `/api/notifications/register-token`
2. Verify JWT token is valid (check Authorization header)
3. Ensure database migration ran successfully (check `users.push_token` column exists)

### Issue: "Notifications not sending"

**Checklist:**
1. Is the user's `push_token` stored in the database?
2. Is the notification job running? (check server logs)
3. Are notification preferences enabled for that trigger type?
4. Is the user within quiet hours?
5. Has the user hit their weekly notification cap?
6. Check `notification_events` table for `delivery_status` and `error_message`

## Next Steps

After testing notifications:

1. **Add navigation from notifications:** Update `handleNotificationPress` in NotificationInbox to navigate to relevant screens based on notification type
2. **Add analytics:** Track notification open rates, click-through rates, and session starts after clicking
3. **Add badge count:** Update app icon badge when notifications arrive
4. **Add sound customization:** Allow users to choose notification sounds
5. **Add advanced quiet hours:** Let users set different quiet hours for different days
6. **Test on both iOS and Android:** Verify behavior on both platforms

## Success Criteria

✅ Users can enable/disable notifications
✅ Users can configure notification preferences
✅ Goal risk notifications send 1-2 days before week ends
✅ Inactivity nudges send after 5-7 days inactive
✅ Weekly goal met celebrations send when goal completed
✅ Squad activity notifications work for reactions
✅ Quiet hours are respected
✅ Weekly caps prevent notification fatigue
✅ In-app inbox shows all notifications
✅ Unread count badge displays correctly
✅ Notifications are marked as read/clicked

---

**Implementation Date:** December 5, 2025
**Phase:** 4.4.1 - Smart Goal-Based Notifications
**Status:** ✅ Production Ready
