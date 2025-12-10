-- Supabase RLS policies for Push/Pull.
-- Run with a service role connection string. Assumes auth.uid() returns UUID; IDs are stored as TEXT so we cast.

-- Helper to reduce repetition
CREATE OR REPLACE FUNCTION public.current_uid_text() RETURNS TEXT AS $$
  SELECT auth.uid()::text;
$$ LANGUAGE sql STABLE;

-- users ----------------------------------------------------------------------
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS users_select_self ON users;
CREATE POLICY users_select_self
  ON users
  FOR SELECT
  USING (id = current_uid_text() OR auth.role() = 'service_role');

DROP POLICY IF EXISTS users_insert_self ON users;
CREATE POLICY users_insert_self
  ON users
  FOR INSERT
  WITH CHECK (id = current_uid_text() OR auth.role() = 'service_role');

DROP POLICY IF EXISTS users_update_self ON users;
CREATE POLICY users_update_self
  ON users
  FOR UPDATE
  USING (id = current_uid_text() OR auth.role() = 'service_role')
  WITH CHECK (id = current_uid_text() OR auth.role() = 'service_role');

-- subscription_events --------------------------------------------------------
ALTER TABLE subscription_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS subscription_events_select_own ON subscription_events;
CREATE POLICY subscription_events_select_own
  ON subscription_events
  FOR SELECT
  USING (user_id = current_uid_text() OR auth.role() = 'service_role');

DROP POLICY IF EXISTS subscription_events_service_only_insert ON subscription_events;
CREATE POLICY subscription_events_service_only_insert
  ON subscription_events
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- appstore_notifications -----------------------------------------------------
ALTER TABLE appstore_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS appstore_notifications_select_own ON appstore_notifications;
CREATE POLICY appstore_notifications_select_own
  ON appstore_notifications
  FOR SELECT
  USING (user_id = current_uid_text() OR auth.role() = 'service_role');

DROP POLICY IF EXISTS appstore_notifications_service_only_insert ON appstore_notifications;
CREATE POLICY appstore_notifications_service_only_insert
  ON appstore_notifications
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- waitlist_emails ------------------------------------------------------------
ALTER TABLE waitlist_emails ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS waitlist_emails_insert_public ON waitlist_emails;
CREATE POLICY waitlist_emails_insert_public
  ON waitlist_emails
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- workout_templates ----------------------------------------------------------
ALTER TABLE workout_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS workout_templates_select_own ON workout_templates;
CREATE POLICY workout_templates_select_own
  ON workout_templates
  FOR SELECT
  USING (user_id = current_uid_text() OR auth.role() = 'service_role');

DROP POLICY IF EXISTS workout_templates_insert_own ON workout_templates;
CREATE POLICY workout_templates_insert_own
  ON workout_templates
  FOR INSERT
  WITH CHECK (user_id = current_uid_text() OR auth.role() = 'service_role');

DROP POLICY IF EXISTS workout_templates_update_own ON workout_templates;
CREATE POLICY workout_templates_update_own
  ON workout_templates
  FOR UPDATE
  USING (user_id = current_uid_text() OR auth.role() = 'service_role')
  WITH CHECK (user_id = current_uid_text() OR auth.role() = 'service_role');

DROP POLICY IF EXISTS workout_templates_delete_own ON workout_templates;
CREATE POLICY workout_templates_delete_own
  ON workout_templates
  FOR DELETE
  USING (user_id = current_uid_text() OR auth.role() = 'service_role');

-- workout_template_exercises -------------------------------------------------
ALTER TABLE workout_template_exercises ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS workout_template_exercises_select_parent_owner ON workout_template_exercises;
CREATE POLICY workout_template_exercises_select_parent_owner
  ON workout_template_exercises
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM workout_templates wt
      WHERE wt.id = template_id AND wt.user_id = current_uid_text()
    ) OR auth.role() = 'service_role'
  );

