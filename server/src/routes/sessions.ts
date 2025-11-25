import { Router } from "express";
import { PoolClient } from "pg";
import path from "path";
import fs from "fs";
import { pool, query } from "../db";
import { WorkoutSession, WorkoutSet } from "../types/workouts";
import { generateId } from "../utils/id";
import { exercises as localExercises } from "../data/exercises";

const router = Router();

type LocalExercise = {
  id: string;
  name: string;
  force?: string | null;
  level?: string | null;
  mechanic?: string | null;
  equipment?: string | null;
  primaryMuscles?: string[];
  secondaryMuscles?: string[];
  instructions?: string[];
  category?: string;
  images?: string[];
};

const distPath = path.join(__dirname, "../data/dist/exercises.json");
const distExercises: LocalExercise[] = fs.existsSync(distPath)
  ? JSON.parse(fs.readFileSync(distPath, "utf-8"))
  : [];

const dedupeId = (id: string) => id.replace(/\s+/g, "_");
const formatExerciseId = (id: string) =>
  id
    .replace(/[_-]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
const normalizeExercise = (item: LocalExercise) => {
  const images = item.images ?? [];
  const imageUrl =
    images.length > 0 ? `/api/exercises/assets/${images[0]}` : undefined;

  return {
    id: item.id || dedupeId(item.name),
    name: item.name,
    gifUrl: imageUrl,
  };
};

const exerciseIndex = new Map<string, { name: string; gifUrl?: string }>();
(localExercises as unknown as LocalExercise[]).forEach((item) => {
  const normalized = normalizeExercise(item);
  exerciseIndex.set(normalized.id, { name: normalized.name, gifUrl: normalized.gifUrl });
});
distExercises.forEach((item) => {
  const normalized = normalizeExercise(item as unknown as LocalExercise);
  exerciseIndex.set(normalized.id, { name: normalized.name, gifUrl: normalized.gifUrl });
});

const describeExercise = (exerciseId: string) =>
  exerciseIndex.get(exerciseId) ?? { name: formatExerciseId(exerciseId) };

type TemplateExerciseRow = {
  id: string;
  template_id: string;
  exercise_id: string;
  default_sets: number;
  default_reps: number;
  default_weight: string | null;
};

type SessionRow = {
  id: string;
  user_id: string;
  template_id: string | null;
  template_name?: string | null;
  started_at: string;
  finished_at: string | null;
  created_at: string;
  updated_at: string;
};

type SetRow = {
  id: string;
  session_id: string;
  template_exercise_id: string | null;
  exercise_id: string;
  set_index: number;
  target_reps: number | null;
  target_weight: string | null;
  actual_reps: number | null;
  actual_weight: string | null;
  rpe: string | null;
};

const mapSet = (row: SetRow): WorkoutSet => {
  const exerciseMeta = describeExercise(row.exercise_id);
  return {
    id: row.id,
    sessionId: row.session_id,
    templateExerciseId: row.template_exercise_id ?? undefined,
    exerciseId: row.exercise_id,
    setIndex: row.set_index,
    targetReps: row.target_reps ?? undefined,
    targetWeight: row.target_weight === null ? undefined : Number(row.target_weight),
    actualReps: row.actual_reps ?? undefined,
    actualWeight: row.actual_weight === null ? undefined : Number(row.actual_weight),
    rpe: row.rpe === null ? undefined : Number(row.rpe),
    exerciseName: exerciseMeta.name,
    exerciseImageUrl: exerciseMeta.gifUrl,
  };
};

const mapSession = (
  row: SessionRow,
  setRows: SetRow[],
  meta?: { templateName?: string }
): WorkoutSession => ({
  id: row.id,
  userId: row.user_id,
  templateId: row.template_id ?? undefined,
  templateName: meta?.templateName ?? row.template_name ?? undefined,
  startedAt: row.started_at,
  finishedAt: row.finished_at ?? undefined,
  sets: setRows
    .filter((set) => set.session_id === row.id)
    .sort((a, b) => a.set_index - b.set_index)
    .map(mapSet),
});

const startOfDayUtc = (date: Date) => {
  const copy = new Date(date);
  copy.setUTCHours(0, 0, 0, 0);
  return copy;
};

const formatDateKey = (date: Date) => startOfDayUtc(date).toISOString().split("T")[0];

const startOfWeekUtc = (date: Date) => {
  const day = date.getUTCDay(); // 0 is Sunday
  const diff = day === 0 ? -6 : 1 - day; // start on Monday
  const start = new Date(date);
  start.setUTCDate(date.getUTCDate() + diff);
  start.setUTCHours(0, 0, 0, 0);
  return start;
};

const computeSetVolume = (set: WorkoutSet) => {
  const weight = set.actualWeight ?? set.targetWeight ?? 0;
  const reps = set.actualReps ?? set.targetReps ?? 0;
  return weight * reps;
};

const computeSessionVolume = (sets: WorkoutSet[]) =>
  sets.reduce((total, current) => total + computeSetVolume(current), 0);

const computeStreak = (dates: string[], today: Date) => {
  const dateSet = new Set(dates);
  let streak = 0;
  let cursor = startOfDayUtc(today);
  while (dateSet.has(formatDateKey(cursor))) {
    streak += 1;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return streak;
};

type SessionSummary = {
  id: string;
  startedAt: string;
  finishedAt?: string;
  templateName?: string;
  totalVolumeLbs: number;
  estimatedCalories: number;
  exercises: {
    exerciseId: string;
    name: string;
    sets: number;
    volumeLbs: number;
  }[];
};

type HistoryDay = {
  date: string;
  sessions: SessionSummary[];
  totalVolumeLbs: number;
  estimatedCalories: number;
};
type RawHistoryDay = HistoryDay & { dayOrdinal: number };

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

const fetchSessionById = async (sessionId: string, userId: string) => {
    const sessionResult = await query<SessionRow>(
      `
      SELECT s.*, COALESCE(s.template_name, t.name) as template_name
      FROM workout_sessions s
      LEFT JOIN workout_templates t ON t.id = s.template_id
      WHERE s.id = $1 AND s.user_id = $2
      LIMIT 1
    `,
    [sessionId, userId]
  );
  if (!sessionResult.rowCount) return null;

  const setRows = await query<SetRow>(
    `SELECT * FROM workout_sets WHERE session_id = $1 ORDER BY set_index ASC`,
    [sessionId]
  );
  return mapSession(sessionResult.rows[0], setRows.rows);
};

router.post("/from-template/:templateId", async (req, res) => {
  const userId = res.locals.userId;
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const templateResult = await query<{ id: string; name: string }>(
      `SELECT id, name FROM workout_templates WHERE id = $1 AND user_id = $2`,
      [req.params.templateId, userId]
    );
    const template = templateResult.rows[0];
    if (!template) {
      return res.status(404).json({ error: "Template not found" });
    }

    const templateExercises = await query<TemplateExerciseRow>(
      `
        SELECT id, template_id, exercise_id, default_sets, default_reps, default_weight
        FROM workout_template_exercises
        WHERE template_id = $1
        ORDER BY order_index ASC
      `,
      [template.id]
    );
    if (!templateExercises.rowCount) {
      return res.status(400).json({ error: "Template has no exercises" });
    }

      const session = await withTransaction(async (client) => {
        const sessionId = generateId();
        const now = new Date().toISOString();
        let setIndex = 0;
        await client.query(
          `
          INSERT INTO workout_sessions (id, user_id, template_id, template_name, started_at, created_at, updated_at)
          VALUES ($1, $2, $3, $4, $5, $5, $5)
        `,
          [sessionId, userId, template.id, template.name, now]
        );

      for (const templateExercise of templateExercises.rows) {
        for (let index = 0; index < templateExercise.default_sets; index += 1) {
          await client.query(
            `
              INSERT INTO workout_sets (id, session_id, template_exercise_id, exercise_id, set_index, target_reps, target_weight)
              VALUES ($1, $2, $3, $4, $5, $6, $7)
            `,
            [
              generateId(),
              sessionId,
              templateExercise.id,
              templateExercise.exercise_id,
              setIndex,
              templateExercise.default_reps,
              templateExercise.default_weight,
            ]
          );
          setIndex += 1;
        }
      }

      const setRows = (
        await client.query<SetRow>(
          `SELECT * FROM workout_sets WHERE session_id = $1 ORDER BY set_index ASC`,
          [sessionId]
        )
      ).rows;

      return mapSession(
        {
          id: sessionId,
          user_id: userId,
          template_id: template.id,
          started_at: now,
          finished_at: null,
          created_at: now,
          updated_at: now,
        },
        setRows,
        { templateName: template.name }
      );
    });

    return res.status(201).json(session);
  } catch (err) {
    console.error("Failed to start session", err);
    return res.status(500).json({ error: "Failed to start session" });
  }
});

router.get("/history/range", async (req, res) => {
  const userId = res.locals.userId;
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const startParam = req.query.start as string | undefined;
  const endParam = req.query.end as string | undefined;
  const today = new Date();
  const defaultStart = new Date(today);
  defaultStart.setUTCFullYear(defaultStart.getUTCFullYear() - 2);
  defaultStart.setUTCMonth(0, 1);
  defaultStart.setUTCHours(0, 0, 0, 0);
  const defaultEnd = new Date(today);
  defaultEnd.setUTCFullYear(defaultEnd.getUTCFullYear() + 1);
  defaultEnd.setUTCMonth(11, 31);
  defaultEnd.setUTCHours(23, 59, 59, 999);

  const rangeStart = startParam ? new Date(startParam) : defaultStart;
  const rangeEnd = endParam ? new Date(endParam) : defaultEnd;

  if (Number.isNaN(rangeStart.getTime()) || Number.isNaN(rangeEnd.getTime())) {
    return res.status(400).json({ error: "Invalid date range" });
  }

  try {
    const sessionRows = await query<SessionRow>(
      `
        SELECT s.*, COALESCE(s.template_name, t.name) as template_name
        FROM workout_sessions s
        LEFT JOIN workout_templates t ON t.id = s.template_id
        WHERE s.user_id = $1 AND s.started_at >= $2 AND s.started_at < $3
        ORDER BY s.started_at DESC
      `,
      [userId, rangeStart.toISOString(), rangeEnd.toISOString()]
    );

    const sessionIds = sessionRows.rows.map((row) => row.id);
    const setRows =
      sessionIds.length === 0
        ? []
        : (
            await query<SetRow>(
              `SELECT * FROM workout_sets WHERE session_id = ANY($1::text[])`,
              [sessionIds]
            )
          ).rows;

    const summaries: SessionSummary[] = sessionRows.rows.map((row) => {
      const sets = setRows.filter((set) => set.session_id === row.id).map(mapSet);
      const totalVolume = computeSessionVolume(sets);
      const exerciseMap = new Map<
        string,
        { name: string; sets: number; volumeLbs: number }
      >();
      sets.forEach((set) => {
        const existing = exerciseMap.get(set.exerciseId);
        const volume = computeSetVolume(set);
        if (existing) {
          exerciseMap.set(set.exerciseId, {
            ...existing,
            sets: existing.sets + 1,
            volumeLbs: existing.volumeLbs + volume,
          });
        } else {
          exerciseMap.set(set.exerciseId, {
            name: set.exerciseName ?? set.exerciseId,
            sets: 1,
            volumeLbs: volume,
          });
        }
      });

      return {
        id: row.id,
        startedAt: row.started_at,
        finishedAt: row.finished_at ?? undefined,
        templateName: row.template_name ?? undefined,
        totalVolumeLbs: totalVolume,
        estimatedCalories: Math.round(totalVolume * 0.03),
        exercises: Array.from(exerciseMap.entries()).map(
          ([exerciseId, details]) => ({
            exerciseId,
            name: details.name,
            sets: details.sets,
            volumeLbs: details.volumeLbs,
          })
        ),
      };
    });

    const dayMap = new Map<string, HistoryDay>();
    summaries.forEach((summary) => {
      const key = formatDateKey(new Date(summary.startedAt));
      const existing = dayMap.get(key);
      if (!existing) {
        dayMap.set(key, {
          date: key,
          sessions: [summary],
          totalVolumeLbs: summary.totalVolumeLbs,
          estimatedCalories: summary.estimatedCalories,
        });
      } else {
        dayMap.set(key, {
          ...existing,
          sessions: [...existing.sessions, summary],
          totalVolumeLbs: existing.totalVolumeLbs + summary.totalVolumeLbs,
          estimatedCalories: existing.estimatedCalories + summary.estimatedCalories,
        });
      }
    });

    const days = Array.from(dayMap.values()).sort((a, b) => (a.date < b.date ? 1 : -1));

    const streakRows = await query<{ started_at: string }>(
      `
        SELECT started_at
        FROM workout_sessions
        WHERE user_id = $1
        ORDER BY started_at DESC
      `,
      [userId]
    );

    const allDates = streakRows.rows.map((row) => formatDateKey(new Date(row.started_at)));
    const uniqueDates = Array.from(new Set(allDates));

    const currentWeekStart = startOfWeekUtc(today);
    const currentWeekEnd = new Date(currentWeekStart);
    currentWeekEnd.setUTCDate(currentWeekEnd.getUTCDate() + 7);

    // Count unique workout DAYS in the current week, not total sessions
    const uniqueWorkoutDaysThisWeek = new Set(
      summaries
        .filter((summary) => {
          const started = new Date(summary.startedAt);
          return started >= currentWeekStart && started < currentWeekEnd;
        })
        .map((summary) => formatDateKey(new Date(summary.startedAt)))
    ).size;

    const weeklyCompleted = uniqueWorkoutDaysThisWeek;

    const userResult = await query<{ weekly_goal: number }>(
      `SELECT weekly_goal FROM users WHERE id = $1 LIMIT 1`,
      [userId]
    );
    const weeklyGoal = userResult.rows[0]?.weekly_goal ?? 4;

    const stats = {
      totalWorkouts: summaries.length,
      weeklyGoal,
      weeklyCompleted,
      currentStreak: computeStreak(uniqueDates, today),
    };

    return res.json({ days, stats });
  } catch (err) {
    console.error("Failed to fetch history", err);
    return res.status(500).json({ error: "Failed to fetch history" });
  }
});

router.get("/:id", async (req, res) => {
  const userId = res.locals.userId;
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const session = await fetchSessionById(req.params.id, userId);
    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }
    return res.json(session);
  } catch (err) {
    console.error("Failed to fetch session", err);
    return res.status(500).json({ error: "Failed to fetch session" });
  }
});

