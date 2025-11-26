import fs from "fs";
import path from "path";

/**
 * Locate the bundled exercises.json in both dev (src) and production (dist) environments.
 * Render wasn't copying the static dataset, so we try multiple fallbacks to avoid crashes.
 */
export const resolveExercisesPath = () => {
  const candidates = [
    // When running compiled code
    path.join(__dirname, "../data/dist/exercises.json"),
    // When running from repository root or during build
    path.resolve(process.cwd(), "dist/data/dist/exercises.json"),
    path.resolve(process.cwd(), "src/data/dist/exercises.json"),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  console.error("[Exercises] Database not found. Tried paths:", candidates);
  return null;
};

export const loadExercisesJson = <T = any>() => {
  const filePath = resolveExercisesPath();
  if (!filePath) return [] as T[];

  try {
    return JSON.parse(fs.readFileSync(filePath, "utf-8")) as T[];
  } catch (error) {
    console.error(`[Exercises] Failed to read ${filePath}:`, error);
    return [] as T[];
  }
};