DROP POLICY IF EXISTS workout_template_exercises_insert_parent_owner ON workout_template_exercises;
CREATE POLICY workout_template_exercises_insert_parent_owner
  ON workout_template_exercises
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM workout_templates wt
      WHERE wt.id = template_id AND wt.user_id = current_uid_text()
    ) OR auth.role() = 'service_role'
  );

DROP POLICY IF EXISTS workout_template_exercises_update_parent_owner ON workout_template_exercises;
CREATE POLICY workout_template_exercises_update_parent_owner
  ON workout_template_exercises
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM workout_templates wt
      WHERE wt.id = template_id AND wt.user_id = current_uid_text()
    ) OR auth.role() = 'service_role'
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM workout_templates wt
      WHERE wt.id = template_id AND wt.user_id = current_uid_text()
    ) OR auth.role() = 'service_role'
  );

DROP POLICY IF EXISTS workout_template_exercises_delete_parent_owner ON workout_template_exercises;
CREATE POLICY workout_template_exercises_delete_parent_owner
  ON workout_template_exercises
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM workout_templates wt
      WHERE wt.id = template_id AND wt.user_id = current_uid_text()
    ) OR auth.role() = 'service_role'
  );

-- follows --------------------------------------------------------------------
ALTER TABLE follows ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS follows_select_related ON follows;
CREATE POLICY follows_select_related
  ON follows
  FOR SELECT
  USING (
    current_uid_text() IN (user_id, target_user_id) OR auth.role() = 'service_role'
  );

DROP POLICY IF EXISTS follows_insert_self ON follows;
CREATE POLICY follows_insert_self
  ON follows
  FOR INSERT
  WITH CHECK (user_id = current_uid_text() OR auth.role() = 'service_role');

DROP POLICY IF EXISTS follows_delete_self ON follows;
CREATE POLICY follows_delete_self
  ON follows
  FOR DELETE
  USING (user_id = current_uid_text() OR auth.role() = 'service_role');

-- workout_sessions -----------------------------------------------------------
ALTER TABLE workout_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS workout_sessions_select_owner ON workout_sessions;
CREATE POLICY workout_sessions_select_owner
  ON workout_sessions
  FOR SELECT
  USING (user_id = current_uid_text() OR auth.role() = 'service_role');

DROP POLICY IF EXISTS workout_sessions_insert_owner ON workout_sessions;
CREATE POLICY workout_sessions_insert_owner
  ON workout_sessions
  FOR INSERT
  WITH CHECK (user_id = current_uid_text() OR auth.role() = 'service_role');

DROP POLICY IF EXISTS workout_sessions_update_owner ON workout_sessions;
CREATE POLICY workout_sessions_update_owner
  ON workout_sessions
  FOR UPDATE
  USING (user_id = current_uid_text() OR auth.role() = 'service_role')
  WITH CHECK (user_id = current_uid_text() OR auth.role() = 'service_role');

DROP POLICY IF EXISTS workout_sessions_delete_owner ON workout_sessions;
CREATE POLICY workout_sessions_delete_owner
  ON workout_sessions
  FOR DELETE
  USING (user_id = current_uid_text() OR auth.role() = 'service_role');

-- workout_sets ---------------------------------------------------------------
ALTER TABLE workout_sets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS workout_sets_select_owner ON workout_sets;
CREATE POLICY workout_sets_select_owner
  ON workout_sets
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM workout_sessions ws
      WHERE ws.id = session_id AND ws.user_id = current_uid_text()
    ) OR auth.role() = 'service_role'
  );

DROP POLICY IF EXISTS workout_sets_insert_owner ON workout_sets;
CREATE POLICY workout_sets_insert_owner
  ON workout_sets
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM workout_sessions ws
      WHERE ws.id = session_id AND ws.user_id = current_uid_text()
    ) OR auth.role() = 'service_role'
  );

DROP POLICY IF EXISTS workout_sets_update_owner ON workout_sets;
CREATE POLICY workout_sets_update_owner
  ON workout_sets
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM workout_sessions ws
      WHERE ws.id = session_id AND ws.user_id = current_uid_text()
    ) OR auth.role() = 'service_role'
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM workout_sessions ws
      WHERE ws.id = session_id AND ws.user_id = current_uid_text()
    ) OR auth.role() = 'service_role'
  );

