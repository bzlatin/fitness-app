-- 001_initial_schema.sql
-- Captured from the historical server-side initDb() bootstrap.
-- Intentionally idempotent (IF NOT EXISTS / ADD COLUMN IF NOT EXISTS) so existing DBs can adopt migrations safely.

CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT,
      name TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

ALTER TABLE users
      ADD COLUMN IF NOT EXISTS handle TEXT UNIQUE,
      ADD COLUMN IF NOT EXISTS avatar_url TEXT,
      ADD COLUMN IF NOT EXISTS bio TEXT,
      ADD COLUMN IF NOT EXISTS plan TEXT NOT NULL DEFAULT 'free',
      ADD COLUMN IF NOT EXISTS plan_expires_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
      ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT,
      ADD COLUMN IF NOT EXISTS trial_started_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS apple_original_transaction_id TEXT,
      ADD COLUMN IF NOT EXISTS apple_subscription_id TEXT,
      ADD COLUMN IF NOT EXISTS subscription_platform TEXT,
      ADD COLUMN IF NOT EXISTS profile_completed_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS last_handle_change_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS training_style TEXT,
      ADD COLUMN IF NOT EXISTS gym_name TEXT,
      ADD COLUMN IF NOT EXISTS gym_visibility TEXT NOT NULL DEFAULT 'hidden',
      ADD COLUMN IF NOT EXISTS weekly_goal INTEGER NOT NULL DEFAULT 4,
      ADD COLUMN IF NOT EXISTS onboarding_data JSONB,
      ADD COLUMN IF NOT EXISTS progressive_overload_enabled BOOLEAN NOT NULL DEFAULT true,
      ADD COLUMN IF NOT EXISTS rest_timer_sound_enabled BOOLEAN NOT NULL DEFAULT true,
      ADD COLUMN IF NOT EXISTS push_token TEXT,
      ADD COLUMN IF NOT EXISTS notification_preferences JSONB NOT NULL DEFAULT '{"goalReminders": true, "inactivityNudges": true, "squadActivity": true, "weeklyGoalMet": true, "quietHoursStart": 22, "quietHoursEnd": 8, "maxNotificationsPerWeek": 3}'::jsonb,
      ADD COLUMN IF NOT EXISTS apple_health_enabled BOOLEAN NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS apple_health_permissions JSONB,
      ADD COLUMN IF NOT EXISTS apple_health_last_sync_at TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS users_handle_unique_idx
    ON users(handle)
    WHERE handle IS NOT NULL;

