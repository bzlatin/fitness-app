import { Router } from "express";
import { PoolClient } from "pg";
import { getFatigueScores, getTrainingRecommendations } from "../services/fatigue";
import {
  getProgressionSuggestions,
  applyProgressionSuggestions,
} from "../services/progression";
import {
  getAdvancedAnalytics,
  getWeeklyVolumeByMuscleGroup,
  getMuscleGroupSummaries,
  getPushPullBalance,
  getVolumePRs,
  getFrequencyHeatmap,
} from "../services/muscleAnalytics";
import { getRecapSlice } from "../services/recap";
import { requireProPlan } from "../middleware/planLimits";
import { pool } from "../db";
import { generateId } from "../utils/id";

const router = Router();

type AppleHealthSetPayload = {
  exerciseId?: string;
  actualReps?: number;
  actualWeight?: number;
  setIndex?: number;
};

type AppleHealthSessionPayload = {
  externalId?: string;
  workoutType?: string;
  templateName?: string;
  startedAt: string;
  finishedAt?: string;
  durationSeconds?: number;
  totalEnergyBurned?: number;
  avgHeartRate?: number;
  maxHeartRate?: number;
  sourceName?: string;
  notes?: string;
  sets?: AppleHealthSetPayload[];
};

type AppleHealthPermissions = {
  workouts?: boolean;
  activeEnergy?: boolean;
  heartRate?: boolean;
};

const withTransaction = async <T>(fn: (client: PoolClient) => Promise<T>) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
};

const normalizeDurationSeconds = (
  startedAt: Date,
  finishedAt?: Date | null,
  provided?: number
) => {
  if (Number.isFinite(provided)) return provided;
  if (!finishedAt) return undefined;
  return Math.max(0, Math.round((finishedAt.getTime() - startedAt.getTime()) / 1000));
};

const formatAppleWorkoutName = (raw?: string | null) => {
  if (!raw) return undefined;
  const pretty = raw.replace(/[_-]+/g, " ").trim();
  return pretty ? pretty.replace(/\b\w/g, (c) => c.toUpperCase()) : undefined;
};

const findDuplicateAppleSession = async (
  client: PoolClient,
  userId: string,
  startedAt: Date,
  durationSeconds?: number,
  externalId?: string | null
) => {
  const windowStart = new Date(startedAt.getTime() - 5 * 60 * 1000);
  const windowEnd = new Date(startedAt.getTime() + 5 * 60 * 1000);
  const candidates = await client.query<{
    id: string;
    started_at: string;
    finished_at: string | null;
    duration_seconds: number | null;
    external_id: string | null;
  }>(
    `
      SELECT id, started_at, finished_at, duration_seconds, external_id
      FROM workout_sessions
      WHERE user_id = $1
        AND (
          ($2::text IS NOT NULL AND external_id = $2)
          OR (started_at BETWEEN $3 AND $4)
        )
    `,
    [userId, externalId ?? null, windowStart.toISOString(), windowEnd.toISOString()]
  );

  for (const candidate of candidates.rows) {
    if (externalId && candidate.external_id === externalId) {
      return candidate.id;
    }
    if (!durationSeconds) continue;
    const candidateDuration =
      candidate.duration_seconds ??
      (candidate.finished_at
        ? Math.max(
            0,
            Math.round(
              (new Date(candidate.finished_at).getTime() -
                new Date(candidate.started_at).getTime()) /
                1000
            )
          )
        : undefined);
    if (candidateDuration === undefined) continue;
    const startDelta = Math.abs(new Date(candidate.started_at).getTime() - startedAt.getTime());
    const durationDelta = Math.abs(candidateDuration - durationSeconds);
    if (startDelta <= 5 * 60 * 1000 && durationDelta <= 120) {
      return candidate.id;
    }
  }

  return null;
};