DROP POLICY IF EXISTS workout_sets_delete_owner ON workout_sets;
CREATE POLICY workout_sets_delete_owner
  ON workout_sets
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM workout_sessions ws
      WHERE ws.id = session_id AND ws.user_id = current_uid_text()
    ) OR auth.role() = 'service_role'
  );

-- active_workout_statuses ----------------------------------------------------
ALTER TABLE active_workout_statuses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS active_workout_statuses_select_owner ON active_workout_statuses;
CREATE POLICY active_workout_statuses_select_owner
  ON active_workout_statuses
  FOR SELECT
  USING (user_id = current_uid_text() OR auth.role() = 'service_role');

DROP POLICY IF EXISTS active_workout_statuses_insert_owner ON active_workout_statuses;
CREATE POLICY active_workout_statuses_insert_owner
  ON active_workout_statuses
  FOR INSERT
  WITH CHECK (user_id = current_uid_text() OR auth.role() = 'service_role');

DROP POLICY IF EXISTS active_workout_statuses_update_owner ON active_workout_statuses;
CREATE POLICY active_workout_statuses_update_owner
  ON active_workout_statuses
  FOR UPDATE
  USING (user_id = current_uid_text() OR auth.role() = 'service_role')
  WITH CHECK (user_id = current_uid_text() OR auth.role() = 'service_role');

DROP POLICY IF EXISTS active_workout_statuses_delete_owner ON active_workout_statuses;
CREATE POLICY active_workout_statuses_delete_owner
  ON active_workout_statuses
  FOR DELETE
  USING (user_id = current_uid_text() OR auth.role() = 'service_role');

-- workout_shares -------------------------------------------------------------
ALTER TABLE workout_shares ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS workout_shares_select_owner ON workout_shares;
CREATE POLICY workout_shares_select_owner
  ON workout_shares
  FOR SELECT
  USING (user_id = current_uid_text() OR auth.role() = 'service_role');

DROP POLICY IF EXISTS workout_shares_insert_owner ON workout_shares;
CREATE POLICY workout_shares_insert_owner
  ON workout_shares
  FOR INSERT
  WITH CHECK (user_id = current_uid_text() OR auth.role() = 'service_role');

DROP POLICY IF EXISTS workout_shares_update_owner ON workout_shares;
CREATE POLICY workout_shares_update_owner
  ON workout_shares
  FOR UPDATE
  USING (user_id = current_uid_text() OR auth.role() = 'service_role')
  WITH CHECK (user_id = current_uid_text() OR auth.role() = 'service_role');

DROP POLICY IF EXISTS workout_shares_delete_owner ON workout_shares;
CREATE POLICY workout_shares_delete_owner
  ON workout_shares
  FOR DELETE
  USING (user_id = current_uid_text() OR auth.role() = 'service_role');

-- squads ---------------------------------------------------------------------
ALTER TABLE squads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS squads_select_accessible ON squads;
CREATE POLICY squads_select_accessible
  ON squads
  FOR SELECT
  USING (
    is_public
    OR EXISTS (
      SELECT 1 FROM squad_members sm WHERE sm.squad_id = id AND sm.user_id = current_uid_text()
    )
    OR auth.role() = 'service_role'
  );

DROP POLICY IF EXISTS squads_insert_owner ON squads;
CREATE POLICY squads_insert_owner
  ON squads
  FOR INSERT
  WITH CHECK (created_by = current_uid_text() OR auth.role() = 'service_role');

DROP POLICY IF EXISTS squads_update_owner_or_admin ON squads;
CREATE POLICY squads_update_owner_or_admin
  ON squads
  FOR UPDATE
  USING (
    created_by = current_uid_text()
    OR EXISTS (SELECT 1 FROM admin_users au WHERE au.user_id = current_uid_text())
    OR auth.role() = 'service_role'
  )
  WITH CHECK (
    created_by = current_uid_text()
    OR EXISTS (SELECT 1 FROM admin_users au WHERE au.user_id = current_uid_text())
    OR auth.role() = 'service_role'
  );

