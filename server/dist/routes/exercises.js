"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importStar(require("express"));
const path_1 = __importDefault(require("path"));
const multer_1 = __importDefault(require("multer"));
const nanoid_1 = require("nanoid");
const db_1 = require("../db");
const exerciseCatalog_1 = require("../utils/exerciseCatalog");
const auth_1 = require("../middleware/auth");
const planLimits_1 = require("../middleware/planLimits");
const cloudinary_1 = require("../services/cloudinary");
const router = (0, express_1.Router)();
const upload = (0, multer_1.default)({ storage: multer_1.default.memoryStorage() });
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
// Serve static exercise images (dist dataset first, then raw exercises folder as fallback)
const imagesDirDist = path_1.default.join(__dirname, "../data/dist");
const imagesDirLegacy = path_1.default.join(__dirname, "../data/exercises");
router.use("/assets", express_1.default.static(imagesDirDist));
router.use("/assets", express_1.default.static(imagesDirLegacy));
router.get("/search", async (req, res) => {
    const { query: search, muscleGroup } = req.query;
    const searchValue = typeof search === "string" ? search.toLowerCase() : "";
    const muscleValue = typeof muscleGroup === "string" ? muscleGroup.toLowerCase() : "";
    const musclePattern = muscleValue ? `%${muscleValue}%` : "";
    try {
        const results = await (0, db_1.query)(`
        SELECT id, name, primary_muscle_group, equipment, category, image_paths
        FROM exercises
        WHERE ($1 = '' OR LOWER(name) LIKE $2)
          AND ($3 = '' OR LOWER(primary_muscle_group) LIKE $3)
        ORDER BY name ASC
        LIMIT 100
      `, [searchValue, `%${searchValue}%`, musclePattern]);
        return res.json(results.rows.map(mapExerciseRow));
    }
    catch (err) {
        console.error("Failed to search exercises", err);
        return res.status(500).json({ error: "Failed to search exercises" });
    }
});
// Batch fetch exercises by IDs
router.get("/batch", async (req, res) => {
    const { ids } = req.query;
    if (!ids || typeof ids !== "string") {
        return res.json([]);
    }
    const requestedIds = ids.split(",").map((id) => id.trim());
    try {
        const metaMap = await (0, exerciseCatalog_1.fetchExerciseMetaByIds)(requestedIds);
        const results = requestedIds
            .map((id) => metaMap.get(id))
            .filter((ex) => Boolean(ex));
        return res.json(results);
    }
    catch (err) {
        console.error("Failed to load exercises batch", err);
        return res.status(500).json({ error: "Failed to load exercises" });
    }
});
const mapCustomExerciseRow = (row) => ({
    id: row.id,
    userId: row.user_id,
    name: row.name,
    primaryMuscleGroup: row.primary_muscle_group,
    secondaryMuscleGroups: row.secondary_muscle_groups || [],
    equipment: row.equipment || "bodyweight",
    notes: row.notes || "",
    imageUrl: row.image_url || undefined,
    scope: row.scope,
    squadId: row.squad_id || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at || undefined,
});
/**
 * GET /api/exercises/custom
 * Get all custom exercises for the authenticated user (excludes soft-deleted)
 */
router.get("/custom", auth_1.maybeRequireAuth, auth_1.attachUser, async (req, res) => {
    const userId = res.locals.userId;
    if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
    }
    try {
        const result = await (0, db_1.query)(`SELECT * FROM user_exercises
       WHERE user_id = $1 AND deleted_at IS NULL
       ORDER BY created_at DESC`, [userId]);
        return res.json(result.rows.map(mapCustomExerciseRow));
    }
    catch (error) {
        console.error("[Exercises] Failed to fetch custom exercises:", error);
        return res.status(500).json({ error: "Failed to fetch custom exercises" });
    }
});
/**
 * POST /api/exercises/custom
 * Create a new custom exercise
 */
