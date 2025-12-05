# Notification Scheduler - Quick Reference

## ✅ What's Set Up

The notification system now has **automatic daily scheduling** at 9:00 AM!

### Cron Schedule
- **When**: Every day at 9:00 AM (server local time)
- **Pattern**: `"0 9 * * *"`
- **What it does**: Checks all users for notification triggers (goal risk, inactivity, weekly goal met, squad activity)

### Files Modified
- ✅ `server/src/index.ts` - Cron job initialized on server start
- ✅ `server/src/routes/notifications.ts` - Added manual trigger endpoint

---

## 🚀 How to Start

```bash
cd server
npm run dev
```

**You'll see:**
```
Push / Pull API running on http://localhost:4000
[Cron] Daily notification job scheduled for 9:00 AM
```

The job will automatically run every day at 9 AM. No further action needed!

---

## 🧪 Manual Testing

### Option 1: Trigger Via API

```bash
curl -X POST http://localhost:4000/api/notifications/admin/trigger-job \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Response:**
```json
{
  "success": true,
  "message": "Notification job completed successfully"
}
```

### Option 2: Trigger Via Code (in server console)

```javascript
// In your terminal where server is running, press Ctrl+C to stop
// Then run:
node -e "require('./dist/jobs/notifications').processNotifications()"
```

---

## 📊 What the Job Does

When it runs, the scheduler:

1. **Fetches all users** with registered push tokens
2. **For each user**, checks:
   - ✅ Goal Risk: Are they 1-2 days from week end and behind on weekly goal?
   - ✅ Inactivity: Haven't worked out in 5-7 days?
   - ✅ Weekly Goal Met: Just completed their weekly goal today?
   - ✅ Squad Activity: Squad members reacted to their workouts?

3. **Smart Filtering**:
   - ❌ Skip if in quiet hours (22:00 - 08:00 default)
   - ❌ Skip if hit weekly notification cap (3/week default)
   - ❌ Skip if notification already sent for this trigger

4. **Sends Push Notifications** via Expo Push Service
5. **Logs Everything** to `notification_events` table

---

## 📝 Server Logs

When the job runs, you'll see:

```
[Cron] Running daily notification job at 9am...
[Notifications] Starting daily notification job...
[Notifications] Processing 15 users...
[Notifications] sent: goal_risk to user123
[Notifications] Skipped inactivity for user456 - quiet hours
[Notifications] sent: weekly_goal_met to user789
[Notifications] Daily notification job complete!
[Cron] Daily notification job completed successfully
```

---

## 🔧 Configuration

### Change the Schedule Time

Edit `server/src/index.ts`:

```typescript
// Current: 9am daily
cron.schedule("0 9 * * *", async () => { ... });

// Examples:
cron.schedule("0 18 * * *", ...);    // 6pm daily
cron.schedule("0 9 * * 1-5", ...);   // 9am weekdays only
cron.schedule("0 */6 * * *", ...);   // Every 6 hours
cron.schedule("*/30 * * * *", ...);  // Every 30 minutes (testing)
```

**Cron pattern format:** `minute hour day-of-month month day-of-week`

### Disable Auto-Scheduling

Comment out the cron.schedule block in `server/src/index.ts`:

```typescript
// cron.schedule("0 9 * * *", async () => {
//   ...
// });
```

Then use manual trigger only.

---

## 🐛 Troubleshooting

### Issue: "Job not running at 9am"

**Check:**
1. Server is running continuously (not restarting)
2. Server timezone matches your expected time
3. Check logs for cron confirmation message

**Verify timezone:**
```bash
# In server directory
node -e "console.log(new Date().toString())"
```

### Issue: "No notifications being sent"

**Checklist:**
1. ✅ Users have registered push tokens? (Check `users.push_token`)
2. ✅ Users have notification preferences enabled?
3. ✅ Users meet trigger conditions? (e.g., actually behind on weekly goal)
4. ✅ Not in quiet hours? (22:00 - 08:00)
5. ✅ Haven't hit weekly cap? (3/week max)

**Check database:**
```sql
-- See who has push tokens
SELECT id, name, push_token FROM users WHERE push_token IS NOT NULL;

-- See recent notification events
SELECT * FROM notification_events
WHERE sent_at >= NOW() - INTERVAL '7 days'
ORDER BY sent_at DESC;

-- Check delivery status
SELECT delivery_status, COUNT(*)
FROM notification_events
GROUP BY delivery_status;
```

### Issue: "Job fails with error"

**Check server logs** for the error message. Common issues:
- Database connection lost
- Expo push service unreachable
- Invalid push tokens (users who uninstalled)

The job catches errors per user, so one failure won't stop others.

---

## 📈 Monitoring

### Check Notification Stats

```sql
-- Notifications sent in last 7 days by type
SELECT
  notification_type,
  COUNT(*) as sent,
  COUNT(*) FILTER (WHERE delivery_status = 'sent') as delivered,
  COUNT(*) FILTER (WHERE read_at IS NOT NULL) as read
FROM notification_events
WHERE sent_at >= NOW() - INTERVAL '7 days'
GROUP BY notification_type;

-- User engagement rates
SELECT
  ROUND(AVG(CASE WHEN read_at IS NOT NULL THEN 1 ELSE 0 END) * 100, 1) as read_rate,
  ROUND(AVG(CASE WHEN clicked_at IS NOT NULL THEN 1 ELSE 0 END) * 100, 1) as click_rate
FROM notification_events
WHERE sent_at >= NOW() - INTERVAL '30 days'
  AND delivery_status = 'sent';
```

---

## 🎯 Production Deployment

When deploying to production (Heroku, AWS, etc.):

1. **Set Server Timezone** (if needed):
   ```bash
   # Heroku example
   heroku config:set TZ=America/New_York
   ```

2. **Ensure Long-Running Process**:
   - Server must stay running (not serverless)
   - Use PM2 or similar for process management
   - Add health checks to ensure server stays up

3. **Monitor Logs**:
   - Set up log aggregation (Datadog, LogDNA, etc.)
   - Alert on job failures
   - Track notification delivery rates

4. **Scale Considerations**:
   - Current implementation handles ~1000 users fine
   - For 10k+ users, consider background job queue (Bull, BullMQ)
   - Batch Expo push notifications (max 100 per request)

---

## ✨ What's Next

Optional enhancements you can add:

1. **Admin Dashboard**: View notification stats in the app
2. **User-Specific Schedule**: Let users choose their notification time
3. **A/B Testing**: Test different notification copy
4. **Deep Links**: Navigate to specific screens when tapping notifications
5. **Rich Notifications**: Add images, action buttons
6. **Badge Count**: Update app icon badge with unread count

---

**Deployed**: December 5, 2025
**Phase**: 4.4.1 - Smart Goal-Based Notifications
**Status**: ✅ Production Ready