DROP POLICY IF EXISTS squads_delete_owner_or_admin ON squads;
CREATE POLICY squads_delete_owner_or_admin
  ON squads
  FOR DELETE
  USING (
    created_by = current_uid_text()
    OR EXISTS (SELECT 1 FROM admin_users au WHERE au.user_id = current_uid_text())
    OR auth.role() = 'service_role'
  );

-- squad_members --------------------------------------------------------------
ALTER TABLE squad_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS squad_members_select_on_squad ON squad_members;
CREATE POLICY squad_members_select_on_squad
  ON squad_members
  FOR SELECT
  USING (
    user_id = current_uid_text()
    OR EXISTS (SELECT 1 FROM squads s WHERE s.id = squad_id AND s.created_by = current_uid_text())
    OR auth.role() = 'service_role'
  );

DROP POLICY IF EXISTS squad_members_insert_allowed ON squad_members;
CREATE POLICY squad_members_insert_allowed
  ON squad_members
  FOR INSERT
  WITH CHECK (
    user_id = current_uid_text()
    OR EXISTS (SELECT 1 FROM squads s WHERE s.id = squad_id AND s.created_by = current_uid_text())
    OR auth.role() = 'service_role'
  );

DROP POLICY IF EXISTS squad_members_update_allowed ON squad_members;
CREATE POLICY squad_members_update_allowed
  ON squad_members
  FOR UPDATE
  USING (
    user_id = current_uid_text()
    OR EXISTS (SELECT 1 FROM squads s WHERE s.id = squad_id AND s.created_by = current_uid_text())
    OR auth.role() = 'service_role'
  )
  WITH CHECK (
    user_id = current_uid_text()
    OR EXISTS (SELECT 1 FROM squads s WHERE s.id = squad_id AND s.created_by = current_uid_text())
    OR auth.role() = 'service_role'
  );

DROP POLICY IF EXISTS squad_members_delete_allowed ON squad_members;
CREATE POLICY squad_members_delete_allowed
  ON squad_members
  FOR DELETE
  USING (
    user_id = current_uid_text()
    OR EXISTS (SELECT 1 FROM squads s WHERE s.id = squad_id AND s.created_by = current_uid_text())
    OR auth.role() = 'service_role'
  );

-- squad_invite_links ---------------------------------------------------------
ALTER TABLE squad_invite_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS squad_invite_links_select_owner ON squad_invite_links;
CREATE POLICY squad_invite_links_select_owner
  ON squad_invite_links
  FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM squads s WHERE s.id = squad_id AND s.created_by = current_uid_text())
    OR auth.role() = 'service_role'
  );

DROP POLICY IF EXISTS squad_invite_links_insert_owner ON squad_invite_links;
CREATE POLICY squad_invite_links_insert_owner
  ON squad_invite_links
  FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM squads s WHERE s.id = squad_id AND s.created_by = current_uid_text())
    OR auth.role() = 'service_role'
  );

DROP POLICY IF EXISTS squad_invite_links_update_owner ON squad_invite_links;
CREATE POLICY squad_invite_links_update_owner
  ON squad_invite_links
  FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM squads s WHERE s.id = squad_id AND s.created_by = current_uid_text())
    OR auth.role() = 'service_role'
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM squads s WHERE s.id = squad_id AND s.created_by = current_uid_text())
    OR auth.role() = 'service_role'
  );

DROP POLICY IF EXISTS squad_invite_links_delete_owner ON squad_invite_links;
CREATE POLICY squad_invite_links_delete_owner
  ON squad_invite_links
  FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM squads s WHERE s.id = squad_id AND s.created_by = current_uid_text())
    OR auth.role() = 'service_role'
  );