router.post("/apple-health/import", async (req, res) => {
  const userId = res.locals.userId;
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const {
    sessions,
    permissions,
    lastSyncAt,
  }: {
    sessions?: AppleHealthSessionPayload[];
    permissions?: AppleHealthPermissions;
    lastSyncAt?: string;
  } = req.body ?? {};

  const parsedSessions = Array.isArray(sessions) ? sessions : [];

  const normalizedSessions = parsedSessions
    .map((session) => {
      const startedAt = new Date(session.startedAt);
      const finishedAt = session.finishedAt ? new Date(session.finishedAt) : null;
      if (Number.isNaN(startedAt.getTime())) {
        return null;
      }

      const durationSeconds = normalizeDurationSeconds(
        startedAt,
        finishedAt,
        session.durationSeconds
      );

      return {
        externalId: session.externalId,
        workoutType: session.workoutType,
        templateName:
          session.templateName ?? formatAppleWorkoutName(session.workoutType) ?? "Imported workout",
        startedAt,
        finishedAt,
        durationSeconds,
        totalEnergyBurned: Number.isFinite(session.totalEnergyBurned)
          ? Number(session.totalEnergyBurned)
          : undefined,
        avgHeartRate: Number.isFinite(session.avgHeartRate)
          ? Number(session.avgHeartRate)
          : undefined,
        maxHeartRate: Number.isFinite(session.maxHeartRate)
          ? Number(session.maxHeartRate)
          : undefined,
        sourceName: session.sourceName,
        notes: session.notes,
        sets:
          Array.isArray(session.sets) && session.sets.length
            ? session.sets.map((set, idx) => ({
                exerciseId: set.exerciseId ?? "imported_strength_work",
                actualReps: Number.isFinite(set.actualReps) ? Number(set.actualReps) : null,
                actualWeight: Number.isFinite(set.actualWeight)
                  ? Number(set.actualWeight)
                  : null,
                setIndex: Number.isFinite(set.setIndex) ? Number(set.setIndex) : idx,
              }))
            : [],
      };
    })
    .filter(Boolean) as Array<{
    externalId?: string;
    workoutType?: string;
    templateName: string;
    startedAt: Date;
    finishedAt?: Date | null;
    durationSeconds?: number;
    totalEnergyBurned?: number;
    avgHeartRate?: number;
    maxHeartRate?: number;
    sourceName?: string;
    notes?: string;
    sets: Array<{
      exerciseId: string;
      actualReps: number | null;
      actualWeight: number | null;
      setIndex: number;
    }>;
  }>;

  if (!normalizedSessions.length && !permissions) {
    return res.status(400).json({ error: "No valid sessions to import" });
  }

  const syncTimestamp =
    lastSyncAt && !Number.isNaN(new Date(lastSyncAt).getTime())
      ? new Date(lastSyncAt)
      : new Date();

  try {
    const { importedCount, skippedCount } = await withTransaction(async (client) => {
      let imported = 0;
      let skipped = 0;

      for (const session of normalizedSessions) {
        const duplicateId = await findDuplicateAppleSession(
          client,
          userId,
          session.startedAt,
          session.durationSeconds,
          session.externalId ?? null
        );
        if (duplicateId) {
          skipped += 1;
          continue;
        }

        const sessionId = generateId();
        await client.query(
          `
            INSERT INTO workout_sessions (
              id, user_id, template_id, template_name, started_at, finished_at,
              duration_seconds, source, external_id, import_metadata,
              total_energy_burned, avg_heart_rate, max_heart_rate,
              created_at, updated_at
            )
            VALUES ($1, $2, NULL, $3, $4, $5, $6, 'apple_health', $7, $8, $9, $10, $11, NOW(), NOW())
          `,
          [
            sessionId,
            userId,
            session.templateName,
            session.startedAt.toISOString(),
            session.finishedAt ? session.finishedAt.toISOString() : null,
            session.durationSeconds ?? null,
            session.externalId ?? null,
            {
              workoutType: session.workoutType,
              sourceName: session.sourceName,
              notes: session.notes,
            },
            session.totalEnergyBurned ?? null,
            session.avgHeartRate ?? null,
            session.maxHeartRate ?? null,
          ]
        );

        for (const set of session.sets) {
          await client.query(
            `
              INSERT INTO workout_sets (
                id, session_id, template_exercise_id, exercise_id, set_index,
                target_reps, target_weight, actual_reps, actual_weight, rpe
              )
              VALUES ($1, $2, NULL, $3, $4, NULL, NULL, $5, $6, NULL)
            `,
            [
              generateId(),
              sessionId,
              set.exerciseId,
              set.setIndex,
              set.actualReps ?? null,
              set.actualWeight ?? null,
            ]
          );
        }

        imported += 1;
      }

      if (permissions || imported > 0) {
        const permissionsJson =
          permissions && Object.keys(permissions).length > 0 ? permissions : null;
        await client.query(
          `
            UPDATE users
            SET apple_health_enabled = $1,
                apple_health_permissions = COALESCE($2, apple_health_permissions),
                apple_health_last_sync_at = $3,
                updated_at = NOW()
            WHERE id = $4
          `,
          [
            Boolean(
              imported > 0 ||
                permissions?.workouts ||
                permissions?.activeEnergy ||
                permissions?.heartRate
            ),
            permissionsJson,
            syncTimestamp.toISOString(),
            userId,
          ]
        );
      }

      return { importedCount: imported, skippedCount: skipped };
    });

    return res.json({ importedCount, skippedCount });
  } catch (err) {
    console.error("[Analytics] Failed to import Apple Health sessions", err);
    return res.status(500).json({ error: "Failed to import Apple Health sessions" });
  }
});

