"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchExerciseMetaByIds = exports.fetchExerciseCatalog = void 0;
const db_1 = require("../db");
const mapExerciseRow = (row) => {
    const imagePath = row.image_paths?.[0];
    return {
        id: row.id,
        name: row.name,
        primaryMuscleGroup: (row.primary_muscle_group ?? "other").toLowerCase(),
        equipment: (row.equipment ?? "bodyweight").toLowerCase(),
        category: row.category ?? undefined,
        gifUrl: imagePath ? `/api/exercises/assets/${imagePath}` : undefined,
    };
};
const fetchExerciseCatalog = async () => {
    const result = await (0, db_1.query)(`SELECT id, name, primary_muscle_group, equipment, category, image_paths FROM exercises`);
    return result.rows.map(mapExerciseRow);
};
exports.fetchExerciseCatalog = fetchExerciseCatalog;
const fetchExerciseMetaByIds = async (ids, options) => {
    if (!ids.length)
        return new Map();
    const result = await (0, db_1.query)(`SELECT id, name, primary_muscle_group, equipment, category, image_paths
     FROM exercises
     WHERE id = ANY($1::text[])`, [ids]);
    const map = new Map();
    result.rows.forEach((row) => {
        const meta = mapExerciseRow(row);
        map.set(meta.id, meta);
    });
    if (options?.userId) {
        const custom = await (0, db_1.query)(`SELECT id, name, primary_muscle_group, equipment, image_url
       FROM user_exercises
       WHERE id = ANY($1::text[])
         AND user_id = $2
         AND deleted_at IS NULL`, [ids, options.userId]);
        custom.rows.forEach((row) => {
            map.set(row.id, {
                id: row.id,
                name: row.name,
                primaryMuscleGroup: (row.primary_muscle_group ?? "other").toLowerCase(),
                equipment: (row.equipment ?? "bodyweight").toLowerCase(),
                category: "custom",
                gifUrl: row.image_url ?? undefined,
            });
        });
    }
    return map;
};
exports.fetchExerciseMetaByIds = fetchExerciseMetaByIds;
