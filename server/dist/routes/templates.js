"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const id_1 = require("../utils/id");
const db_1 = require("../db");
const planLimits_1 = require("../middleware/planLimits");
const exerciseCatalog_1 = require("../utils/exerciseCatalog");
const router = (0, express_1.Router)();
const formatExerciseId = (id) => id
    .replace(/[_-]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
const numberOrUndefined = (value) => value === null || value === undefined ? undefined : Number(value);
const mapExercise = (row, metaMap) => {
    const meta = metaMap.get(row.exercise_id);
    return {
        id: row.id,
        exerciseId: row.exercise_id,
        orderIndex: row.order_index,
        exerciseName: meta?.name ?? formatExerciseId(row.exercise_id),
        primaryMuscleGroup: meta?.primaryMuscleGroup ?? "other",
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
const mapTemplate = (row, exerciseRows, metaMap) => ({
    id: row.id,
    userId: row.user_id,
    name: row.name,
    description: row.description ?? undefined,
    splitType: row.split_type ?? undefined,
    isFavorite: row.is_favorite,
    exercises: exerciseRows
        .filter((ex) => ex.template_id === row.id)
        .sort((a, b) => a.order_index - b.order_index)
        .map((ex) => mapExercise(ex, metaMap)),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
});
const buildTemplates = async (templateRows) => {
    if (templateRows.length === 0)
        return [];
    const templateIds = templateRows.map((row) => row.id);
    const exerciseRowsResult = await (0, db_1.query)(`SELECT *
     FROM workout_template_exercises
     WHERE template_id = ANY($1::text[])
     ORDER BY order_index ASC`, [templateIds]);
    const exerciseIds = Array.from(new Set(exerciseRowsResult.rows.map((row) => row.exercise_id)));
    const metaMap = await (0, exerciseCatalog_1.fetchExerciseMetaByIds)(exerciseIds);
    return templateRows.map((row) => mapTemplate(row, exerciseRowsResult.rows, metaMap));
};
const fetchTemplates = async (userId) => {
    const templateRowsResult = await (0, db_1.query)(`SELECT *
     FROM workout_templates
     WHERE user_id = $1
     ORDER BY created_at DESC`, [userId]);
    return buildTemplates(templateRowsResult.rows);
};
const fetchTemplateById = async (userId, templateId) => {
    const templateRowsResult = await (0, db_1.query)(`SELECT *
     FROM workout_templates
     WHERE user_id = $1 AND id = $2
     LIMIT 1`, [userId, templateId]);
    const templates = await buildTemplates(templateRowsResult.rows);
    return templates[0] ?? null;
};
const withTransaction = async (fn) => {
    const client = await db_1.pool.connect();
    try {
        await client.query("BEGIN");
        const result = await fn(client);
        await client.query("COMMIT");
        return result;
    }
    catch (err) {
        await client.query("ROLLBACK");
        throw err;
    }
    finally {
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
    }
    catch (err) {
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
    }
    catch (err) {
        console.error("Failed to fetch template", err);
        return res.status(500).json({ error: "Failed to fetch template" });
    }
});
router.post("/", planLimits_1.checkTemplateLimit, (req, res) => {
    const userId = res.locals.userId;
    if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
    }
    const { name, description, splitType, exercises } = req.body;
    if (!name || !name.trim()) {
        return res.status(400).json({ error: "Name is required" });
    }
    if (!exercises || exercises.length < 1) {
        return res.status(400).json({ error: "At least one exercise required" });
    }
    withTransaction(async (client) => {
        const templateId = (0, id_1.generateId)();
        const now = new Date().toISOString();
        const templateRow = (await client.query(`INSERT INTO workout_templates
          (id, user_id, name, description, split_type, is_favorite, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, false, $6, $6)
         RETURNING *`, [
            templateId,
            userId,
            name.trim(),
            description ?? null,
            splitType ?? null,
            now,
        ])).rows[0];
        for (let index = 0; index < exercises.length; index += 1) {
            const ex = exercises[index];
            await client.query(`INSERT INTO workout_template_exercises
          (id, template_id, order_index, exercise_id, default_sets, default_reps, default_rest_seconds,
            default_weight, default_incline, default_distance, default_duration_minutes, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`, [
                (0, id_1.generateId)(),
                templateId,
                index,
                ex.exerciseId,
                ex.defaultSets,
                ex.defaultReps,
                ex.defaultRestSeconds ?? null,
                ex.defaultWeight ?? null,
                ex.defaultIncline ?? null,
                ex.defaultDistance ?? null,
                ex.defaultDurationMinutes ?? null,
                ex.notes ?? null,
            ]);
        }
        const exercisesRows = (await client.query(`SELECT * FROM workout_template_exercises WHERE template_id = $1 ORDER BY order_index`, [templateId])).rows;
        const metaMap = await (0, exerciseCatalog_1.fetchExerciseMetaByIds)(Array.from(new Set(exercisesRows.map((row) => row.exercise_id))));
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
    const { name, description, splitType, isFavorite, exercises } = req.body;
    if (name !== undefined && !name.trim()) {
        return res.status(400).json({ error: "Name is required" });
    }
    if (exercises && exercises.length < 1) {
        return res.status(400).json({ error: "At least one exercise required" });
    }
    withTransaction(async (client) => {
        const updates = [];
        const values = [];
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
        updates.push(`updated_at = NOW()`);
        const updateQuery = `
      UPDATE workout_templates
      SET ${updates.join(", ")}
      WHERE id = $1 AND user_id = $2
      RETURNING *
    `;
        const templateResult = await client.query(updateQuery, [templateId, userId, ...values]);
        if (templateResult.rowCount === 0) {
            throw new Error("NOT_FOUND");
        }
        if (exercises) {
            await client.query(`DELETE FROM workout_template_exercises WHERE template_id = $1`, [templateId]);
            for (let index = 0; index < exercises.length; index += 1) {
                const ex = exercises[index];
                await client.query(`INSERT INTO workout_template_exercises
            (id, template_id, order_index, exercise_id, default_sets, default_reps, default_rest_seconds,
              default_weight, default_incline, default_distance, default_duration_minutes, notes)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`, [
                    (0, id_1.generateId)(),
                    templateId,
                    index,
                    ex.exerciseId,
                    ex.defaultSets,
                    ex.defaultReps,
                    ex.defaultRestSeconds ?? null,
                    ex.defaultWeight ?? null,
                    ex.defaultIncline ?? null,
                    ex.defaultDistance ?? null,
                    ex.defaultDurationMinutes ?? null,
                    ex.notes ?? null,
                ]);
            }
        }
        const exercisesRows = (await client.query(`SELECT * FROM workout_template_exercises WHERE template_id = $1 ORDER BY order_index`, [templateId])).rows;
        const metaMap = await (0, exerciseCatalog_1.fetchExerciseMetaByIds)(Array.from(new Set(exercisesRows.map((row) => row.exercise_id))));
        return mapTemplate(templateResult.rows[0], exercisesRows, metaMap);
    })
        .then((template) => res.json(template))
        .catch((err) => {
        if (err.message === "NOT_FOUND") {
            return res.status(404).json({ error: "Template not found" });
        }
        console.error("Failed to update template", err);
        return res.status(500).json({ error: "Failed to update template" });
    });
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
        const templateId = (0, id_1.generateId)();
        const now = new Date().toISOString();
        const templateRow = (await client.query(`INSERT INTO workout_templates
          (id, user_id, name, description, split_type, is_favorite, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, false, $6, $6)
         RETURNING *`, [
            templateId,
            userId,
            `${original.name} (Copy)`,
            original.description ?? null,
            original.splitType ?? null,
            now,
        ])).rows[0];
        for (let index = 0; index < original.exercises.length; index += 1) {
            const ex = original.exercises[index];
            await client.query(`INSERT INTO workout_template_exercises
          (id, template_id, order_index, exercise_id, default_sets, default_reps, default_rest_seconds,
            default_weight, default_incline, default_distance, default_duration_minutes, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`, [
                (0, id_1.generateId)(),
                templateId,
                index,
                ex.exerciseId,
                ex.defaultSets,
                ex.defaultReps,
                ex.defaultRestSeconds ?? null,
                ex.defaultWeight ?? null,
                ex.defaultIncline ?? null,
                ex.defaultDistance ?? null,
                ex.defaultDurationMinutes ?? null,
                ex.notes ?? null,
            ]);
        }
        const exercisesRows = (await client.query(`SELECT * FROM workout_template_exercises WHERE template_id = $1 ORDER BY order_index`, [templateId])).rows;
        const metaMap = await (0, exerciseCatalog_1.fetchExerciseMetaByIds)(Array.from(new Set(exercisesRows.map((row) => row.exercise_id))));
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
        const result = await (0, db_1.query)(`DELETE FROM workout_templates WHERE id = $1 AND user_id = $2 RETURNING id`, [req.params.id, userId]);
        if (result.rowCount === 0) {
            return res.status(404).json({ error: "Template not found" });
        }
        return res.status(204).send();
    }
    catch (err) {
        console.error("Failed to delete template", err);
        return res.status(500).json({ error: "Failed to delete template" });
    }
});
exports.default = router;