router.patch("/:id", async (req, res) => {
  const userId = res.locals.userId;
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { sets, startedAt, finishedAt } = req.body as Partial<WorkoutSession> & {
    startedAt?: string;
  };

  try {
    const sessionExists = await query(
      `SELECT 1 FROM workout_sessions WHERE id = $1 AND user_id = $2`,
      [req.params.id, userId]
    );
    if (!sessionExists.rowCount) {
      return res.status(404).json({ error: "Session not found" });
    }

    await withTransaction(async (client) => {
      if (sets) {
        await client.query(`DELETE FROM workout_sets WHERE session_id = $1`, [req.params.id]);
        for (const set of sets) {
          await client.query(
            `
              INSERT INTO workout_sets (id, session_id, template_exercise_id, exercise_id, set_index, target_reps, target_weight, actual_reps, actual_weight, rpe)
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            `,
            [
              set.id ?? generateId(),
              req.params.id,
              set.templateExerciseId ?? null,
              set.exerciseId,
              set.setIndex,
              set.targetReps ?? null,
              set.targetWeight ?? null,
              set.actualReps ?? null,
              set.actualWeight ?? null,
              set.rpe ?? null,
            ]
          );
        }
      }

      if (startedAt !== undefined || finishedAt !== undefined) {
        await client.query(
          `
            UPDATE workout_sessions
            SET
              started_at = COALESCE($1, started_at),
              finished_at = COALESCE($2, finished_at),
              updated_at = NOW()
            WHERE id = $3
          `,
          [startedAt ?? null, finishedAt ?? null, req.params.id]
        );
      } else {
        await client.query(`UPDATE workout_sessions SET updated_at = NOW() WHERE id = $1`, [
          req.params.id,
        ]);
      }
    });

    const session = await fetchSessionById(req.params.id, userId);
    return res.json(session);
  } catch (err) {
    console.error("Failed to update session", err);
    return res.status(500).json({ error: "Failed to update session" });
  }
});