router.post("/custom", auth_1.maybeRequireAuth, auth_1.attachUser, planLimits_1.checkCustomExerciseLimit, async (req, res) => {
    const userId = res.locals.userId;
    if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
    }
    const { name, primaryMuscleGroup, secondaryMuscleGroups, equipment, notes, imageUrl, scope, squadId, } = req.body;
    // Validation
    if (!name || typeof name !== "string" || name.trim().length === 0) {
        return res.status(400).json({ error: "Exercise name is required" });
    }
    if (!primaryMuscleGroup ||
        typeof primaryMuscleGroup !== "string" ||
        primaryMuscleGroup.trim().length === 0) {
        return res.status(400).json({ error: "Primary muscle group is required" });
    }
    const validMuscleGroups = [
        "chest",
        "back",
        "shoulders",
        "biceps",
        "triceps",
        "legs",
        "glutes",
        "core",
        "cardio",
        "other",
    ];
    if (!validMuscleGroups.includes(primaryMuscleGroup.toLowerCase())) {
        return res.status(400).json({
            error: `Invalid muscle group. Must be one of: ${validMuscleGroups.join(", ")}`,
        });
    }
    // Squad scope validation
    if (scope === "squad") {
        if (!squadId) {
            return res.status(400).json({ error: "Squad ID is required for squad-scoped exercises" });
        }
        // Verify user is member of squad
        const squadCheck = await (0, db_1.query)(`SELECT 1 FROM squad_members WHERE squad_id = $1 AND user_id = $2`, [squadId, userId]);
        if (squadCheck.rows.length === 0) {
            return res.status(403).json({ error: "You are not a member of this squad" });
        }
    }
    try {
        const exerciseId = (0, nanoid_1.nanoid)();
        await (0, db_1.query)(`INSERT INTO user_exercises (
          id, user_id, name, primary_muscle_group, secondary_muscle_groups,
          equipment, notes, image_url, scope, squad_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`, [
            exerciseId,
            userId,
            name.trim(),
            primaryMuscleGroup.toLowerCase(),
            secondaryMuscleGroups || null,
            equipment || null,
            notes || null,
            imageUrl || null,
            scope || "personal",
            squadId || null,
        ]);
        const result = await (0, db_1.query)(`SELECT * FROM user_exercises WHERE id = $1`, [exerciseId]);
        return res.status(201).json(mapCustomExerciseRow(result.rows[0]));
    }
    catch (error) {
        console.error("[Exercises] Failed to create custom exercise:", error);
        return res.status(500).json({ error: "Failed to create custom exercise" });
    }
});
/**
 * POST /api/exercises/custom/:id/upload-image
 * Upload image for a custom exercise (Pro users get 10MB limit, free users get 5MB)
 */
