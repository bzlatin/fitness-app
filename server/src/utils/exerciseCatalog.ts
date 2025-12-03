import { query } from "../db";

type ExerciseRow = {
  id: string;
  name: string;
  primary_muscle_group: string | null;
  equipment: string | null;
  category: string | null;
  image_paths: string[] | null;
};

export type ExerciseMeta = {
  id: string;
  name: string;
  primaryMuscleGroup: string;
  equipment: string;
  category?: string;
  gifUrl?: string;
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

export const fetchExerciseCatalog = async (): Promise<ExerciseMeta[]> => {
  const result = await query<ExerciseRow>(
    `SELECT id, name, primary_muscle_group, equipment, category, image_paths FROM exercises`
  );
  return result.rows.map(mapExerciseRow);
};

export const fetchExerciseMetaByIds = async (
  ids: string[]
): Promise<Map<string, ExerciseMeta>> => {
  if (!ids.length) return new Map();
  const result = await query<ExerciseRow>(
    `SELECT id, name, primary_muscle_group, equipment, category, image_paths
     FROM exercises
     WHERE id = ANY($1::text[])`,
    [ids]
  );

  const map = new Map<string, ExerciseMeta>();
  result.rows.forEach((row) => {
    const meta = mapExerciseRow(row);
    map.set(meta.id, meta);
  });
  return map;
};