router.delete("/apple-health/imports", async (_req, res) => {
  const userId = res.locals.userId;
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const result = await withTransaction(async (client) => {
      const deleted = await client.query<{ id: string }>(
        `
          DELETE FROM workout_sessions
          WHERE user_id = $1 AND source = 'apple_health'
          RETURNING id
        `,
        [userId]
      );

      await client.query(
        `
          UPDATE users
          SET apple_health_enabled = false,
              apple_health_permissions = COALESCE(apple_health_permissions, '{}'::jsonb) || '{"workouts": false, "activeEnergy": false, "heartRate": false}'::jsonb,
              apple_health_last_sync_at = NULL,
              updated_at = NOW()
          WHERE id = $1
        `,
        [userId]
      );

      return deleted.rowCount;
    });

    return res.json({ deletedCount: result });
  } catch (err) {
    console.error("[Analytics] Failed to clear Apple Health imports", err);
    return res.status(500).json({ error: "Failed to clear Apple Health imports" });
  }
});

router.get("/fatigue", async (_req, res) => {
  const userId = res.locals.userId;
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const data = await getFatigueScores(userId);
    return res.json({ data });
  } catch (err) {
    console.error("[Analytics] Failed to fetch fatigue scores", err);
    return res.status(500).json({ error: "Failed to fetch fatigue scores" });
  }
});

router.get("/recommendations", requireProPlan, async (_req, res) => {
  const userId = res.locals.userId;
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const fatigue = await getFatigueScores(userId);
    const data = await getTrainingRecommendations(userId, fatigue);
    return res.json({ data });
  } catch (err) {
    console.error("[Analytics] Failed to fetch training recommendations", err);
    return res.status(500).json({ error: "Failed to fetch recommendations" });
  }
});

router.get("/progression/:templateId", requireProPlan, async (req, res) => {
  const userId = res.locals.userId;
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { templateId } = req.params;
  if (!templateId) {
    return res.status(400).json({ error: "Template ID is required" });
  }

  try {
    const data = await getProgressionSuggestions(userId, templateId);
    return res.json({ data });
  } catch (err) {
    console.error("[Analytics] Failed to fetch progression suggestions", err);
    return res.status(500).json({ error: "Failed to fetch progression suggestions" });
  }
});

