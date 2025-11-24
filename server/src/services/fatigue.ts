import { query } from "../db";
import { MuscleFatigueData, RecentWorkout } from "./ai/AIProvider.interface";

/**
 * Calculate muscle group fatigue based on recent training volume
 * Returns a score where:
 * - 0-70: Under-trained
 * - 70-110: Optimal
 * - 110-130: Moderate fatigue
 * - 130+: High fatigue
 */
export const calculateMuscleFatigue = async (
  userId: string
): Promise<MuscleFatigueData> => {
  try {
    // Get volume per muscle group for last 7 days
    const last7DaysQuery = await query<{
      muscle_group: string;
      total_volume: string;
    }>(
      `
      WITH exercise_data AS (
        SELECT
          e.id as exercise_id,
          e.name as exercise_name,
          e.primary_muscle_group
        FROM exercises e
      ),
      recent_sets AS (
        SELECT
          ws.exercise_id,
          ed.primary_muscle_group as muscle_group,
          ws.actual_reps,
          ws.actual_weight
        FROM workout_sets ws
        JOIN workout_sessions wss ON ws.session_id = wss.id
        LEFT JOIN exercise_data ed ON ws.exercise_id = ed.exercise_id
        WHERE wss.user_id = $1
          AND wss.finished_at IS NOT NULL
          AND wss.finished_at >= NOW() - INTERVAL '7 days'
          AND ws.actual_reps IS NOT NULL
      )
      SELECT
        muscle_group,
        SUM(COALESCE(actual_reps, 0) * COALESCE(actual_weight, 0)) as total_volume
      FROM recent_sets
      WHERE muscle_group IS NOT NULL
      GROUP BY muscle_group
    `,
      [userId]
    );

    // Get baseline volume (average from 4 weeks ago to 1 week ago)
    const baselineQuery = await query<{
      muscle_group: string;
      avg_volume: string;
    }>(
      `
      WITH exercise_data AS (
        SELECT
          e.id as exercise_id,
          e.name as exercise_name,
          e.primary_muscle_group
        FROM exercises e
      ),
      baseline_sets AS (
        SELECT
          ws.exercise_id,
          ed.primary_muscle_group as muscle_group,
          ws.actual_reps,
          ws.actual_weight
        FROM workout_sets ws
        JOIN workout_sessions wss ON ws.session_id = wss.id
        LEFT JOIN exercise_data ed ON ws.exercise_id = ed.exercise_id
        WHERE wss.user_id = $1
          AND wss.finished_at IS NOT NULL
          AND wss.finished_at >= NOW() - INTERVAL '4 weeks'
          AND wss.finished_at < NOW() - INTERVAL '7 days'
          AND ws.actual_reps IS NOT NULL
      )
      SELECT
        muscle_group,
        AVG(COALESCE(actual_reps, 0) * COALESCE(actual_weight, 0)) * 7 as avg_volume
      FROM baseline_sets
      WHERE muscle_group IS NOT NULL
      GROUP BY muscle_group
    `,
      [userId]
    );

    const last7DaysVolume = new Map(
      last7DaysQuery.rows.map((row) => [
        row.muscle_group,
        parseFloat(row.total_volume),
      ])
    );

    const baselineVolume = new Map(
      baselineQuery.rows.map((row) => [
        row.muscle_group,
        parseFloat(row.avg_volume),
      ])
    );

    // Calculate fatigue scores
    const fatigueScores: MuscleFatigueData = {};
    const muscleGroups = [
      "chest",
      "back",
      "shoulders",
      "biceps",
      "triceps",
      "legs",
      "glutes",
      "core",
    ];

    for (const muscle of muscleGroups) {
      const recent = last7DaysVolume.get(muscle) || 0;
      const baseline = baselineVolume.get(muscle) || 0;

      if (baseline === 0) {
        // No baseline data - assume fresh
        fatigueScores[muscle as keyof MuscleFatigueData] = 50;
      } else {
        // Calculate as percentage of baseline
        const score = Math.round((recent / baseline) * 100);
        fatigueScores[muscle as keyof MuscleFatigueData] = score;
      }
    }

    return fatigueScores;
  } catch (error) {
    console.error("[Fatigue] Error calculating muscle fatigue:", error);
    // Return default scores on error
    return {};
  }
};

/**
 * Fetch recent workout history for AI context
 */
export const getRecentWorkouts = async (
  userId: string,
  limit: number = 5
): Promise<RecentWorkout[]> => {
  try {
    const sessionsResult = await query<{
      session_id: string;
      template_name: string;
      split_type: string;
      finished_at: string;
    }>(
      `
      SELECT
        ws.id as session_id,
        COALESCE(wt.name, 'Unnamed Workout') as template_name,
        wt.split_type,
        ws.finished_at
      FROM workout_sessions ws
      LEFT JOIN workout_templates wt ON ws.template_id = wt.id
      WHERE ws.user_id = $1
        AND ws.finished_at IS NOT NULL
      ORDER BY ws.finished_at DESC
      LIMIT $2
    `,
      [userId, limit]
    );

    const workouts: RecentWorkout[] = [];

    for (const session of sessionsResult.rows) {
      // Get exercises for this session
      const exercisesResult = await query<{
        exercise_id: string;
        exercise_name: string;
        total_sets: string;
        avg_reps: string;
        avg_weight: string;
      }>(
        `
        SELECT
          ws.exercise_id,
          MAX(ws.exercise_name) as exercise_name,
          COUNT(*) as total_sets,
          AVG(ws.actual_reps) as avg_reps,
          AVG(ws.actual_weight) as avg_weight
        FROM workout_sets ws
        WHERE ws.session_id = $1
          AND ws.actual_reps IS NOT NULL
        GROUP BY ws.exercise_id
        ORDER BY MIN(ws.set_index)
      `,
        [session.session_id]
      );

      workouts.push({
        templateName: session.template_name,
        splitType: session.split_type,
        completedAt: new Date(session.finished_at).toISOString().split("T")[0],
        exercises: exercisesResult.rows.map((ex) => ({
          exerciseId: ex.exercise_id,
          exerciseName: ex.exercise_name || "Unknown",
          sets: parseInt(ex.total_sets),
          avgReps: Math.round(parseFloat(ex.avg_reps)),
          avgWeight: ex.avg_weight ? Math.round(parseFloat(ex.avg_weight)) : undefined,
        })),
      });
    }

    return workouts;
  } catch (error) {
    console.error("[Fatigue] Error fetching recent workouts:", error);
    return [];
  }
};
