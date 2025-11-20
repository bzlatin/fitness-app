import { Router } from "express";
import { exercises as localExercises } from "../data/exercises";

type ExerciseDbItem = {
  exerciseId: string;
  name: string;
  gifUrl?: string;
  targetMuscles?: string[];
  bodyParts?: string[];
  equipments?: string[];
  secondaryMuscles?: string[];
  instructions?: string[];
};

const router = Router();

const EXERCISEDB_BASE_URL =
  process.env.EXERCISEDB_BASE_URL || "https://www.exercisedb.dev/api/v1";
const EXERCISEDB_API_KEY = process.env.EXERCISEDB_API_KEY;
const EXERCISEDB_RAPID_HOST = process.env.EXERCISEDB_RAPID_HOST;

const mapExercise = (item: ExerciseDbItem) => ({
  id: item.exerciseId,
  name: item.name,
  primaryMuscleGroup:
    item.targetMuscles?.[0] ||
    item.bodyParts?.[0] ||
    item.secondaryMuscles?.[0] ||
    "Unknown",
  equipment: item.equipments?.[0] || "Bodyweight",
  gifUrl: item.gifUrl,
});

// Proxy to ExerciseDB search endpoint with optional muscle group filtering.
router.get("/search", async (req, res) => {
  const { query, muscleGroup } = req.query;
  const params = new URLSearchParams();
  const searchValue = typeof query === "string" ? query : "";
  const searchParamKey = EXERCISEDB_BASE_URL.includes("rapidapi") ? "search" : "query";

  if (searchValue) {
    params.set(searchParamKey, searchValue);
  } else {
    // RapidAPI list endpoint supports offset/limit
    params.set("offset", "0");
  }
  params.set("limit", "30");

  try {
    const path = searchValue ? "/exercises/search" : "/exercises";
    const url = `${EXERCISEDB_BASE_URL}${path}?${params.toString()}`;
    const headers: Record<string, string> = { Accept: "application/json" };
    if (EXERCISEDB_RAPID_HOST && EXERCISEDB_API_KEY) {
      headers["x-rapidapi-key"] = EXERCISEDB_API_KEY;
      headers["x-rapidapi-host"] = EXERCISEDB_RAPID_HOST;
    } else if (EXERCISEDB_API_KEY) {
      headers["x-api-key"] = EXERCISEDB_API_KEY;
    }

    const response = await fetch(url, { headers });
    if (!response.ok) {
      throw new Error(`ExerciseDB error: ${response.status} ${response.statusText}`);
    }

    const json = await response.json();
    const items: ExerciseDbItem[] = Array.isArray(json)
      ? json
      : json.data ?? json.results ?? [];

    const filtered = items.filter((item) => {
      if (!muscleGroup || typeof muscleGroup !== "string") return true;
      const target = muscleGroup.toLowerCase();
      const groups = [
        ...(item.targetMuscles ?? []),
        ...(item.bodyParts ?? []),
        ...(item.secondaryMuscles ?? []),
      ];
      return groups.some((g) => g.toLowerCase().includes(target));
    });

    return res.json(filtered.map(mapExercise));
  } catch (err) {
    console.error("ExerciseDB fetch failed, falling back to local data", err);
    const fallback = localExercises.filter((ex) => {
      const matchesQuery =
        !searchValue ||
        ex.name.toLowerCase().includes(searchValue.toLowerCase());
      const matchesMuscle =
        !muscleGroup ||
        (typeof muscleGroup === "string" &&
          ex.primaryMuscleGroup.toLowerCase().includes(muscleGroup.toLowerCase()));
      return matchesQuery && matchesMuscle;
    });
    return res.json(
      fallback.map((ex) => ({
        id: ex.id,
        name: ex.name,
        primaryMuscleGroup: ex.primaryMuscleGroup,
        equipment: ex.equipment,
        gifUrl: ex.gifUrl,
      }))
    );
  }
});

// Legacy local listing for internal use/testing.
router.get("/", (req, res) => {
  const { muscleGroup, equipment } = req.query;

  let results = localExercises;
  if (muscleGroup && typeof muscleGroup === "string") {
    results = results.filter((ex) => ex.primaryMuscleGroup === muscleGroup);
  }
  if (equipment && typeof equipment === "string") {
    results = results.filter((ex) => ex.equipment === equipment);
  }

  res.json(results);
});

export default router;