router.post("/custom/:id/upload-image", auth_1.maybeRequireAuth, auth_1.attachUser, upload.single("image"), async (req, res) => {
    const userId = res.locals.userId;
    const { id: exerciseId } = req.params;
    if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
    }
    if (!req.file) {
        return res.status(400).json({ error: "No image file provided" });
    }
    try {
        // Verify exercise ownership
        const exerciseResult = await (0, db_1.query)(`SELECT * FROM user_exercises WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL`, [exerciseId, userId]);
        if (exerciseResult.rows.length === 0) {
            return res.status(404).json({ error: "Custom exercise not found" });
        }
        const exercise = exerciseResult.rows[0];
        // Get user plan for file size limit
        const userResult = await (0, db_1.query)(`SELECT plan FROM users WHERE id = $1`, [userId]);
        const isPro = userResult.rows[0]?.plan === "pro" || userResult.rows[0]?.plan === "lifetime";
        const maxSizeBytes = isPro ? 10 * 1024 * 1024 : 5 * 1024 * 1024; // 10MB Pro, 5MB Free
        // Validate image
        const validation = (0, cloudinary_1.validateImageBuffer)(req.file.buffer, maxSizeBytes);
        if (!validation.valid) {
            return res.status(400).json({ error: validation.error });
        }
        // Delete old image if exists
        if (exercise.image_url) {
            const oldPublicId = (0, cloudinary_1.extractPublicId)(exercise.image_url);
            if (oldPublicId) {
                try {
                    await (0, cloudinary_1.deleteImage)(oldPublicId);
                }
                catch (error) {
                    console.error("[Exercises] Failed to delete old image:", error);
                    // Continue anyway - non-critical error
                }
            }
        }
        // Upload to Cloudinary
        const uploadResult = await (0, cloudinary_1.uploadImage)(req.file.buffer, "custom-exercises", `${userId}-${exerciseId}`);
        // Update database
        await (0, db_1.query)(`UPDATE user_exercises SET image_url = $1, updated_at = NOW() WHERE id = $2`, [uploadResult.secure_url, exerciseId]);
        return res.json({
            imageUrl: uploadResult.secure_url,
            thumbnailUrl: uploadResult.eager?.[0]?.secure_url,
        });
    }
    catch (error) {
        console.error("[Exercises] Failed to upload image:", error);
        // Return more detailed error for debugging
        const errorMessage = error?.message || "Failed to upload image";
        const errorDetails = error?.http_code ? ` (Cloudinary error: ${error.http_code})` : "";
        return res.status(500).json({
            error: "Failed to upload image",
            details: errorMessage + errorDetails,
            hint: "Check CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET in server/.env"
        });
    }
});
/**
 * PATCH /api/exercises/custom/:id
 * Update a custom exercise
 */
router.patch("/custom/:id", auth_1.maybeRequireAuth, auth_1.attachUser, async (req, res) => {
    const userId = res.locals.userId;
    const { id: exerciseId } = req.params;
    if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
    }
    const { name, primaryMuscleGroup, secondaryMuscleGroups, equipment, notes } = req.body;
    try {
        // Verify ownership
        const checkResult = await (0, db_1.query)(`SELECT * FROM user_exercises WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL`, [exerciseId, userId]);
        if (checkResult.rows.length === 0) {
            return res.status(404).json({ error: "Custom exercise not found" });
        }
        // Check if exercise is used in any workouts
        const usageCheck = await (0, db_1.query)(`SELECT COUNT(*) as count FROM workout_sets WHERE exercise_id = $1`, [exerciseId]);
        const isUsed = parseInt(usageCheck.rows[0]?.count || "0") > 0;
        if (isUsed) {
            return res.status(400).json({
                error: "Cannot edit exercise that has been used in workouts",
                message: "This custom exercise has been used in past workouts. To preserve workout history, please create a new exercise instead.",
            });
        }
        // Build update query dynamically
        const updates = [];
        const values = [];
        let paramIndex = 1;
        if (name !== undefined) {
            updates.push(`name = $${paramIndex++}`);
            values.push(name.trim());
        }
        if (primaryMuscleGroup !== undefined) {
            updates.push(`primary_muscle_group = $${paramIndex++}`);
            values.push(primaryMuscleGroup.toLowerCase());
        }
        if (secondaryMuscleGroups !== undefined) {
            updates.push(`secondary_muscle_groups = $${paramIndex++}`);
            values.push(secondaryMuscleGroups);
        }
        if (equipment !== undefined) {
            updates.push(`equipment = $${paramIndex++}`);
            values.push(equipment);
        }
        if (notes !== undefined) {
            updates.push(`notes = $${paramIndex++}`);
            values.push(notes);
        }
        if (updates.length === 0) {
            return res.status(400).json({ error: "No fields to update" });
        }
        updates.push(`updated_at = NOW()`);
        values.push(exerciseId);
        await (0, db_1.query)(`UPDATE user_exercises SET ${updates.join(", ")} WHERE id = $${paramIndex}`, values);
        const result = await (0, db_1.query)(`SELECT * FROM user_exercises WHERE id = $1`, [exerciseId]);
        return res.json(mapCustomExerciseRow(result.rows[0]));
    }
    catch (error) {
        console.error("[Exercises] Failed to update custom exercise:", error);
        return res.status(500).json({ error: "Failed to update custom exercise" });
    }
});
/**
 * DELETE /api/exercises/custom/:id
 * Soft-delete a custom exercise
 */
