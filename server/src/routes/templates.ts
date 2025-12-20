import { Router } from "express";
import { PoolClient } from "pg";
import { createIdGenerator, generateId } from "../utils/id";
import { WorkoutTemplate, WorkoutTemplateExercise } from "../types/workouts";
import { pool, query } from "../db";
import { checkTemplateLimit } from "../middleware/planLimits";
import { ExerciseMeta, fetchExerciseMetaByIds } from "../utils/exerciseCatalog";

const router = Router();

type TemplateRow = {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  split_type: string | null;
  is_favorite: boolean;
  sharing_disabled: boolean;
  created_at: string;
  updated_at: string;
};

type ExerciseRow = {
  id: string;
  template_id: string;
  order_index: number;
  exercise_id: string;
  default_sets: number;
  default_reps: number;
  default_reps_min: number | null;
  default_reps_max: number | null;
  default_rest_seconds: number | null;
  default_weight: string | null;
  default_incline: string | null;
  default_distance: string | null;
  default_duration_minutes: string | null;
  notes: string | null;
};

const formatExerciseId = (id: string) =>
  id
    .replace(/[_-]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();

const numberOrUndefined = (value: string | number | null) =>
  value === null || value === undefined ? undefined : Number(value);

const normalizeReps = (
  exercise: {
    defaultReps?: number;
    defaultRepsMin?: number | null;
    defaultRepsMax?: number | null;
  },
  exerciseIndex: number
):
  | {
      ok: true;
      defaultReps: number;
      defaultRepsMin: number | null;
      defaultRepsMax: number | null;
    }
  | { ok: false; message: string } => {
  const repValue =
    exercise.defaultReps === undefined || exercise.defaultReps === null
      ? null
      : Number(exercise.defaultReps);
  const repMin =
    exercise.defaultRepsMin === undefined || exercise.defaultRepsMin === null
      ? null
      : Number(exercise.defaultRepsMin);
  const repMax =
    exercise.defaultRepsMax === undefined || exercise.defaultRepsMax === null
      ? null
      : Number(exercise.defaultRepsMax);

  const baseReps = repValue ?? repMin ?? repMax;
  if (baseReps === null || Number.isNaN(baseReps) || baseReps < 1) {
    return {
      ok: false,
      message: `Exercise ${exerciseIndex + 1}: defaultReps must be at least 1`,
    };
  }

  if (repMin !== null && (Number.isNaN(repMin) || repMin < 1)) {
    return {
      ok: false,
      message: `Exercise ${exerciseIndex + 1}: minimum reps must be at least 1`,
    };
  }
  if (repMax !== null && (Number.isNaN(repMax) || repMax < 1)) {
    return {
      ok: false,
      message: `Exercise ${exerciseIndex + 1}: maximum reps must be at least 1`,
    };
  }
  if (repMin !== null && repMax !== null && repMax < repMin) {
    return {
      ok: false,
      message: `Exercise ${exerciseIndex + 1}: maximum reps must be greater than or equal to minimum reps`,
    };
  }

  return {
    ok: true,
    defaultReps: baseReps,
    defaultRepsMin: repMin,
    defaultRepsMax: repMax,
  };
};

const mapExercise = (
  row: ExerciseRow,
  metaMap: Map<string, ExerciseMeta>
): WorkoutTemplateExercise => {
  const meta = metaMap.get(row.exercise_id);
  return {
    id: row.id,
    exerciseId: row.exercise_id,
    orderIndex: row.order_index,
    exerciseName: meta?.name ?? formatExerciseId(row.exercise_id),
    primaryMuscleGroup: meta?.primaryMuscleGroup ?? "other",
    exerciseImageUrl: meta?.gifUrl,
    equipment: meta?.equipment ?? "other",
    defaultSets: row.default_sets,
    defaultReps: row.default_reps_min ?? row.default_reps,
    defaultRepsMin: numberOrUndefined(row.default_reps_min),
    defaultRepsMax: numberOrUndefined(row.default_reps_max),
    defaultRestSeconds: row.default_rest_seconds ?? undefined,
    defaultWeight: numberOrUndefined(row.default_weight),
    defaultIncline: numberOrUndefined(row.default_incline),
    defaultDistance: numberOrUndefined(row.default_distance),
    defaultDurationMinutes: numberOrUndefined(row.default_duration_minutes),
    notes: row.notes ?? undefined,
  };
};

const mapTemplate = (
  row: TemplateRow,
  exerciseRows: ExerciseRow[],
  metaMap: Map<string, ExerciseMeta>
): WorkoutTemplate => ({
  id: row.id,
  userId: row.user_id,
  name: row.name,
  description: row.description ?? undefined,
  splitType: (row.split_type as WorkoutTemplate["splitType"]) ?? undefined,
  isFavorite: row.is_favorite,
  sharingDisabled: row.sharing_disabled,
  exercises: exerciseRows
    .filter((ex) => ex.template_id === row.id)
    .sort((a, b) => a.order_index - b.order_index)
    .map((ex) => mapExercise(ex, metaMap)),
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const SHARE_CODE_REGEX = /^[0-9a-z]{8}$/;
const generateShareCode = createIdGenerator("0123456789abcdefghijklmnopqrstuvwxyz", 8);
const PUBLIC_APP_URL = (process.env.PUBLIC_APP_URL || "https://push-pull.app").replace(
  /\/+$/,
  ""
);

const buildShareUrls = (shareCode: string) => ({
  webUrl: `${PUBLIC_APP_URL}/workout/${shareCode}`,
  deepLinkUrl: `push-pull://workout/share/${shareCode}`,
});

const buildTemplates = async (templateRows: TemplateRow[], userId?: string) => {
  if (templateRows.length === 0) return [];
  const templateIds = templateRows.map((row) => row.id);
  const exerciseRowsResult = await query<ExerciseRow>(
    `SELECT *
     FROM workout_template_exercises
     WHERE template_id = ANY($1::text[])
     ORDER BY order_index ASC`,
    [templateIds]
  );
  const exerciseIds = Array.from(
    new Set(exerciseRowsResult.rows.map((row) => row.exercise_id))
  );
  const metaMap = await fetchExerciseMetaByIds(
    exerciseIds,
    userId ? { userId } : undefined
  );

  return templateRows.map((row) => mapTemplate(row, exerciseRowsResult.rows, metaMap));
};

const fetchTemplates = async (userId: string): Promise<WorkoutTemplate[]> => {
  const templateRowsResult = await query<TemplateRow>(
    `SELECT *
     FROM workout_templates
     WHERE user_id = $1
     ORDER BY created_at DESC`,
    [userId]
  );
  return buildTemplates(templateRowsResult.rows, userId);
};

const fetchTemplateById = async (
  userId: string,
  templateId: string
): Promise<WorkoutTemplate | null> => {
  const templateRowsResult = await query<TemplateRow>(
    `SELECT *
     FROM workout_templates
     WHERE user_id = $1 AND id = $2
     LIMIT 1`,
    [userId, templateId]
  );
  const templates = await buildTemplates(templateRowsResult.rows, userId);
  return templates[0] ?? null;
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

router.get("/", async (_req, res) => {
  const userId = res.locals.userId;
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  try {
    const templates = await fetchTemplates(userId);
    res.json(templates);
  } catch (err) {
    console.error("Failed to fetch templates", err);
    res.status(500).json({ error: "Failed to fetch templates" });
  }
});

router.get("/:id", async (req, res) => {
  const userId = res.locals.userId;
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  try {
    const template = await fetchTemplateById(userId, req.params.id);
    if (!template) {
      return res.status(404).json({ error: "Template not found" });
    }
    return res.json(template);
  } catch (err) {
    console.error("Failed to fetch template", err);
    return res.status(500).json({ error: "Failed to fetch template" });
  }
});

router.post("/", checkTemplateLimit, (req, res) => {
  const userId = res.locals.userId;
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const { name, description, splitType, exercises } = req.body as {
    name?: string;
    description?: string;
    splitType?: WorkoutTemplate["splitType"];
    exercises?: Array<{
      exerciseId: string;
      defaultSets: number;
      defaultReps?: number;
      defaultRepsMin?: number | null;
      defaultRepsMax?: number | null;
      defaultRestSeconds?: number;
      defaultWeight?: number;
      defaultIncline?: number;
      defaultDistance?: number;
      defaultDurationMinutes?: number;
      notes?: string;
    }>;
  };

  if (!name || !name.trim()) {
    return res.status(400).json({ error: "Name is required" });
  }
  if (!exercises || exercises.length < 1) {
    return res.status(400).json({ error: "At least one exercise required" });
  }

  const normalizedExercises: Array<
    (typeof exercises)[number] & {
      defaultReps: number;
      defaultRepsMin: number | null;
      defaultRepsMax: number | null;
    }
  > = [];

  for (let index = 0; index < exercises.length; index += 1) {
    const ex = exercises[index];
    const reps = normalizeReps(ex, index);
    if (!reps.ok) {
      return res.status(400).json({ error: reps.message });
    }
    normalizedExercises.push({
      ...ex,
      defaultReps: reps.defaultReps,
      defaultRepsMin: reps.defaultRepsMin,
      defaultRepsMax: reps.defaultRepsMax,
    });
  }

  withTransaction(async (client) => {
    const templateId = generateId();
    const now = new Date().toISOString();

    const templateRow = (
      await client.query<TemplateRow>(
        `INSERT INTO workout_templates
          (id, user_id, name, description, split_type, is_favorite, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, false, $6, $6)
         RETURNING *`,
        [
          templateId,
          userId,
          name.trim(),
          description ?? null,
          splitType ?? null,
          now,
        ]
      )
    ).rows[0];

    for (let index = 0; index < normalizedExercises.length; index += 1) {
      const ex = normalizedExercises[index];
      await client.query(
        `INSERT INTO workout_template_exercises
          (id, template_id, order_index, exercise_id, default_sets, default_reps, default_reps_min, default_reps_max, default_rest_seconds,
            default_weight, default_incline, default_distance, default_duration_minutes, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
        [
          generateId(),
          templateId,
          index,
          ex.exerciseId,
          ex.defaultSets,
          ex.defaultReps,
          ex.defaultRepsMin ?? null,
          ex.defaultRepsMax ?? null,
          ex.defaultRestSeconds ?? null,
          ex.defaultWeight ?? null,
          ex.defaultIncline ?? null,
          ex.defaultDistance ?? null,
          ex.defaultDurationMinutes ?? null,
          ex.notes ?? null,
        ]
      );
    }

    const exercisesRows = (
      await client.query<ExerciseRow>(
        `SELECT * FROM workout_template_exercises WHERE template_id = $1 ORDER BY order_index`,
        [templateId]
      )
    ).rows;

    const metaMap = await fetchExerciseMetaByIds(
      Array.from(new Set(exercisesRows.map((row) => row.exercise_id))),
      { userId }
    );

    return mapTemplate(templateRow, exercisesRows, metaMap);
  })
    .then((template) => res.status(201).json(template))
    .catch((err) => {
      console.error("Failed to create template", err);
      res.status(500).json({ error: "Failed to create template" });
    });
});

router.put("/:id", (req, res) => {
  const templateId = req.params.id;
  const userId = res.locals.userId;
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { name, description, splitType, isFavorite, sharingDisabled, exercises } = req.body as Partial<
    WorkoutTemplate
  > & {
    exercises?: Array<{
      exerciseId: string;
      defaultSets: number;
      defaultReps?: number;
      defaultRepsMin?: number | null;
      defaultRepsMax?: number | null;
      defaultRestSeconds?: number;
      defaultWeight?: number;
      defaultIncline?: number;
      defaultDistance?: number;
      defaultDurationMinutes?: number;
      notes?: string;
    }>;
  };

  if (name !== undefined && !name.trim()) {
    return res.status(400).json({ error: "Name is required" });
  }
  if (exercises && exercises.length < 1) {
    return res.status(400).json({ error: "At least one exercise required" });
  }

  type NormalizedExercise = {
    exerciseId: string;
    defaultSets: number;
    defaultReps: number;
    defaultRepsMin: number | null;
    defaultRepsMax: number | null;
    defaultRestSeconds?: number;
    defaultWeight?: number;
    defaultIncline?: number;
    defaultDistance?: number;
    defaultDurationMinutes?: number;
    notes?: string;
  };
  const normalizedExercises: Array<NormalizedExercise> = [];

  if (exercises) {
    for (let index = 0; index < exercises.length; index += 1) {
      const ex = exercises[index];
      const reps = normalizeReps(ex, index);
      if (!reps.ok) {
        return res.status(400).json({ error: reps.message });
      }
      normalizedExercises.push({
        exerciseId: ex.exerciseId,
        defaultSets: ex.defaultSets,
        defaultReps: reps.defaultReps,
        defaultRepsMin: reps.defaultRepsMin,
        defaultRepsMax: reps.defaultRepsMax,
        defaultRestSeconds: ex.defaultRestSeconds,
        defaultWeight: ex.defaultWeight,
        defaultIncline: ex.defaultIncline,
        defaultDistance: ex.defaultDistance,
        defaultDurationMinutes: ex.defaultDurationMinutes,
        notes: ex.notes,
      });
    }
  }

  withTransaction(async (client) => {
    const updates: string[] = [];
    const values: unknown[] = [];
    let idx = 3;

    if (name !== undefined) {
      updates.push(`name = $${idx}`);
      values.push(name.trim());
      idx += 1;
    }
    if (description !== undefined) {
      updates.push(`description = $${idx}`);
      values.push(description ?? null);
      idx += 1;
    }
    if (splitType !== undefined) {
      updates.push(`split_type = $${idx}`);
      values.push(splitType ?? null);
      idx += 1;
    }
    if (isFavorite !== undefined) {
      updates.push(`is_favorite = $${idx}`);
      values.push(isFavorite);
      idx += 1;
    }
    if (sharingDisabled !== undefined) {
      updates.push(`sharing_disabled = $${idx}`);
      values.push(Boolean(sharingDisabled));
      idx += 1;
    }

    updates.push(`updated_at = NOW()`);

    const updateQuery = `
      UPDATE workout_templates
      SET ${updates.join(", ")}
      WHERE id = $1 AND user_id = $2
      RETURNING *
    `;

    const templateResult = await client.query<TemplateRow>(
      updateQuery,
      [templateId, userId, ...values]
    );

    if (templateResult.rowCount === 0) {
      throw new Error("NOT_FOUND");
    }

    if (exercises) {
      await client.query(
        `DELETE FROM workout_template_exercises WHERE template_id = $1`,
        [templateId]
      );

      for (let index = 0; index < normalizedExercises.length; index += 1) {
        const ex = normalizedExercises[index];
        await client.query(
          `INSERT INTO workout_template_exercises
            (id, template_id, order_index, exercise_id, default_sets, default_reps, default_reps_min, default_reps_max, default_rest_seconds,
              default_weight, default_incline, default_distance, default_duration_minutes, notes)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
          [
            generateId(),
            templateId,
            index,
            ex.exerciseId,
            ex.defaultSets,
            ex.defaultReps,
            ex.defaultRepsMin ?? null,
            ex.defaultRepsMax ?? null,
            ex.defaultRestSeconds ?? null,
            ex.defaultWeight ?? null,
            ex.defaultIncline ?? null,
            ex.defaultDistance ?? null,
            ex.defaultDurationMinutes ?? null,
            ex.notes ?? null,
          ]
        );
      }
    }

    const exercisesRows = (
      await client.query<ExerciseRow>(
        `SELECT * FROM workout_template_exercises WHERE template_id = $1 ORDER BY order_index`,
        [templateId]
      )
    ).rows;

    const metaMap = await fetchExerciseMetaByIds(
      Array.from(new Set(exercisesRows.map((row) => row.exercise_id))),
      { userId }
    );

    return mapTemplate(templateResult.rows[0], exercisesRows, metaMap);
  })
    .then((template) => res.json(template))
    .catch((err) => {
      if ((err as Error).message === "NOT_FOUND") {
        return res.status(404).json({ error: "Template not found" });
      }
      console.error("Failed to update template", err);
      return res.status(500).json({ error: "Failed to update template" });
    });
});

router.post("/:templateId/share", async (req, res) => {
  const userId = res.locals.userId;
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const templateId = req.params.templateId;
  const { expiresAt } = (req.body ?? {}) as { expiresAt?: string | null };

  const parsedExpiresAt =
    expiresAt && !Number.isNaN(new Date(expiresAt).getTime()) ? new Date(expiresAt) : null;

  if (expiresAt && !parsedExpiresAt) {
    return res.status(400).json({ error: "Invalid expiresAt" });
  }
  if (parsedExpiresAt && parsedExpiresAt.getTime() <= Date.now()) {
    return res.status(400).json({ error: "expiresAt must be in the future" });
  }

  try {
    const templateResult = await query<{ sharing_disabled: boolean }>(
      `SELECT sharing_disabled FROM workout_templates WHERE id = $1 AND user_id = $2 LIMIT 1`,
      [templateId, userId]
    );
    const templateRow = templateResult.rows[0];
    if (!templateRow) {
      return res.status(404).json({ error: "Template not found" });
    }
    if (templateRow.sharing_disabled) {
      return res.status(403).json({ error: "Sharing is disabled for this template" });
    }

    const existing = await query<{
      share_code: string;
      expires_at: string | null;
      is_revoked: boolean;
      created_at: string;
    }>(
      `
        SELECT share_code, expires_at, is_revoked, created_at
        FROM template_shares
        WHERE template_id = $1
          AND created_by = $2
          AND is_revoked = false
          AND (expires_at IS NULL OR expires_at > NOW())
        ORDER BY created_at DESC
        LIMIT 1
      `,
      [templateId, userId]
    );

    if (existing.rows[0]) {
      const shareCode = existing.rows[0].share_code;
      return res.json({
        shareCode,
        ...buildShareUrls(shareCode),
        expiresAt: existing.rows[0].expires_at,
        isRevoked: existing.rows[0].is_revoked,
        createdAt: existing.rows[0].created_at,
      });
    }

    const created = await withTransaction(async (client) => {
      for (let attempt = 0; attempt < 5; attempt += 1) {
        const shareCode = generateShareCode();
        try {
          const row = (
            await client.query<{
              share_code: string;
              expires_at: string | null;
              is_revoked: boolean;
              created_at: string;
            }>(
              `
                INSERT INTO template_shares (id, template_id, share_code, created_by, expires_at)
                VALUES ($1, $2, $3, $4, $5)
                RETURNING share_code, expires_at, is_revoked, created_at
              `,
              [generateId(), templateId, shareCode, userId, parsedExpiresAt?.toISOString() ?? null]
            )
          ).rows[0];
          return row;
        } catch (err) {
          const pgErr = err as { code?: string };
          if (pgErr.code === "23505") {
            continue;
          }
          throw err;
        }
      }
      throw new Error("FAILED_TO_CREATE_SHARE");
    });

    const shareCode = created.share_code;
    return res.status(201).json({
      shareCode,
      ...buildShareUrls(shareCode),
      expiresAt: created.expires_at,
      isRevoked: created.is_revoked,
      createdAt: created.created_at,
    });
  } catch (err) {
    console.error("Failed to create template share", err);
    return res.status(500).json({ error: "Failed to create template share" });
  }
});

router.delete("/:templateId/share", async (req, res) => {
  const userId = res.locals.userId;
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const templateId = req.params.templateId;
  try {
    const result = await query(
      `
        UPDATE template_shares
        SET is_revoked = true
        WHERE template_id = $1 AND created_by = $2 AND is_revoked = false
        RETURNING id
      `,
      [templateId, userId]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Share link not found" });
    }
    return res.status(204).send();
  } catch (err) {
    console.error("Failed to revoke template share", err);
    return res.status(500).json({ error: "Failed to revoke template share" });
  }
});

router.get("/:templateId/share/stats", async (req, res) => {
  const userId = res.locals.userId;
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const templateId = req.params.templateId;
  try {
    const templateResult = await query(
      `SELECT id FROM workout_templates WHERE id = $1 AND user_id = $2 LIMIT 1`,
      [templateId, userId]
    );
    if (templateResult.rowCount === 0) {
      return res.status(404).json({ error: "Template not found" });
    }

    const shareResult = await query<{
      id: string;
      share_code: string;
      created_at: string;
      expires_at: string | null;
      is_revoked: boolean;
      views_count: number;
      copies_count: number;
    }>(
      `
        SELECT id, share_code, created_at, expires_at, is_revoked, views_count, copies_count
        FROM template_shares
        WHERE template_id = $1 AND created_by = $2
        ORDER BY created_at DESC
        LIMIT 1
      `,
      [templateId, userId]
    );
    const share = shareResult.rows[0];
    if (!share) {
      return res.status(404).json({ error: "Share link not found" });
    }

    const signupsResult = await query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM template_share_signups WHERE share_id = $1`,
      [share.id]
    );
    const signupsCount = Number(signupsResult.rows[0]?.count ?? "0");

    const urls = buildShareUrls(share.share_code);
    const copyRate =
      share.views_count > 0 ? Number((share.copies_count / share.views_count).toFixed(4)) : 0;
    const signupRate =
      share.views_count > 0 ? Number((signupsCount / share.views_count).toFixed(4)) : 0;

    return res.json({
      shareCode: share.share_code,
      ...urls,
      createdAt: share.created_at,
      expiresAt: share.expires_at,
      isRevoked: share.is_revoked,
      stats: {
        viewsCount: share.views_count,
        copiesCount: share.copies_count,
        signupsCount,
        copyRate,
        signupRate,
      },
    });
  } catch (err) {
    console.error("Failed to fetch template share stats", err);
    return res.status(500).json({ error: "Failed to fetch template share stats" });
  }
});

router.post("/:id/duplicate", async (req, res) => {
  const userId = res.locals.userId;
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const original = await fetchTemplateById(userId, req.params.id);
  if (!original) {
    return res.status(404).json({ error: "Template not found" });
  }

  withTransaction(async (client) => {
    const templateId = generateId();
    const now = new Date().toISOString();

    const templateRow = (
      await client.query<TemplateRow>(
        `INSERT INTO workout_templates
          (id, user_id, name, description, split_type, is_favorite, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, false, $6, $6)
         RETURNING *`,
        [
          templateId,
          userId,
          `${original.name} (Copy)`,
          original.description ?? null,
          original.splitType ?? null,
          now,
        ]
      )
    ).rows[0];

    for (let index = 0; index < original.exercises.length; index += 1) {
      const ex = original.exercises[index];
      await client.query(
        `INSERT INTO workout_template_exercises
          (id, template_id, order_index, exercise_id, default_sets, default_reps, default_reps_min, default_reps_max, default_rest_seconds,
            default_weight, default_incline, default_distance, default_duration_minutes, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
        [
          generateId(),
          templateId,
          index,
          ex.exerciseId,
          ex.defaultSets,
          ex.defaultReps,
          ex.defaultRepsMin ?? null,
          ex.defaultRepsMax ?? null,
          ex.defaultRestSeconds ?? null,
          ex.defaultWeight ?? null,
          ex.defaultIncline ?? null,
          ex.defaultDistance ?? null,
          ex.defaultDurationMinutes ?? null,
          ex.notes ?? null,
        ]
      );
    }

    const exercisesRows = (
      await client.query<ExerciseRow>(
        `SELECT * FROM workout_template_exercises WHERE template_id = $1 ORDER BY order_index`,
        [templateId]
      )
    ).rows;

    const metaMap = await fetchExerciseMetaByIds(
      Array.from(new Set(exercisesRows.map((row) => row.exercise_id))),
      { userId }
    );

    return mapTemplate(templateRow, exercisesRows, metaMap);
  })
    .then((duplicate) => res.status(201).json(duplicate))
    .catch((err) => {
      console.error("Failed to duplicate template", err);
      res.status(500).json({ error: "Failed to duplicate template" });
    });
});

router.delete("/:id", async (req, res) => {
  const userId = res.locals.userId;
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  try {
    const result = await query(
      `DELETE FROM workout_templates WHERE id = $1 AND user_id = $2 RETURNING id`,
      [req.params.id, userId]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Template not found" });
    }
    return res.status(204).send();
  } catch (err) {
    console.error("Failed to delete template", err);
    return res.status(500).json({ error: "Failed to delete template" });
  }
});

export default router;