-- workout_reactions ----------------------------------------------------------
ALTER TABLE workout_reactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS workout_reactions_select_on_owner ON workout_reactions;
CREATE POLICY workout_reactions_select_on_owner
  ON workout_reactions
  FOR SELECT
  USING (
    user_id = current_uid_text()
    OR (
      target_type = 'share' AND EXISTS (
        SELECT 1 FROM workout_shares ws WHERE ws.id = target_id AND ws.user_id = current_uid_text()
      )
    )
    OR (
      target_type = 'status' AND EXISTS (
        SELECT 1 FROM active_workout_statuses aws WHERE aws.session_id = target_id AND aws.user_id = current_uid_text()
      )
    )
    OR auth.role() = 'service_role'
  );

DROP POLICY IF EXISTS workout_reactions_insert_self ON workout_reactions;
CREATE POLICY workout_reactions_insert_self
  ON workout_reactions
  FOR INSERT
  WITH CHECK (user_id = current_uid_text() OR auth.role() = 'service_role');

DROP POLICY IF EXISTS workout_reactions_update_self ON workout_reactions;
CREATE POLICY workout_reactions_update_self
  ON workout_reactions
  FOR UPDATE
  USING (user_id = current_uid_text() OR auth.role() = 'service_role')
  WITH CHECK (user_id = current_uid_text() OR auth.role() = 'service_role');

DROP POLICY IF EXISTS workout_reactions_delete_self ON workout_reactions;
CREATE POLICY workout_reactions_delete_self
  ON workout_reactions
  FOR DELETE
  USING (user_id = current_uid_text() OR auth.role() = 'service_role');

-- user_blocks ----------------------------------------------------------------
ALTER TABLE user_blocks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_blocks_select_owner ON user_blocks;
CREATE POLICY user_blocks_select_owner
  ON user_blocks
  FOR SELECT
  USING (blocker_id = current_uid_text() OR auth.role() = 'service_role');

DROP POLICY IF EXISTS user_blocks_insert_owner ON user_blocks;
CREATE POLICY user_blocks_insert_owner
  ON user_blocks
  FOR INSERT
  WITH CHECK (blocker_id = current_uid_text() OR auth.role() = 'service_role');

DROP POLICY IF EXISTS user_blocks_delete_owner ON user_blocks;
CREATE POLICY user_blocks_delete_owner
  ON user_blocks
  FOR DELETE
  USING (blocker_id = current_uid_text() OR auth.role() = 'service_role');

-- ai_generations -------------------------------------------------------------
ALTER TABLE ai_generations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ai_generations_select_owner ON ai_generations;
CREATE POLICY ai_generations_select_owner
  ON ai_generations
  FOR SELECT
  USING (user_id = current_uid_text() OR auth.role() = 'service_role');

DROP POLICY IF EXISTS ai_generations_insert_owner ON ai_generations;
CREATE POLICY ai_generations_insert_owner
  ON ai_generations
  FOR INSERT
  WITH CHECK (user_id = current_uid_text() OR auth.role() = 'service_role');

-- notification_events --------------------------------------------------------
ALTER TABLE notification_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS notification_events_select_owner ON notification_events;
CREATE POLICY notification_events_select_owner
  ON notification_events
  FOR SELECT
  USING (user_id = current_uid_text() OR auth.role() = 'service_role');

DROP POLICY IF EXISTS notification_events_insert_owner ON notification_events;
CREATE POLICY notification_events_insert_owner
  ON notification_events
  FOR INSERT
  WITH CHECK (user_id = current_uid_text() OR auth.role() = 'service_role');

DROP POLICY IF EXISTS notification_events_update_owner ON notification_events;
CREATE POLICY notification_events_update_owner
  ON notification_events
  FOR UPDATE
  USING (user_id = current_uid_text() OR auth.role() = 'service_role')
  WITH CHECK (user_id = current_uid_text() OR auth.role() = 'service_role');

-- admin_users ----------------------------------------------------------------
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS admin_users_select_self ON admin_users;
CREATE POLICY admin_users_select_self
  ON admin_users
  FOR SELECT
  USING (user_id = current_uid_text() OR auth.role() = 'service_role');

