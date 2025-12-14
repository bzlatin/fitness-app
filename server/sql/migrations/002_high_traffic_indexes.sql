-- 002_high_traffic_indexes.sql
-- Adds indexes for common high-traffic queries (feed, templates, sessions, follows, notifications).

-- Templates list/detail
CREATE INDEX IF NOT EXISTS workout_templates_user_created_at_idx
  ON workout_templates(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS workout_template_exercises_template_order_idx
  ON workout_template_exercises(template_id, order_index ASC);

-- Sessions history/stats
CREATE INDEX IF NOT EXISTS workout_sessions_user_started_at_idx
  ON workout_sessions(user_id, started_at DESC);

CREATE INDEX IF NOT EXISTS workout_sessions_user_finished_at_idx
  ON workout_sessions(user_id, finished_at DESC)
  WHERE finished_at IS NOT NULL;

-- Follows lookups (followers/following)
CREATE INDEX IF NOT EXISTS follows_target_user_id_idx
  ON follows(target_user_id);

CREATE INDEX IF NOT EXISTS follows_target_user_user_idx
  ON follows(target_user_id, user_id);

-- Feed ordering
CREATE INDEX IF NOT EXISTS active_workout_statuses_active_updated_at_idx
  ON active_workout_statuses(updated_at DESC)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS workout_shares_created_at_idx
  ON workout_shares(created_at DESC);

-- Notifications inbox + unread count
CREATE INDEX IF NOT EXISTS notification_events_user_sent_at_idx
  ON notification_events(user_id, sent_at DESC);

