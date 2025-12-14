-- Baseline Supabase RLS policies.
-- Goal: keep PostgREST exposure locked down by default while allowing explicit public endpoints.
--
-- Notes:
-- - This project uses Auth0 (not Supabase Auth), so we DO NOT rely on auth.uid() here.
-- - These policies are primarily for Supabase API roles (anon/authenticated/service_role).
-- - Your Express server connects directly to Postgres (table owner) and is not gated by these
--   policies unless you enable "FORCE ROW LEVEL SECURITY" on tables.

-- Helper: create a service_role "allow all" policy if missing.
DO $$
BEGIN
  -- users
  ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'users' AND policyname = 'users_service_role_all'
  ) THEN
    EXECUTE 'CREATE POLICY users_service_role_all ON public.users FOR ALL TO service_role USING (true) WITH CHECK (true)';
  END IF;

  -- subscription_events
  ALTER TABLE public.subscription_events ENABLE ROW LEVEL SECURITY;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'subscription_events' AND policyname = 'subscription_events_service_role_all'
  ) THEN
    EXECUTE 'CREATE POLICY subscription_events_service_role_all ON public.subscription_events FOR ALL TO service_role USING (true) WITH CHECK (true)';
  END IF;

  -- appstore_notifications
  ALTER TABLE public.appstore_notifications ENABLE ROW LEVEL SECURITY;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'appstore_notifications' AND policyname = 'appstore_notifications_service_role_all'
  ) THEN
    EXECUTE 'CREATE POLICY appstore_notifications_service_role_all ON public.appstore_notifications FOR ALL TO service_role USING (true) WITH CHECK (true)';
  END IF;

  -- waitlist_emails (public insert)
  ALTER TABLE public.waitlist_emails ENABLE ROW LEVEL SECURITY;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'waitlist_emails' AND policyname = 'waitlist_emails_service_role_all'
  ) THEN
    EXECUTE 'CREATE POLICY waitlist_emails_service_role_all ON public.waitlist_emails FOR ALL TO service_role USING (true) WITH CHECK (true)';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'waitlist_emails' AND policyname = 'waitlist_emails_insert_public'
  ) THEN
    EXECUTE 'CREATE POLICY waitlist_emails_insert_public ON public.waitlist_emails FOR INSERT TO anon, authenticated WITH CHECK (true)';
  END IF;

  -- workout_templates
  ALTER TABLE public.workout_templates ENABLE ROW LEVEL SECURITY;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'workout_templates' AND policyname = 'workout_templates_service_role_all'
  ) THEN
    EXECUTE 'CREATE POLICY workout_templates_service_role_all ON public.workout_templates FOR ALL TO service_role USING (true) WITH CHECK (true)';
  END IF;

  -- template_shares
  ALTER TABLE public.template_shares ENABLE ROW LEVEL SECURITY;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'template_shares' AND policyname = 'template_shares_service_role_all'
  ) THEN
    EXECUTE 'CREATE POLICY template_shares_service_role_all ON public.template_shares FOR ALL TO service_role USING (true) WITH CHECK (true)';
  END IF;

  -- template_share_copies
  ALTER TABLE public.template_share_copies ENABLE ROW LEVEL SECURITY;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'template_share_copies' AND policyname = 'template_share_copies_service_role_all'
  ) THEN
    EXECUTE 'CREATE POLICY template_share_copies_service_role_all ON public.template_share_copies FOR ALL TO service_role USING (true) WITH CHECK (true)';
  END IF;

  -- template_share_signups
  ALTER TABLE public.template_share_signups ENABLE ROW LEVEL SECURITY;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'template_share_signups' AND policyname = 'template_share_signups_service_role_all'
  ) THEN
    EXECUTE 'CREATE POLICY template_share_signups_service_role_all ON public.template_share_signups FOR ALL TO service_role USING (true) WITH CHECK (true)';
  END IF;

  -- workout_template_exercises
  ALTER TABLE public.workout_template_exercises ENABLE ROW LEVEL SECURITY;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'workout_template_exercises' AND policyname = 'workout_template_exercises_service_role_all'
  ) THEN
    EXECUTE 'CREATE POLICY workout_template_exercises_service_role_all ON public.workout_template_exercises FOR ALL TO service_role USING (true) WITH CHECK (true)';
  END IF;

  -- follows
  ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'follows' AND policyname = 'follows_service_role_all'
  ) THEN
    EXECUTE 'CREATE POLICY follows_service_role_all ON public.follows FOR ALL TO service_role USING (true) WITH CHECK (true)';
  END IF;

  -- workout_sessions
  ALTER TABLE public.workout_sessions ENABLE ROW LEVEL SECURITY;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'workout_sessions' AND policyname = 'workout_sessions_service_role_all'
  ) THEN
    EXECUTE 'CREATE POLICY workout_sessions_service_role_all ON public.workout_sessions FOR ALL TO service_role USING (true) WITH CHECK (true)';
  END IF;

  -- workout_sets
  ALTER TABLE public.workout_sets ENABLE ROW LEVEL SECURITY;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'workout_sets' AND policyname = 'workout_sets_service_role_all'
  ) THEN
    EXECUTE 'CREATE POLICY workout_sets_service_role_all ON public.workout_sets FOR ALL TO service_role USING (true) WITH CHECK (true)';
  END IF;

  -- active_workout_statuses
  ALTER TABLE public.active_workout_statuses ENABLE ROW LEVEL SECURITY;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'active_workout_statuses' AND policyname = 'active_workout_statuses_service_role_all'
  ) THEN
    EXECUTE 'CREATE POLICY active_workout_statuses_service_role_all ON public.active_workout_statuses FOR ALL TO service_role USING (true) WITH CHECK (true)';
  END IF;

  -- workout_shares
  ALTER TABLE public.workout_shares ENABLE ROW LEVEL SECURITY;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'workout_shares' AND policyname = 'workout_shares_service_role_all'
  ) THEN
    EXECUTE 'CREATE POLICY workout_shares_service_role_all ON public.workout_shares FOR ALL TO service_role USING (true) WITH CHECK (true)';
  END IF;

  -- squads
  ALTER TABLE public.squads ENABLE ROW LEVEL SECURITY;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'squads' AND policyname = 'squads_service_role_all'
  ) THEN
    EXECUTE 'CREATE POLICY squads_service_role_all ON public.squads FOR ALL TO service_role USING (true) WITH CHECK (true)';
  END IF;

  -- squad_members
  ALTER TABLE public.squad_members ENABLE ROW LEVEL SECURITY;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'squad_members' AND policyname = 'squad_members_service_role_all'
  ) THEN
    EXECUTE 'CREATE POLICY squad_members_service_role_all ON public.squad_members FOR ALL TO service_role USING (true) WITH CHECK (true)';
  END IF;

  -- squad_invite_links
  ALTER TABLE public.squad_invite_links ENABLE ROW LEVEL SECURITY;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'squad_invite_links' AND policyname = 'squad_invite_links_service_role_all'
  ) THEN
    EXECUTE 'CREATE POLICY squad_invite_links_service_role_all ON public.squad_invite_links FOR ALL TO service_role USING (true) WITH CHECK (true)';
  END IF;

  -- workout_reactions
  ALTER TABLE public.workout_reactions ENABLE ROW LEVEL SECURITY;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'workout_reactions' AND policyname = 'workout_reactions_service_role_all'
  ) THEN
    EXECUTE 'CREATE POLICY workout_reactions_service_role_all ON public.workout_reactions FOR ALL TO service_role USING (true) WITH CHECK (true)';
  END IF;

  -- user_blocks
  ALTER TABLE public.user_blocks ENABLE ROW LEVEL SECURITY;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'user_blocks' AND policyname = 'user_blocks_service_role_all'
  ) THEN
    EXECUTE 'CREATE POLICY user_blocks_service_role_all ON public.user_blocks FOR ALL TO service_role USING (true) WITH CHECK (true)';
  END IF;

  -- ai_generations
  ALTER TABLE public.ai_generations ENABLE ROW LEVEL SECURITY;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'ai_generations' AND policyname = 'ai_generations_service_role_all'
  ) THEN
    EXECUTE 'CREATE POLICY ai_generations_service_role_all ON public.ai_generations FOR ALL TO service_role USING (true) WITH CHECK (true)';
  END IF;

  -- notification_events
  ALTER TABLE public.notification_events ENABLE ROW LEVEL SECURITY;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'notification_events' AND policyname = 'notification_events_service_role_all'
  ) THEN
    EXECUTE 'CREATE POLICY notification_events_service_role_all ON public.notification_events FOR ALL TO service_role USING (true) WITH CHECK (true)';
  END IF;

  -- admin_users
  ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'admin_users' AND policyname = 'admin_users_service_role_all'
  ) THEN
    EXECUTE 'CREATE POLICY admin_users_service_role_all ON public.admin_users FOR ALL TO service_role USING (true) WITH CHECK (true)';
  END IF;

  -- feedback_items
  ALTER TABLE public.feedback_items ENABLE ROW LEVEL SECURITY;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'feedback_items' AND policyname = 'feedback_items_service_role_all'
  ) THEN
    EXECUTE 'CREATE POLICY feedback_items_service_role_all ON public.feedback_items FOR ALL TO service_role USING (true) WITH CHECK (true)';
  END IF;

  -- feedback_votes
  ALTER TABLE public.feedback_votes ENABLE ROW LEVEL SECURITY;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'feedback_votes' AND policyname = 'feedback_votes_service_role_all'
  ) THEN
    EXECUTE 'CREATE POLICY feedback_votes_service_role_all ON public.feedback_votes FOR ALL TO service_role USING (true) WITH CHECK (true)';
  END IF;

  -- feedback_reports
  ALTER TABLE public.feedback_reports ENABLE ROW LEVEL SECURITY;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'feedback_reports' AND policyname = 'feedback_reports_service_role_all'
  ) THEN
    EXECUTE 'CREATE POLICY feedback_reports_service_role_all ON public.feedback_reports FOR ALL TO service_role USING (true) WITH CHECK (true)';
  END IF;

  -- exercises (public read)
  ALTER TABLE public.exercises ENABLE ROW LEVEL SECURITY;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'exercises' AND policyname = 'exercises_service_role_all'
  ) THEN
    EXECUTE 'CREATE POLICY exercises_service_role_all ON public.exercises FOR ALL TO service_role USING (true) WITH CHECK (true)';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'exercises' AND policyname = 'exercises_read_all'
  ) THEN
    EXECUTE 'CREATE POLICY exercises_read_all ON public.exercises FOR SELECT TO anon, authenticated USING (true)';
  END IF;

  -- user_exercises
  ALTER TABLE public.user_exercises ENABLE ROW LEVEL SECURITY;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'user_exercises' AND policyname = 'user_exercises_service_role_all'
  ) THEN
    EXECUTE 'CREATE POLICY user_exercises_service_role_all ON public.user_exercises FOR ALL TO service_role USING (true) WITH CHECK (true)';
  END IF;
END $$;