router.delete("/custom/:id", auth_1.maybeRequireAuth, auth_1.attachUser, async (req, res) => {
    const userId = res.locals.userId;
    const { id: exerciseId } = req.params;
    if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
    }
    try {
        // Verify ownership
        const exerciseResult = await (0, db_1.query)(`SELECT * FROM user_exercises WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL`, [exerciseId, userId]);
        if (exerciseResult.rows.length === 0) {
            return res.status(404).json({ error: "Custom exercise not found" });
        }
        const exercise = exerciseResult.rows[0];
        // Soft delete (preserve data for historical workouts)
        await (0, db_1.query)(`UPDATE user_exercises SET deleted_at = NOW() WHERE id = $1`, [exerciseId]);
        // Optionally delete image from Cloudinary to save storage
        if (exercise.image_url) {
            const publicId = (0, cloudinary_1.extractPublicId)(exercise.image_url);
            if (publicId) {
                try {
                    await (0, cloudinary_1.deleteImage)(publicId);
                }
                catch (error) {
                    console.error("[Exercises] Failed to delete image:", error);
                    // Continue anyway - non-critical error
                }
            }
        }
        return res.status(204).send();
    }
    catch (error) {
        console.error("[Exercises] Failed to delete custom exercise:", error);
        return res.status(500).json({ error: "Failed to delete custom exercise" });
    }
});
/**
 * GET /api/exercises/search (updated to include custom exercises)
 * Search both library and custom exercises
 */
router.get("/search-all", auth_1.maybeRequireAuth, auth_1.attachUser, async (req, res) => {
    const userId = res.locals.userId;
    const { query: search, muscleGroup } = req.query;
    const searchValue = typeof search === "string" ? search.toLowerCase() : "";
    const muscleValue = typeof muscleGroup === "string" ? muscleGroup.toLowerCase() : "";
    const musclePattern = muscleValue ? `%${muscleValue}%` : "";
    try {
        // Search library exercises
        const libraryResults = await (0, db_1.query)(`
        SELECT id, name, primary_muscle_group, equipment, category, image_paths
        FROM exercises
        WHERE ($1 = '' OR LOWER(name) LIKE $2)
          AND ($3 = '' OR LOWER(primary_muscle_group) LIKE $3)
        ORDER BY name ASC
        LIMIT 50
      `, [searchValue, `%${searchValue}%`, musclePattern]);
        // Search custom exercises (if authenticated)
        let customResults = [];
        if (userId) {
            const customQuery = await (0, db_1.query)(`
          SELECT * FROM user_exercises
          WHERE user_id = $1
            AND deleted_at IS NULL
            AND ($2 = '' OR LOWER(name) LIKE $3)
            AND ($4 = '' OR LOWER(primary_muscle_group) LIKE $4)
          ORDER BY name ASC
          LIMIT 50
        `, [userId, searchValue, `%${searchValue}%`, musclePattern]);
            customResults = customQuery.rows;
        }
        // Combine and format results
        const library = libraryResults.rows.map((row) => ({
            ...mapExerciseRow(row),
            isCustom: false,
        }));
        const custom = customResults.map((row) => ({
            id: row.id,
            name: row.name,
            primaryMuscleGroup: row.primary_muscle_group,
            equipment: row.equipment || "bodyweight",
            category: "custom",
            gifUrl: row.image_url || undefined,
            isCustom: true,
            createdBy: row.user_id,
        }));
        return res.json({
            library,
            custom,
            total: library.length + custom.length,
        });
    }
    catch (error) {
        console.error("[Exercises] Failed to search exercises:", error);
        return res.status(500).json({ error: "Failed to search exercises" });
    }
});
exports.default = router;
