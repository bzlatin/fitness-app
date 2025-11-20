import { Router } from "express";
import { PoolClient } from "pg";
import { pool, query } from "../db";
import { WorkoutSession, WorkoutSet } from "../types/workouts";
import { generateId } from "../utils/id";

const router = Router();

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

const mapSet = (row: SetRow): WorkoutSet => ({
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
});

const mapSession = (row: SessionRow, setRows: SetRow[]): WorkoutSession => ({
  id: row.id,
  userId: row.user_id,
  templateId: row.template_id ?? undefined,
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
    `SELECT * FROM workout_sessions WHERE id = $1 AND user_id = $2 LIMIT 1`,
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
        setRows
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
