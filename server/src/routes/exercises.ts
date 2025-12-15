import express, { Router } from "express";
import path from "path";
import multer from "multer";
import { query } from "../db";
import { fetchExerciseMetaByIds, ExerciseMeta } from "../utils/exerciseCatalog";
import { generateId } from "../utils/id";
import { maybeRequireAuth, attachUser } from "../middleware/auth";
import { checkCustomExerciseLimit } from "../middleware/planLimits";
import { uploadImage, validateImageBuffer, deleteImage, extractPublicId } from "../services/cloudinary";

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
});

type ExerciseRow = {
  id: string;
  name: string;
  primary_muscle_group: string | null;
  equipment: string | null;
  category: string | null;
  image_paths: string[] | null;
};

const mapExerciseRow = (row: ExerciseRow): ExerciseMeta => {
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
const imagesDirDist = path.join(__dirname, "../data/dist");
const imagesDirLegacy = path.join(__dirname, "../data/exercises");
router.use("/assets", express.static(imagesDirDist));
router.use("/assets", express.static(imagesDirLegacy));

router.get("/search", async (req, res) => {
  const { query: search, muscleGroup } = req.query;
  const searchValue = typeof search === "string" ? search.toLowerCase() : "";
  const muscleValue =
    typeof muscleGroup === "string" ? muscleGroup.toLowerCase() : "";
  const musclePattern = muscleValue ? `%${muscleValue}%` : "";

  try {
    const results = await query<ExerciseRow>(
      `
        SELECT id, name, primary_muscle_group, equipment, category, image_paths
        FROM exercises
        WHERE ($1 = '' OR LOWER(name) LIKE $2)
          AND ($3 = '' OR LOWER(primary_muscle_group) LIKE $3)
        ORDER BY name ASC
        LIMIT 100
      `,
      [searchValue, `%${searchValue}%`, musclePattern]
    );

    return res.json(results.rows.map(mapExerciseRow));
  } catch (err) {
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
    const metaMap = await fetchExerciseMetaByIds(requestedIds);
    const results = requestedIds
      .map((id) => metaMap.get(id))
      .filter((ex): ex is ExerciseMeta => Boolean(ex));

    return res.json(results);
  } catch (err) {
    console.error("Failed to load exercises batch", err);
    return res.status(500).json({ error: "Failed to load exercises" });
  }
});

// ==================== CUSTOM EXERCISES ====================

type CustomExerciseRow = {
  id: string;
  user_id: string;
  name: string;
  primary_muscle_group: string;
  secondary_muscle_groups: string[] | null;
  equipment: string | null;
  notes: string | null;
  image_url: string | null;
  scope: 'personal' | 'squad';
  squad_id: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

const mapCustomExerciseRow = (row: CustomExerciseRow) => ({
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
router.get("/custom", maybeRequireAuth, attachUser, async (req, res) => {
  const userId = res.locals.userId;

  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const result = await query<CustomExerciseRow>(
      `SELECT * FROM user_exercises
       WHERE user_id = $1 AND deleted_at IS NULL
       ORDER BY created_at DESC`,
      [userId]
    );

    return res.json(result.rows.map(mapCustomExerciseRow));
  } catch (error) {
    console.error("[Exercises] Failed to fetch custom exercises:", error);
    return res.status(500).json({ error: "Failed to fetch custom exercises" });
  }
});

/**
 * POST /api/exercises/custom
 * Create a new custom exercise
 */
router.post(
  "/custom",
  maybeRequireAuth,
  attachUser,
  checkCustomExerciseLimit,
  async (req, res) => {
    const userId = res.locals.userId;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const {
      name,
      primaryMuscleGroup,
      secondaryMuscleGroups,
      equipment,
      notes,
      imageUrl,
      scope,
      squadId,
    } = req.body;

    // Validation
    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return res.status(400).json({ error: "Exercise name is required" });
    }

    if (
      !primaryMuscleGroup ||
      typeof primaryMuscleGroup !== "string" ||
      primaryMuscleGroup.trim().length === 0
    ) {
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
      const squadCheck = await query(
        `SELECT 1 FROM squad_members WHERE squad_id = $1 AND user_id = $2`,
        [squadId, userId]
      );

      if (squadCheck.rows.length === 0) {
        return res.status(403).json({ error: "You are not a member of this squad" });
      }
    }

    try {
      const exerciseId = generateId();

      await query(
        `INSERT INTO user_exercises (
          id, user_id, name, primary_muscle_group, secondary_muscle_groups,
          equipment, notes, image_url, scope, squad_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
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
        ]
      );

      const result = await query<CustomExerciseRow>(
        `SELECT * FROM user_exercises WHERE id = $1`,
        [exerciseId]
      );

      return res.status(201).json(mapCustomExerciseRow(result.rows[0]));
    } catch (error) {
      console.error("[Exercises] Failed to create custom exercise:", error);
      return res.status(500).json({ error: "Failed to create custom exercise" });
    }
  }
);

/**
 * POST /api/exercises/custom/:id/upload-image
 * Upload image for a custom exercise (Pro users get 10MB limit, free users get 5MB)
 */
router.post(
  "/custom/:id/upload-image",
  maybeRequireAuth,
  attachUser,
  upload.single("image"),
  async (req, res) => {
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
      const exerciseResult = await query<CustomExerciseRow>(
        `SELECT * FROM user_exercises WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL`,
        [exerciseId, userId]
      );

      if (exerciseResult.rows.length === 0) {
        return res.status(404).json({ error: "Custom exercise not found" });
      }

      const exercise = exerciseResult.rows[0];

      // Get user plan for file size limit
      const userResult = await query<{ plan: string }>(
        `SELECT plan FROM users WHERE id = $1`,
        [userId]
      );

      const isPro =
        userResult.rows[0]?.plan === "pro" || userResult.rows[0]?.plan === "lifetime";
      const maxSizeBytes = isPro ? 10 * 1024 * 1024 : 5 * 1024 * 1024; // 10MB Pro, 5MB Free

      // Validate image
      const validation = validateImageBuffer(req.file.buffer, maxSizeBytes);
      if (!validation.valid) {
        return res.status(400).json({ error: validation.error });
      }

      // Delete old image if exists
      if (exercise.image_url) {
        const oldPublicId = extractPublicId(exercise.image_url);
        if (oldPublicId) {
          try {
            await deleteImage(oldPublicId);
          } catch (error) {
            console.error("[Exercises] Failed to delete old image:", error);
            // Continue anyway - non-critical error
          }
        }
      }

      // Upload to Cloudinary
      const uploadResult = await uploadImage(
        req.file.buffer,
        "custom-exercises",
        `${userId}-${exerciseId}`
      );

      // Update database
      await query(
        `UPDATE user_exercises SET image_url = $1, updated_at = NOW() WHERE id = $2`,
        [uploadResult.secure_url, exerciseId]
      );

      return res.json({
        imageUrl: uploadResult.secure_url,
        thumbnailUrl: uploadResult.eager?.[0]?.secure_url,
      });
    } catch (error: any) {
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
  }
);

/**
 * PATCH /api/exercises/custom/:id
 * Update a custom exercise
 */
router.patch("/custom/:id", maybeRequireAuth, attachUser, async (req, res) => {
  const userId = res.locals.userId;
  const { id: exerciseId } = req.params;

  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { name, primaryMuscleGroup, secondaryMuscleGroups, equipment, notes } = req.body;

  try {
    // Verify ownership
    const checkResult = await query<CustomExerciseRow>(
      `SELECT * FROM user_exercises WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL`,
      [exerciseId, userId]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: "Custom exercise not found" });
    }

    // Check if exercise is used in any workouts
    const usageCheck = await query(
      `SELECT COUNT(*) as count FROM workout_sets WHERE exercise_id = $1`,
      [exerciseId]
    );

    const isUsed = parseInt(usageCheck.rows[0]?.count || "0") > 0;

    if (isUsed) {
      return res.status(400).json({
        error: "Cannot edit exercise that has been used in workouts",
        message:
          "This custom exercise has been used in past workouts. To preserve workout history, please create a new exercise instead.",
      });
    }

    // Build update query dynamically
    const updates: string[] = [];
    const values: unknown[] = [];
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

    await query(
      `UPDATE user_exercises SET ${updates.join(", ")} WHERE id = $${paramIndex}`,
      values
    );

    const result = await query<CustomExerciseRow>(
      `SELECT * FROM user_exercises WHERE id = $1`,
      [exerciseId]
    );

    return res.json(mapCustomExerciseRow(result.rows[0]));
  } catch (error) {
    console.error("[Exercises] Failed to update custom exercise:", error);
    return res.status(500).json({ error: "Failed to update custom exercise" });
  }
});

/**
 * DELETE /api/exercises/custom/:id
 * Soft-delete a custom exercise
 */
router.delete("/custom/:id", maybeRequireAuth, attachUser, async (req, res) => {
  const userId = res.locals.userId;
  const { id: exerciseId } = req.params;

  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    // Verify ownership
    const exerciseResult = await query<CustomExerciseRow>(
      `SELECT * FROM user_exercises WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL`,
      [exerciseId, userId]
    );

    if (exerciseResult.rows.length === 0) {
      return res.status(404).json({ error: "Custom exercise not found" });
    }

    const exercise = exerciseResult.rows[0];

    // Soft delete (preserve data for historical workouts)
    await query(`UPDATE user_exercises SET deleted_at = NOW() WHERE id = $1`, [exerciseId]);

    // Optionally delete image from Cloudinary to save storage
    if (exercise.image_url) {
      const publicId = extractPublicId(exercise.image_url);
      if (publicId) {
        try {
          await deleteImage(publicId);
        } catch (error) {
          console.error("[Exercises] Failed to delete image:", error);
          // Continue anyway - non-critical error
        }
      }
    }

    return res.status(204).send();
  } catch (error) {
    console.error("[Exercises] Failed to delete custom exercise:", error);
    return res.status(500).json({ error: "Failed to delete custom exercise" });
  }
});

/**
 * GET /api/exercises/search (updated to include custom exercises)
 * Search both library and custom exercises
 */
router.get("/search-all", maybeRequireAuth, attachUser, async (req, res) => {
  const userId = res.locals.userId;
  const { query: search, muscleGroup } = req.query;
  const searchValue = typeof search === "string" ? search.toLowerCase() : "";
  const muscleValue =
    typeof muscleGroup === "string" ? muscleGroup.toLowerCase() : "";
  const musclePattern = muscleValue ? `%${muscleValue}%` : "";

  try {
    // Search library exercises
    const libraryResults = await query<ExerciseRow>(
      `
        SELECT id, name, primary_muscle_group, equipment, category, image_paths
        FROM exercises
        WHERE ($1 = '' OR LOWER(name) LIKE $2)
          AND ($3 = '' OR LOWER(primary_muscle_group) LIKE $3)
        ORDER BY name ASC
        LIMIT 50
      `,
      [searchValue, `%${searchValue}%`, musclePattern]
    );

    // Search custom exercises (if authenticated)
    let customResults: CustomExerciseRow[] = [];
    if (userId) {
      const customQuery = await query<CustomExerciseRow>(
        `
          SELECT * FROM user_exercises
          WHERE user_id = $1
            AND deleted_at IS NULL
            AND ($2 = '' OR LOWER(name) LIKE $3)
            AND ($4 = '' OR LOWER(primary_muscle_group) LIKE $4)
          ORDER BY name ASC
          LIMIT 50
        `,
        [userId, searchValue, `%${searchValue}%`, musclePattern]
      );
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
  } catch (error) {
    console.error("[Exercises] Failed to search exercises:", error);
    return res.status(500).json({ error: "Failed to search exercises" });
  }
});

export default router;
