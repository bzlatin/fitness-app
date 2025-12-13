import { Router } from 'express';
import { PoolClient, QueryResultRow } from 'pg';
import { pool, query } from '../db';
import { generateId } from '../utils/id';
import { WorkoutTemplate, WorkoutTemplateExercise } from '../types/workouts';
import { ExerciseMeta, fetchExerciseMetaByIds } from '../utils/exerciseCatalog';

type TemplateRow = {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  split_type: string | null;
  is_favorite: boolean;
  created_at: string;
  updated_at: string;
  sharing_disabled?: boolean;
};

type ExerciseRow = {
  id: string;
  template_id: string;
  order_index: number;
  exercise_id: string;
  default_sets: number;
  default_reps: number;
  default_rest_seconds: number | null;
  default_weight: string | null;
  default_incline: string | null;
  default_distance: string | null;
  default_duration_minutes: string | null;
  notes: string | null;
};

type ShareRow = {
  id: string;
  template_id: string;
  share_code: string;
  created_by: string;
  created_at: string;
  expires_at: string | null;
  is_revoked: boolean;
  views_count: number;
  copies_count: number;
};

const SHARE_CODE_REGEX = /^[0-9a-z]{8}$/;

const isActiveShare = (share: Pick<ShareRow, 'is_revoked' | 'expires_at'>) => {
  if (share.is_revoked) return false;
  if (!share.expires_at) return true;
  return new Date(share.expires_at).getTime() > Date.now();
};