CREATE TABLE IF NOT EXISTS subscription_events (
      id TEXT PRIMARY KEY,
      user_id TEXT REFERENCES users(id),
      event_type TEXT NOT NULL,
      stripe_event_id TEXT UNIQUE,
      payload JSONB,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

CREATE TABLE IF NOT EXISTS appstore_notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT REFERENCES users(id),
      notification_type TEXT NOT NULL,
      transaction_id TEXT,
      original_transaction_id TEXT,
      payload JSONB,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

CREATE INDEX IF NOT EXISTS idx_appstore_notifications_user ON appstore_notifications(user_id);

CREATE INDEX IF NOT EXISTS idx_appstore_notifications_original_tx ON appstore_notifications(original_transaction_id);

CREATE TABLE IF NOT EXISTS waitlist_emails (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      source TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

UPDATE users SET plan = 'free' WHERE plan IS NULL;

CREATE TABLE IF NOT EXISTS workout_templates (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      split_type TEXT,
      is_favorite BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

ALTER TABLE workout_templates
      ADD COLUMN IF NOT EXISTS progressive_overload_enabled BOOLEAN;

ALTER TABLE workout_templates
      ADD COLUMN IF NOT EXISTS sharing_disabled BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS template_shares (
      id TEXT PRIMARY KEY,
      template_id TEXT NOT NULL REFERENCES workout_templates(id) ON DELETE CASCADE,
      share_code TEXT UNIQUE NOT NULL,
      created_by TEXT NOT NULL REFERENCES users(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      expires_at TIMESTAMPTZ,
      is_revoked BOOLEAN DEFAULT FALSE,
      views_count INTEGER DEFAULT 0,
      copies_count INTEGER DEFAULT 0
    );

CREATE INDEX IF NOT EXISTS template_shares_code_idx ON template_shares(share_code);

CREATE INDEX IF NOT EXISTS template_shares_template_idx ON template_shares(template_id);

CREATE INDEX IF NOT EXISTS template_shares_creator_idx ON template_shares(created_by);

CREATE TABLE IF NOT EXISTS template_share_copies (
      share_id TEXT NOT NULL REFERENCES template_shares(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      new_template_id TEXT NOT NULL REFERENCES workout_templates(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (share_id, user_id)
    );

CREATE INDEX IF NOT EXISTS template_share_copies_template_idx
    ON template_share_copies(new_template_id);

CREATE TABLE IF NOT EXISTS template_share_signups (
      share_id TEXT NOT NULL REFERENCES template_shares(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (share_id, user_id)
    );

CREATE INDEX IF NOT EXISTS template_share_signups_user_idx
    ON template_share_signups(user_id);

CREATE TABLE IF NOT EXISTS workout_template_exercises (
      id TEXT PRIMARY KEY,
      template_id TEXT NOT NULL REFERENCES workout_templates(id) ON DELETE CASCADE,
      order_index INTEGER NOT NULL,
      exercise_id TEXT NOT NULL,
      default_sets INTEGER NOT NULL,
      default_reps INTEGER NOT NULL,
      default_rest_seconds INTEGER,
      default_weight NUMERIC,
      default_incline NUMERIC,
      default_distance NUMERIC,
      default_duration_minutes NUMERIC,
      notes TEXT
    );

CREATE TABLE IF NOT EXISTS follows (
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      target_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (user_id, target_user_id)
    );

CREATE TABLE IF NOT EXISTS workout_sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      template_id TEXT REFERENCES workout_templates(id) ON DELETE SET NULL,
      template_name TEXT,
      started_at TIMESTAMPTZ NOT NULL,
      finished_at TIMESTAMPTZ,
      duration_seconds INTEGER,
      source TEXT NOT NULL DEFAULT 'manual',
      external_id TEXT,
      import_metadata JSONB,
      total_energy_burned NUMERIC,
      avg_heart_rate NUMERIC,
      max_heart_rate NUMERIC,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

ALTER TABLE workout_sessions
      ADD COLUMN IF NOT EXISTS template_name TEXT;

ALTER TABLE workout_sessions
      ADD COLUMN IF NOT EXISTS ended_reason TEXT,
      ADD COLUMN IF NOT EXISTS auto_ended_at TIMESTAMPTZ;

ALTER TABLE workout_sessions
      ADD COLUMN IF NOT EXISTS duration_seconds INTEGER,
      ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'manual',
      ADD COLUMN IF NOT EXISTS external_id TEXT,
      ADD COLUMN IF NOT EXISTS import_metadata JSONB,
      ADD COLUMN IF NOT EXISTS total_energy_burned NUMERIC,
      ADD COLUMN IF NOT EXISTS avg_heart_rate NUMERIC,
      ADD COLUMN IF NOT EXISTS max_heart_rate NUMERIC;

CREATE UNIQUE INDEX IF NOT EXISTS workout_sessions_user_external_idx
      ON workout_sessions(user_id, external_id)
      WHERE external_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS workout_sets (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES workout_sessions(id) ON DELETE CASCADE,
      template_exercise_id TEXT,
      exercise_id TEXT NOT NULL,
      set_index INTEGER NOT NULL,
      target_reps INTEGER,
      target_weight NUMERIC,
      actual_reps INTEGER,
      actual_weight NUMERIC,
      rpe NUMERIC
    );

CREATE INDEX IF NOT EXISTS workout_sets_session_idx ON workout_sets(session_id);

ALTER TABLE workout_sets
      ADD COLUMN IF NOT EXISTS target_distance NUMERIC,
      ADD COLUMN IF NOT EXISTS actual_distance NUMERIC,
      ADD COLUMN IF NOT EXISTS target_incline NUMERIC,
      ADD COLUMN IF NOT EXISTS actual_incline NUMERIC,
      ADD COLUMN IF NOT EXISTS target_duration_minutes NUMERIC,
      ADD COLUMN IF NOT EXISTS actual_duration_minutes NUMERIC;

CREATE TABLE IF NOT EXISTS active_workout_statuses (
      session_id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      template_id TEXT,
      template_name TEXT,
      started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      visibility TEXT NOT NULL DEFAULT 'private',
      current_exercise_name TEXT,
      is_active BOOLEAN NOT NULL DEFAULT true
    );

CREATE TABLE IF NOT EXISTS workout_shares (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      session_id TEXT,
      template_name TEXT,
      total_sets INTEGER,
      total_volume NUMERIC,
      pr_count INTEGER,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      visibility TEXT NOT NULL DEFAULT 'private',
      progress_photo_url TEXT
    );

CREATE TABLE IF NOT EXISTS squads (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      created_by TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

ALTER TABLE squads
      ADD COLUMN IF NOT EXISTS max_members INTEGER NOT NULL DEFAULT 50;

ALTER TABLE squads
      ADD COLUMN IF NOT EXISTS description TEXT,
      ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS squad_members (
      squad_id TEXT NOT NULL REFERENCES squads(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role TEXT NOT NULL DEFAULT 'member',
      joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (squad_id, user_id)
    );

ALTER TABLE squad_members
      ADD COLUMN IF NOT EXISTS invited_by TEXT REFERENCES users(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS squad_invite_links (
      id TEXT PRIMARY KEY,
      squad_id TEXT NOT NULL REFERENCES squads(id) ON DELETE CASCADE,
      code TEXT NOT NULL UNIQUE,
      created_by TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      expires_at TIMESTAMPTZ NOT NULL,
      is_revoked BOOLEAN NOT NULL DEFAULT false,
      uses_count INTEGER NOT NULL DEFAULT 0
    );

CREATE INDEX IF NOT EXISTS squad_invite_links_code_idx ON squad_invite_links(code);

CREATE INDEX IF NOT EXISTS squad_invite_links_squad_id_idx ON squad_invite_links(squad_id);

CREATE TABLE IF NOT EXISTS workout_reactions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      target_type TEXT NOT NULL CHECK (target_type IN ('status', 'share')),
      target_id TEXT NOT NULL,
      reaction_type TEXT NOT NULL CHECK (reaction_type IN ('emoji', 'comment')),
      emoji TEXT,
      comment TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

CREATE INDEX IF NOT EXISTS workout_reactions_target_idx ON workout_reactions(target_type, target_id);

CREATE INDEX IF NOT EXISTS workout_reactions_user_idx ON workout_reactions(user_id);

CREATE UNIQUE INDEX IF NOT EXISTS workout_reactions_unique_emoji_idx
    ON workout_reactions(user_id, target_type, target_id, emoji)
    WHERE reaction_type = 'emoji';

CREATE TABLE IF NOT EXISTS user_blocks (
      blocker_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      blocked_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (blocker_id, blocked_id)
    );

CREATE TABLE IF NOT EXISTS ai_generations (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      generation_type TEXT NOT NULL,
      input_params JSONB,
      output_data JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

CREATE INDEX IF NOT EXISTS ai_generations_user_id_idx ON ai_generations(user_id);

CREATE INDEX IF NOT EXISTS ai_generations_created_at_idx ON ai_generations(created_at);

CREATE TABLE IF NOT EXISTS notification_events (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      notification_type TEXT NOT NULL,
      trigger_reason TEXT,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      data JSONB,
      sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      read_at TIMESTAMPTZ,
      clicked_at TIMESTAMPTZ,
      delivery_status TEXT NOT NULL DEFAULT 'sent',
      error_message TEXT
    );

CREATE INDEX IF NOT EXISTS notification_events_user_id_idx ON notification_events(user_id);

CREATE INDEX IF NOT EXISTS notification_events_sent_at_idx ON notification_events(sent_at);

CREATE INDEX IF NOT EXISTS notification_events_user_read_idx ON notification_events(user_id, read_at);

CREATE TABLE IF NOT EXISTS admin_users (
      user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      granted_by TEXT REFERENCES users(id) ON DELETE SET NULL
    );

CREATE TABLE IF NOT EXISTS feedback_items (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      category TEXT NOT NULL CHECK (category IN ('feature_request', 'bug_report', 'ui_ux_improvement', 'performance', 'social_features')),
      impact TEXT NOT NULL CHECK (impact IN ('critical', 'high', 'medium', 'low', 'must_have', 'nice_to_have')),
      status TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted', 'under_review', 'planned', 'in_progress', 'shipped', 'wont_fix', 'duplicate')),
      vote_count INTEGER NOT NULL DEFAULT 0,
      is_hidden BOOLEAN NOT NULL DEFAULT false,
      auto_hidden_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      status_updated_at TIMESTAMPTZ,
      status_updated_by TEXT REFERENCES users(id) ON DELETE SET NULL
    );

CREATE INDEX IF NOT EXISTS feedback_items_user_id_idx ON feedback_items(user_id);

CREATE INDEX IF NOT EXISTS feedback_items_created_at_idx ON feedback_items(created_at DESC);

CREATE INDEX IF NOT EXISTS feedback_items_vote_count_idx ON feedback_items(vote_count DESC);

CREATE INDEX IF NOT EXISTS feedback_items_status_idx ON feedback_items(status);

CREATE INDEX IF NOT EXISTS feedback_items_category_idx ON feedback_items(category);

CREATE TABLE IF NOT EXISTS feedback_votes (
      id TEXT PRIMARY KEY,
      feedback_item_id TEXT NOT NULL REFERENCES feedback_items(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(feedback_item_id, user_id)
    );

CREATE INDEX IF NOT EXISTS feedback_votes_feedback_item_id_idx ON feedback_votes(feedback_item_id);

CREATE INDEX IF NOT EXISTS feedback_votes_user_id_idx ON feedback_votes(user_id);

CREATE TABLE IF NOT EXISTS feedback_reports (
      id TEXT PRIMARY KEY,
      feedback_item_id TEXT NOT NULL REFERENCES feedback_items(id) ON DELETE CASCADE,
      reported_by TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      reason TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      reviewed_at TIMESTAMPTZ,
      reviewed_by TEXT REFERENCES users(id) ON DELETE SET NULL,
      action_taken TEXT CHECK (action_taken IN ('hidden', 'dismissed', 'pending')),
      UNIQUE(feedback_item_id, reported_by)
    );

CREATE INDEX IF NOT EXISTS feedback_reports_feedback_item_id_idx ON feedback_reports(feedback_item_id);

CREATE INDEX IF NOT EXISTS feedback_reports_reviewed_at_idx ON feedback_reports(reviewed_at);

CREATE TABLE IF NOT EXISTS exercises (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      primary_muscle_group TEXT,
      equipment TEXT,
      category TEXT,
      level TEXT,
      force TEXT,
      mechanic TEXT,
      primary_muscles TEXT[],
      secondary_muscles TEXT[],
      instructions TEXT[],
      image_paths TEXT[]
    );

ALTER TABLE exercises
      ADD COLUMN IF NOT EXISTS category TEXT,
      ADD COLUMN IF NOT EXISTS level TEXT,
      ADD COLUMN IF NOT EXISTS force TEXT,
      ADD COLUMN IF NOT EXISTS mechanic TEXT,
      ADD COLUMN IF NOT EXISTS primary_muscles TEXT[],
      ADD COLUMN IF NOT EXISTS secondary_muscles TEXT[],
      ADD COLUMN IF NOT EXISTS instructions TEXT[],
      ADD COLUMN IF NOT EXISTS image_paths TEXT[];

ALTER TABLE workout_sets
      ADD COLUMN IF NOT EXISTS exercise_name TEXT,
      ADD COLUMN IF NOT EXISTS exercise_image_url TEXT;

CREATE TABLE IF NOT EXISTS user_exercises (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      primary_muscle_group TEXT NOT NULL,
      secondary_muscle_groups TEXT[],
      equipment TEXT,
      notes TEXT,
      image_url TEXT,
      scope TEXT NOT NULL DEFAULT 'personal' CHECK (scope IN ('personal', 'squad')),
      squad_id TEXT REFERENCES squads(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      deleted_at TIMESTAMPTZ
    );

CREATE INDEX IF NOT EXISTS user_exercises_user_id_idx ON user_exercises(user_id);

CREATE INDEX IF NOT EXISTS user_exercises_deleted_at_idx ON user_exercises(deleted_at);

CREATE INDEX IF NOT EXISTS user_exercises_squad_id_idx ON user_exercises(squad_id)
    WHERE squad_id IS NOT NULL;
