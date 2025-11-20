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
const largeExercises: LocalExercise[] = fs.existsSync(distPath)
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
(largeExercises.length > 0 ? largeExercises : localExercises).forEach((item) => {
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
      SELECT s.*, t.name as template_name
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
          INSERT INTO workout_sessions (id, user_id, template_id, started_at, created_at, updated_at)
          VALUES ($1, $2, $3, $4, $4, $4)
        `,
        [sessionId, userId, template.id, now]
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

  const { sets, finishedAt } = req.body as Partial<WorkoutSession>;

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

      if (finishedAt !== undefined) {
        await client.query(
          `UPDATE workout_sessions SET finished_at = $1, updated_at = NOW() WHERE id = $2`,
          [finishedAt, req.params.id]
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

export default router;