const formatExerciseId = (id: string) =>
  id
    .replace(/[_-]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();

const numberOrUndefined = (value: string | number | null) =>
  value === null || value === undefined ? undefined : Number(value);

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
    primaryMuscleGroup: meta?.primaryMuscleGroup ?? 'other',
    exerciseImageUrl: meta?.gifUrl,
    defaultSets: row.default_sets,
    defaultReps: row.default_reps,
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
  splitType: (row.split_type as WorkoutTemplate['splitType']) ?? undefined,
  isFavorite: row.is_favorite,
  exercises: exerciseRows
    .filter((ex) => ex.template_id === row.id)
    .sort((a, b) => a.order_index - b.order_index)
    .map((ex) => mapExercise(ex, metaMap)),
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const runQuery = async <T extends QueryResultRow>(
  client: PoolClient | null,
  text: string,
  params?: unknown[]
) => {
  if (client) {
    return client.query<T>(text, params);
  }
  return query<T>(text, params);
};

const buildTemplate = async (templateRow: TemplateRow, client: PoolClient | null = null) => {
  const exerciseRowsResult = await runQuery<ExerciseRow>(
    client,
    `SELECT *
     FROM workout_template_exercises
     WHERE template_id = $1
     ORDER BY order_index ASC`,
    [templateRow.id]
  );
  const exerciseIds = Array.from(
    new Set(exerciseRowsResult.rows.map((row) => row.exercise_id))
  );
  const metaMap = await fetchExerciseMetaByIds(exerciseIds);
  return mapTemplate(templateRow, exerciseRowsResult.rows, metaMap);
};

const withTransaction = async <T>(fn: (client: PoolClient) => Promise<T>) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

const PUBLIC_APP_URL = (process.env.PUBLIC_APP_URL || 'https://push-pull.app').replace(
  /\/+$/,
  ''
);

const buildShareUrls = (shareCode: string) => ({
  webUrl: `${PUBLIC_APP_URL}/workout/${shareCode}`,
  deepLinkUrl: `push-pull://workout/share/${shareCode}`,
});

export const templateSharesPublicRouter = Router();
export const templateSharesAuthedRouter = Router();

templateSharesPublicRouter.get('/:code', async (req, res) => {
  const code = String(req.params.code ?? '').toLowerCase().trim();
  if (!SHARE_CODE_REGEX.test(code)) {
    return res.status(404).json({ error: 'Share link not found' });
  }

  try {
    const result = await query<{
      share_id: string;
      share_template_id: string;
      share_code: string;
      share_created_by: string;
      share_created_at: string;
      share_expires_at: string | null;
      share_is_revoked: boolean;
      share_views_count: number;
      share_copies_count: number;
      template_id: string;
      template_user_id: string;
      template_name: string;
      template_description: string | null;
      template_split_type: string | null;
      template_is_favorite: boolean;
      template_created_at: string;
      template_updated_at: string;
      template_sharing_disabled: boolean;
      creator_handle: string | null;
      creator_name: string | null;
      creator_avatar_url: string | null;
    }>(
      `
        SELECT
          s.id AS share_id,
          s.template_id AS share_template_id,
          s.share_code AS share_code,
          s.created_by AS share_created_by,
          s.created_at AS share_created_at,
          s.expires_at AS share_expires_at,
          s.is_revoked AS share_is_revoked,
          s.views_count AS share_views_count,
          s.copies_count AS share_copies_count,
          t.id AS template_id,
          t.user_id AS template_user_id,
          t.name AS template_name,
          t.description AS template_description,
          t.split_type AS template_split_type,
          t.is_favorite AS template_is_favorite,
          t.created_at AS template_created_at,
          t.updated_at AS template_updated_at,
          t.sharing_disabled AS template_sharing_disabled,
          u.handle AS creator_handle,
          u.name AS creator_name,
          u.avatar_url AS creator_avatar_url
        FROM template_shares s
        JOIN workout_templates t ON t.id = s.template_id
        JOIN users u ON u.id = t.user_id
        WHERE s.share_code = $1
        LIMIT 1
      `,
      [code]
    );

    const row = result.rows[0];
    if (!row) {
      return res.status(404).json({ error: 'Share link not found' });
    }

    const share: ShareRow = {
      id: row.share_id,
      template_id: row.share_template_id,
      share_code: row.share_code,
      created_by: row.share_created_by,
      created_at: row.share_created_at,
      expires_at: row.share_expires_at,
      is_revoked: row.share_is_revoked,
      views_count: row.share_views_count,
      copies_count: row.share_copies_count,
    };

    if (!isActiveShare(share) || row.template_sharing_disabled) {
      return res.status(404).json({ error: 'Share link not found' });
    }

    await query(`UPDATE template_shares SET views_count = views_count + 1 WHERE id = $1`, [
      share.id,
    ]);

    const templateRow: TemplateRow = {
      id: row.template_id,
      user_id: row.template_user_id,
      name: row.template_name,
      description: row.template_description,
      split_type: row.template_split_type,
      is_favorite: row.template_is_favorite,
      created_at: row.template_created_at,
      updated_at: row.template_updated_at,
      sharing_disabled: row.template_sharing_disabled,
    };

    const template = await buildTemplate(templateRow);
    const urls = buildShareUrls(share.share_code);

    return res.json({
      shareCode: share.share_code,
      ...urls,
      expiresAt: share.expires_at,
      template,
      creator: {
        handle: row.creator_handle,
        name: row.creator_name,
        avatarUrl: row.creator_avatar_url,
      },
      stats: {
        viewsCount: share.views_count + 1,
        copiesCount: share.copies_count,
      },
    });
  } catch (err) {
    console.error('Failed to fetch shared template preview', err);
    return res.status(500).json({ error: 'Failed to fetch shared template preview' });
  }
});

templateSharesAuthedRouter.post('/:code/copy', async (req, res) => {
  const userId = res.locals.userId as string | undefined;
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const code = String(req.params.code ?? '').toLowerCase().trim();
  if (!SHARE_CODE_REGEX.test(code)) {
    return res.status(404).json({ error: 'Share link not found' });
  }

  try {
    const response = await withTransaction(async (client) => {
      const shareResult = await client.query<{
        share_id: string;
        share_template_id: string;
        share_code: string;
        share_created_by: string;
        share_created_at: string;
        share_expires_at: string | null;
        share_is_revoked: boolean;
        share_views_count: number;
        share_copies_count: number;
        template_id: string;
        template_name: string;
        template_description: string | null;
        template_split_type: string | null;
        template_sharing_disabled: boolean;
      }>(
        `
          SELECT
            s.id AS share_id,
            s.template_id AS share_template_id,
            s.share_code AS share_code,
            s.created_by AS share_created_by,
            s.created_at AS share_created_at,
            s.expires_at AS share_expires_at,
            s.is_revoked AS share_is_revoked,
            s.views_count AS share_views_count,
            s.copies_count AS share_copies_count,
            t.id AS template_id,
            t.name AS template_name,
            t.description AS template_description,
            t.split_type AS template_split_type,
            t.sharing_disabled AS template_sharing_disabled
          FROM template_shares s
          JOIN workout_templates t ON t.id = s.template_id
          WHERE s.share_code = $1
          LIMIT 1
          FOR UPDATE
        `,
        [code]
      );

      const row = shareResult.rows[0];
      if (!row) {
        throw new Error('NOT_FOUND');
      }

      const share: ShareRow = {
        id: row.share_id,
        template_id: row.share_template_id,
        share_code: row.share_code,
        created_by: row.share_created_by,
        created_at: row.share_created_at,
        expires_at: row.share_expires_at,
        is_revoked: row.share_is_revoked,
        views_count: row.share_views_count,
        copies_count: row.share_copies_count,
      };

      if (!isActiveShare(share) || row.template_sharing_disabled) {
        throw new Error('NOT_FOUND');
      }

      const existingCopy = await client.query<{
        new_template_id: string;
      }>(
        `
          SELECT new_template_id
          FROM template_share_copies
          WHERE share_id = $1 AND user_id = $2
          LIMIT 1
        `,
        [share.id, userId]
      );

      if (existingCopy.rows[0]?.new_template_id) {
        const existingTemplateId = existingCopy.rows[0].new_template_id;
        const templateResult = await client.query<TemplateRow>(
          `
            SELECT id, user_id, name, description, split_type, is_favorite, created_at, updated_at
            FROM workout_templates
            WHERE id = $1 AND user_id = $2
            LIMIT 1
          `,
          [existingTemplateId, userId]
        );
        const existingTemplateRow = templateResult.rows[0];
        if (!existingTemplateRow) {
          throw new Error('COPY_MISSING');
        }
        const template = await buildTemplate(existingTemplateRow, client);
        return { template, wasAlreadyCopied: true };
      }

      const newTemplateId = generateId();
      const now = new Date().toISOString();

      const insertedTemplateRow = (
        await client.query<TemplateRow>(
          `
            INSERT INTO workout_templates
              (id, user_id, name, description, split_type, is_favorite, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, false, $6, $6)
            RETURNING id, user_id, name, description, split_type, is_favorite, created_at, updated_at
          `,
          [
            newTemplateId,
            userId,
            row.template_name,
            row.template_description ?? null,
            row.template_split_type ?? null,
            now,
          ]
        )
      ).rows[0];

      const exerciseRows = (
        await client.query<ExerciseRow>(
          `
            SELECT *
            FROM workout_template_exercises
            WHERE template_id = $1
            ORDER BY order_index ASC
          `,
          [row.template_id]
        )
      ).rows;

      for (const ex of exerciseRows) {
        await client.query(
          `
            INSERT INTO workout_template_exercises
              (id, template_id, order_index, exercise_id, default_sets, default_reps, default_rest_seconds,
               default_weight, default_incline, default_distance, default_duration_minutes, notes)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
          `,
          [
            generateId(),
            newTemplateId,
            ex.order_index,
            ex.exercise_id,
            ex.default_sets,
            ex.default_reps,
            ex.default_rest_seconds ?? null,
            ex.default_weight ?? null,
            ex.default_incline ?? null,
            ex.default_distance ?? null,
            ex.default_duration_minutes ?? null,
            ex.notes ?? null,
          ]
        );
      }

      await client.query(
        `
          INSERT INTO template_share_copies (share_id, user_id, new_template_id)
          VALUES ($1, $2, $3)
          ON CONFLICT (share_id, user_id) DO NOTHING
        `,
        [share.id, userId, newTemplateId]
      );

      await client.query(`UPDATE template_shares SET copies_count = copies_count + 1 WHERE id = $1`, [
        share.id,
      ]);

      const template = await buildTemplate(insertedTemplateRow, client);
      return { template, wasAlreadyCopied: false };
    });

    return res.status(201).json(response);
  } catch (err) {
    const message = (err as Error).message;
    if (message === 'NOT_FOUND') {
      return res.status(404).json({ error: 'Share link not found' });
    }
    if (message === 'COPY_MISSING') {
      return res.status(409).json({ error: 'Copy was missing; please try again' });
    }
    console.error('Failed to copy shared template', err);
    return res.status(500).json({ error: 'Failed to copy shared template' });
  }
});