router.post("/progression/:templateId/apply", requireProPlan, async (req, res) => {
  const userId = res.locals.userId;
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { templateId } = req.params;
  if (!templateId) {
    return res.status(400).json({ error: "Template ID is required" });
  }

  const { exerciseIds } = req.body as { exerciseIds?: string[] };

  try {
    const result = await applyProgressionSuggestions(userId, templateId, exerciseIds);
    return res.json({ data: result });
  } catch (err) {
    console.error("[Analytics] Failed to apply progression suggestions", err);
    return res.status(500).json({ error: "Failed to apply progression suggestions" });
  }
});

// Advanced Muscle Group Analytics (Pro feature)
router.get("/muscle-analytics", requireProPlan, async (req, res) => {
  const userId = res.locals.userId;
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const weeks = parseInt(req.query.weeks as string) || 12;

  try {
    const data = await getAdvancedAnalytics(userId, weeks);
    return res.json({ data });
  } catch (err) {
    console.error("[Analytics] Failed to fetch muscle analytics", err);
    return res.status(500).json({ error: "Failed to fetch muscle analytics" });
  }
});

router.get("/weekly-volume", requireProPlan, async (req, res) => {
  const userId = res.locals.userId;
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const weeks = parseInt(req.query.weeks as string) || 12;

  try {
    const data = await getWeeklyVolumeByMuscleGroup(userId, weeks);
    return res.json({ data });
  } catch (err) {
    console.error("[Analytics] Failed to fetch weekly volume", err);
    return res.status(500).json({ error: "Failed to fetch weekly volume" });
  }
});

router.get("/muscle-summaries", requireProPlan, async (req, res) => {
  const userId = res.locals.userId;
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const weeks = parseInt(req.query.weeks as string) || 12;

  try {
    const data = await getMuscleGroupSummaries(userId, weeks);
    return res.json({ data });
  } catch (err) {
    console.error("[Analytics] Failed to fetch muscle summaries", err);
    return res.status(500).json({ error: "Failed to fetch muscle summaries" });
  }
});

router.get("/push-pull-balance", requireProPlan, async (req, res) => {
  const userId = res.locals.userId;
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const weeks = parseInt(req.query.weeks as string) || 12;

  try {
    const data = await getPushPullBalance(userId, weeks);
    return res.json({ data });
  } catch (err) {
    console.error("[Analytics] Failed to fetch push/pull balance", err);
    return res.status(500).json({ error: "Failed to fetch push/pull balance" });
  }
});

router.get("/volume-prs", requireProPlan, async (req, res) => {
  const userId = res.locals.userId;
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const weeks = parseInt(req.query.weeks as string) || 52;

  try {
    const data = await getVolumePRs(userId, weeks);
    return res.json({ data });
  } catch (err) {
    console.error("[Analytics] Failed to fetch volume PRs", err);
    return res.status(500).json({ error: "Failed to fetch volume PRs" });
  }
});

router.get("/frequency-heatmap", requireProPlan, async (req, res) => {
  const userId = res.locals.userId;
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const weeks = parseInt(req.query.weeks as string) || 12;

  try {
    const data = await getFrequencyHeatmap(userId, weeks);
    return res.json({ data });
  } catch (err) {
    console.error("[Analytics] Failed to fetch frequency heatmap", err);
    return res.status(500).json({ error: "Failed to fetch frequency heatmap" });
  }
});

router.get("/recap", requireProPlan, async (_req, res) => {
  const userId = res.locals.userId;
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const data = await getRecapSlice(userId);
    return res.json({ data });
  } catch (err) {
    console.error("[Analytics] Failed to fetch recap slice", err);
    return res.status(500).json({ error: "Failed to fetch recap" });
  }
});

export default router;