DROP POLICY IF EXISTS admin_users_service_only_write ON admin_users;
CREATE POLICY admin_users_service_only_write
  ON admin_users
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- feedback_items -------------------------------------------------------------
ALTER TABLE feedback_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS feedback_items_select_visible ON feedback_items;
CREATE POLICY feedback_items_select_visible
  ON feedback_items
  FOR SELECT
  USING (
    NOT is_hidden
    OR user_id = current_uid_text()
    OR EXISTS (SELECT 1 FROM admin_users au WHERE au.user_id = current_uid_text())
    OR auth.role() = 'service_role'
  );

DROP POLICY IF EXISTS feedback_items_insert_owner ON feedback_items;
CREATE POLICY feedback_items_insert_owner
  ON feedback_items
  FOR INSERT
  WITH CHECK (user_id = current_uid_text() OR auth.role() = 'service_role');

DROP POLICY IF EXISTS feedback_items_update_owner_or_admin ON feedback_items;
CREATE POLICY feedback_items_update_owner_or_admin
  ON feedback_items
  FOR UPDATE
  USING (
    user_id = current_uid_text()
    OR EXISTS (SELECT 1 FROM admin_users au WHERE au.user_id = current_uid_text())
    OR auth.role() = 'service_role'
  )
  WITH CHECK (
    user_id = current_uid_text()
    OR EXISTS (SELECT 1 FROM admin_users au WHERE au.user_id = current_uid_text())
    OR auth.role() = 'service_role'
  );

DROP POLICY IF EXISTS feedback_items_delete_admin ON feedback_items;
CREATE POLICY feedback_items_delete_admin
  ON feedback_items
  FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM admin_users au WHERE au.user_id = current_uid_text())
    OR auth.role() = 'service_role'
  );

-- feedback_votes -------------------------------------------------------------
ALTER TABLE feedback_votes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS feedback_votes_select_self ON feedback_votes;
CREATE POLICY feedback_votes_select_self
  ON feedback_votes
  FOR SELECT
  USING (user_id = current_uid_text() OR auth.role() = 'service_role');

DROP POLICY IF EXISTS feedback_votes_insert_self ON feedback_votes;
CREATE POLICY feedback_votes_insert_self
  ON feedback_votes
  FOR INSERT
  WITH CHECK (user_id = current_uid_text() OR auth.role() = 'service_role');

DROP POLICY IF EXISTS feedback_votes_delete_self ON feedback_votes;
CREATE POLICY feedback_votes_delete_self
  ON feedback_votes
  FOR DELETE
  USING (user_id = current_uid_text() OR auth.role() = 'service_role');

-- feedback_reports -----------------------------------------------------------
ALTER TABLE feedback_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS feedback_reports_select_self_or_admin ON feedback_reports;
CREATE POLICY feedback_reports_select_self_or_admin
  ON feedback_reports
  FOR SELECT
  USING (
    reported_by = current_uid_text()
    OR EXISTS (SELECT 1 FROM admin_users au WHERE au.user_id = current_uid_text())
    OR auth.role() = 'service_role'
  );

DROP POLICY IF EXISTS feedback_reports_insert_self ON feedback_reports;
CREATE POLICY feedback_reports_insert_self
  ON feedback_reports
  FOR INSERT
  WITH CHECK (reported_by = current_uid_text() OR auth.role() = 'service_role');

DROP POLICY IF EXISTS feedback_reports_delete_admin ON feedback_reports;
CREATE POLICY feedback_reports_delete_admin
  ON feedback_reports
  FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM admin_users au WHERE au.user_id = current_uid_text())
    OR auth.role() = 'service_role'
  );

-- exercises ------------------------------------------------------------------
ALTER TABLE exercises ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS exercises_read_all ON exercises;
CREATE POLICY exercises_read_all
  ON exercises
  FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS exercises_service_only_write ON exercises;
CREATE POLICY exercises_service_only_write
  ON exercises
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