router.post("/manual", async (req, res) => {
  const userId = res.locals.userId;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const {
    startedAt,
    finishedAt,
    templateName,
    sets,
  }: {
    startedAt?: string;
    finishedAt?: string;
    templateName?: string;
    sets?: Partial<WorkoutSet>[];
  } = req.body ?? {};

  if (!sets || sets.length === 0) {
    return res.status(400).json({ error: "At least one set is required" });
  }

  const sessionId = generateId();
  const safeStart = startedAt ? new Date(startedAt) : new Date();
  const safeFinish = finishedAt ? new Date(finishedAt) : undefined;

  if (Number.isNaN(safeStart.getTime())) {
    return res.status(400).json({ error: "Invalid start date" });
  }

  try {
    const session = await withTransaction(async (client) => {
      await client.query(
        `
          INSERT INTO workout_sessions (id, user_id, template_id, template_name, started_at, finished_at, created_at, updated_at)
          VALUES ($1, $2, NULL, $3, $4, $5, NOW(), NOW())
        `,
        [
          sessionId,
          userId,
          templateName ?? null,
          safeStart.toISOString(),
          safeFinish?.toISOString() ?? null,
        ]
      );

      for (const [index, set] of sets.entries()) {
        if (!set.exerciseId) continue;
        await client.query(
          `
            INSERT INTO workout_sets (id, session_id, template_exercise_id, exercise_id, set_index, target_reps, target_weight, actual_reps, actual_weight, rpe)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          `,
          [
            set.id ?? generateId(),
            sessionId,
            set.templateExerciseId ?? null,
            set.exerciseId,
            set.setIndex ?? index,
            set.targetReps ?? null,
            set.targetWeight ?? null,
            set.actualReps ?? null,
            set.actualWeight ?? null,
            set.rpe ?? null,
          ]
        );
      }

      const setRows = (
        await client.query<SetRow>(`SELECT * FROM workout_sets WHERE session_id = $1`, [
          sessionId,
        ])
      ).rows;

      return mapSession(
        {
          id: sessionId,
          user_id: userId,
          template_id: null,
          template_name: templateName ?? null,
          started_at: safeStart.toISOString(),
          finished_at: safeFinish?.toISOString() ?? null,
          created_at: safeStart.toISOString(),
          updated_at: safeFinish?.toISOString() ?? safeStart.toISOString(),
        },
        setRows,
        { templateName }
      );
    });

    return res.status(201).json(session);
  } catch (err) {
    console.error("Failed to create manual session", err);
    return res.status(500).json({ error: "Failed to create session" });
  }
});

