import express, { Router } from "express";
import path from "path";
import { query } from "../db";
import { fetchExerciseMetaByIds, ExerciseMeta } from "../utils/exerciseCatalog";

const router = Router();

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

export default router;
