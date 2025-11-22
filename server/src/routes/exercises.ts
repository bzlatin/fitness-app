import express, { Router } from "express";
import path from "path";
import fs from "fs";
import { exercises as localExercises } from "../data/exercises";

const router = Router();

// Load the big local dataset from dist.
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

const normalizeExercise = (item: LocalExercise) => {
  const primary =
    item.primaryMuscles?.[0] ||
    (Array.isArray((item as any).primaryMuscleGroup)
      ? (item as any).primaryMuscleGroup[0]
      : (item as any).primaryMuscleGroup) ||
    "other";
  const equipment =
    item.equipment ||
    (Array.isArray((item as any).equipments)
      ? (item as any).equipments[0]
      : (item as any).equipments) ||
    "bodyweight";

  const images = item.images ?? [];
  const imageUrl =
    images.length > 0 ? `/api/exercises/assets/${images[0]}` : undefined;

  return {
    id: item.id || dedupeId(item.name),
    name: item.name,
    primaryMuscleGroup: primary.toLowerCase(),
    equipment: equipment.toLowerCase(),
    category: item.category?.toLowerCase(),
    gifUrl: imageUrl,
  };
};

// Serve static exercise images (dist dataset first, then raw exercises folder as fallback)
const imagesDirDist = path.join(__dirname, "../data/dist");
const imagesDirLegacy = path.join(__dirname, "../data/exercises");
router.use("/assets", express.static(imagesDirDist));
router.use("/assets", express.static(imagesDirLegacy));

router.get("/search", (req, res) => {
  const { query, muscleGroup } = req.query;
  const searchValue = typeof query === "string" ? query.toLowerCase() : "";
  const muscleValue =
    typeof muscleGroup === "string" ? muscleGroup.toLowerCase() : "";

  const source = largeExercises.length > 0 ? largeExercises : localExercises;

  const results = source
    .map(normalizeExercise)
    .filter((ex) => {
      const matchesQuery =
        !searchValue || ex.name.toLowerCase().includes(searchValue);
      const matchesMuscle =
        !muscleValue ||
        ex.primaryMuscleGroup.toLowerCase().includes(muscleValue);
      return matchesQuery && matchesMuscle;
    })
    .slice(0, 100);

  return res.json(results);
});

// Batch fetch exercises by IDs
router.get("/batch", (req, res) => {
  const { ids } = req.query;

  if (!ids || typeof ids !== "string") {
    return res.json([]);
  }

  const requestedIds = ids.split(",").map((id) => id.trim());
  const source = largeExercises.length > 0 ? largeExercises : localExercises;

  const results = source
    .map(normalizeExercise)
    .filter((ex) => requestedIds.includes(ex.id));

  return res.json(results);
});

export default router;