router.post("/:id/duplicate", async (req, res) => {
  const userId = res.locals.userId;
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const session = await fetchSessionById(req.params.id, userId);
    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }

    const newSessionId = generateId();
    const nowIso = new Date().toISOString();

    await withTransaction(async (client) => {
      await client.query(
        `
          INSERT INTO workout_sessions (id, user_id, template_id, template_name, started_at, finished_at, created_at, updated_at)
          VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
        `,
        [
          newSessionId,
          userId,
          session.templateId ?? null,
          session.templateName ?? null,
          nowIso,
          session.finishedAt ?? null,
        ]
      );

      for (const set of session.sets) {
        await client.query(
          `
            INSERT INTO workout_sets (id, session_id, template_exercise_id, exercise_id, set_index, target_reps, target_weight, actual_reps, actual_weight, rpe)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          `,
          [
            generateId(),
            newSessionId,
            set.templateExerciseId ?? null,
            set.exerciseId,
            set.setIndex,
            set.targetReps ?? null,
            set.targetWeight ?? null,
            set.actualReps ?? null,
            set.actualWeight ?? null,
            set.rpe ?? null,
          ]
        );
      }
    });

    const newSession = await fetchSessionById(newSessionId, userId);
    return res.status(201).json(newSession);
  } catch (err) {
    console.error("Failed to duplicate session", err);
    return res.status(500).json({ error: "Failed to duplicate session" });
  }
});

router.delete("/:id", async (req, res) => {
  const userId = res.locals.userId;
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const result = await query(
      `DELETE FROM workout_sessions WHERE id = $1 AND user_id = $2`,
      [req.params.id, userId]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Session not found" });
    }
    return res.status(204).end();
  } catch (err) {
    console.error("Failed to delete session", err);
    return res.status(500).json({ error: "Failed to delete session" });
  }
});

export default router;
