import fs from "fs";
import path from "path";
import { query } from "../db";
import { Exercise, MuscleGroup } from "../types/workouts";
import { exercises as localExercises } from "../data/exercises";
import { MuscleFatigueData, RecentWorkout } from "./ai/AIProvider.interface";

export type MuscleFatigue = {
  muscleGroup: string;
  last7DaysVolume: number;
  baselineVolume: number | null;
  fatigueScore: number;
  status: "under-trained" | "optimal" | "moderate-fatigue" | "high-fatigue" | "no-data";
  color: "green" | "blue" | "yellow" | "red" | "gray";
  fatigued: boolean;
  underTrained: boolean;
  baselineMissing: boolean;
};

export type FatigueResult = {
  generatedAt: string;
  windowDays: 7;
  baselineWeeks: 4;
  perMuscle: MuscleFatigue[];
  deloadWeekDetected: boolean;
  readinessScore: number;
  freshMuscles: string[];
  lastWorkoutAt: string | null;
  totals: {
    last7DaysVolume: number;
    baselineVolume: number | null;
    fatigueScore: number;
  };
};

export type TrainingRecommendation = {
  targetMuscles: string[];
  recommendedWorkouts: Array<{
    id: string;
    name: string;
    muscleGroups: string[];
    reason: string;
  }>;
};

type RawExercise = {
  id?: string;
  name: string;
  primaryMuscles?: string[];
  primaryMuscleGroup?: string | string[];
  equipment?: string;
  equipments?: string[];
};

type VolumeRow = {
  muscle_group: string | null;
  volume: string;
};

type TemplateMuscleRow = {
  id: string;
  name: string;
  split_type: string | null;
  muscle_groups: string[] | null;
};

const BODYWEIGHT_FALLBACK_LBS = 100;
const TRACKED_MUSCLES: MuscleGroup[] = [
  "chest",
  "back",
  "shoulders",
  "biceps",
  "triceps",
  "legs",
  "glutes",
  "core",
];

const distExercisesPath = path.join(__dirname, "../data/dist/exercises.json");

const statusColorMap: Record<MuscleFatigue["status"], MuscleFatigue["color"]> = {
  "under-trained": "green",
  optimal: "blue",
  "moderate-fatigue": "yellow",
  "high-fatigue": "red",
  "no-data": "gray",
};

const statusOrder: Record<MuscleFatigue["status"], number> = {
  "high-fatigue": 0,
  "moderate-fatigue": 1,
  optimal: 2,
  "under-trained": 3,
  "no-data": 4,
};

const safeDivide = (numerator: number, denominator: number | null | undefined) => {
  if (!denominator || denominator === 0) return 0;
  return numerator / denominator;
};

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

const statusFromScore = (score: number, hasData: boolean): MuscleFatigue["status"] => {
  if (!hasData) return "no-data";
  if (score < 70) return "under-trained";
  if (score < 110) return "optimal";
  if (score < 130) return "moderate-fatigue";
  return "high-fatigue";
};

const normalizeExercise = (item: RawExercise): Exercise => {
  const primary =
    item.primaryMuscles?.[0] ||
    (Array.isArray(item.primaryMuscleGroup)
      ? item.primaryMuscleGroup[0]
      : item.primaryMuscleGroup) ||
    "other";
  const equipment =
    item.equipment ||
    (Array.isArray(item.equipments) ? item.equipments[0] : item.equipments) ||
    "bodyweight";

  return {
    id: item.id || item.name.replace(/\s+/g, "_"),
    name: item.name,
    primaryMuscleGroup: primary.toLowerCase() as MuscleGroup,
    equipment: equipment.toLowerCase() as Exercise["equipment"],
  };
};

let cachedExercises: Exercise[] | null = null;
const getExerciseCatalog = (): Exercise[] => {
  if (cachedExercises) return cachedExercises;
  const rawExercises: RawExercise[] = fs.existsSync(distExercisesPath)
    ? JSON.parse(fs.readFileSync(distExercisesPath, "utf-8"))
    : localExercises;

  const deduped = new Map<string, Exercise>();
  rawExercises
    .map(normalizeExercise)
    .forEach((ex) => deduped.set(ex.id, ex));

  cachedExercises = Array.from(deduped.values());
  return cachedExercises;
};

let exercisesSeeded = false;
const chunk = <T>(items: T[], size: number) => {
  const result: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    result.push(items.slice(i, i + size));
  }
  return result;
};

const seedExercisesTable = async () => {
  if (exercisesSeeded) return;
  const catalog = getExerciseCatalog();
  if (catalog.length === 0) {
    exercisesSeeded = true;
    return;
  }

  const batches = chunk(catalog, 200);
  for (const batch of batches) {
    const values = batch
      .map(
        (_ex, idx) =>
          `($${idx * 4 + 1}, $${idx * 4 + 2}, $${idx * 4 + 3}, $${idx * 4 + 4})`
      )
      .join(", ");
    const params = batch.flatMap((ex) => [
      ex.id,
      ex.name,
      ex.primaryMuscleGroup,
      ex.equipment,
    ]);

    await query(
      `
        INSERT INTO exercises (id, name, primary_muscle_group, equipment)
        VALUES ${values}
        ON CONFLICT (id) DO UPDATE
          SET name = EXCLUDED.name,
              primary_muscle_group = COALESCE(EXCLUDED.primary_muscle_group, exercises.primary_muscle_group),
              equipment = COALESCE(EXCLUDED.equipment, exercises.equipment)
      `,
      params
    );
  }
  exercisesSeeded = true;
};

const subtractDays = (date: Date, days: number) => {
  const copy = new Date(date);
  copy.setDate(copy.getDate() - days);
  return copy;
};

const fetchVolumeByMuscle = async (userId: string, start: Date, end: Date) => {
  await seedExercisesTable();
  const result = await query<VolumeRow>(
    `
      SELECT
        COALESCE(e.primary_muscle_group, 'other') as muscle_group,
        SUM(
          COALESCE(ws.actual_reps, ws.target_reps, 0) *
          COALESCE(
            ws.actual_weight,
            ws.target_weight,
            CASE WHEN COALESCE(e.equipment, 'bodyweight') = 'bodyweight' THEN $4 ELSE 0 END
          )
        ) as volume
      FROM workout_sets ws
      JOIN workout_sessions s ON s.id = ws.session_id
      LEFT JOIN exercises e ON e.id = ws.exercise_id
      WHERE s.user_id = $1
        AND s.finished_at IS NOT NULL
        AND s.finished_at >= $2
        AND s.finished_at < $3
      GROUP BY COALESCE(e.primary_muscle_group, 'other')
    `,
    [userId, start.toISOString(), end.toISOString(), BODYWEIGHT_FALLBACK_LBS]
  );

  const volumes = new Map<string, number>();
  result.rows.forEach((row) => {
    volumes.set(row.muscle_group ?? "other", Number(row.volume) || 0);
  });
  return volumes;
};

const sortMuscles = (items: MuscleFatigue[]) =>
  [...items].sort((a, b) => {
    const statusDiff = statusOrder[a.status] - statusOrder[b.status];
    if (statusDiff !== 0) return statusDiff;
    if (a.status === "under-trained") {
      return a.fatigueScore - b.fatigueScore;
    }
    return b.fatigueScore - a.fatigueScore;
  });

export const getFatigueScores = async (userId: string): Promise<FatigueResult> => {
  const now = new Date();
  const last7Start = subtractDays(now, 7);
  const baselineStart = subtractDays(now, 35);
  const baselineEnd = subtractDays(now, 7);

  const [last7Volumes, baselineVolumes] = await Promise.all([
    fetchVolumeByMuscle(userId, last7Start, now),
    fetchVolumeByMuscle(userId, baselineStart, baselineEnd),
  ]);

  const muscles = new Set<string>([
    ...TRACKED_MUSCLES,
    ...last7Volumes.keys(),
    ...baselineVolumes.keys(),
  ]);

  const perMuscle: MuscleFatigue[] = [];
  let last7Total = 0;
  let baselineTotalWeekly = 0;

  muscles.forEach((muscle) => {
    const last7 = last7Volumes.get(muscle) ?? 0;
    const baselineWeekly = (baselineVolumes.get(muscle) ?? 0) / 4;
    const baselineMissing = baselineWeekly === 0;
    const hasAnyData = last7 > 0 || !baselineMissing;

    const fatigueScore = baselineMissing
      ? last7 > 0
        ? 100
        : 0
      : safeDivide(last7, baselineWeekly) * 100;

    const status =
      !hasAnyData && baselineMissing
        ? "no-data"
        : statusFromScore(fatigueScore, hasAnyData);

    const entry: MuscleFatigue = {
      muscleGroup: muscle,
      last7DaysVolume: last7,
      baselineVolume: baselineMissing ? null : baselineWeekly,
      fatigueScore,
      status,
      color: statusColorMap[status],
      fatigued: fatigueScore > 130,
      underTrained: fatigueScore > 0 && fatigueScore < 70,
      baselineMissing,
    };

    last7Total += last7;
    baselineTotalWeekly += baselineWeekly;
    perMuscle.push(entry);
  });

  const totalsBaseline = baselineTotalWeekly > 0 ? baselineTotalWeekly : null;
  const totalFatigueScore =
    totalsBaseline === null
      ? last7Total > 0
        ? 100
        : 0
      : safeDivide(last7Total, totalsBaseline) * 100;

  const readinessScore = clamp(150 - totalFatigueScore, 0, 100);

  const freshMuscles = perMuscle
    .filter((m) => m.status === "under-trained" || m.fatigueScore <= 90)
    .map((m) => m.muscleGroup);

  const lastWorkoutRow = await query<{ finished_at: string }>(
    `
      SELECT finished_at
      FROM workout_sessions
      WHERE user_id = $1
        AND finished_at IS NOT NULL
      ORDER BY finished_at DESC
      LIMIT 1
    `,
    [userId]
  );

  return {
    generatedAt: now.toISOString(),
    windowDays: 7,
    baselineWeeks: 4,
    perMuscle: sortMuscles(perMuscle),
    deloadWeekDetected:
      totalsBaseline !== null ? last7Total < totalsBaseline * 0.5 : false,
    readinessScore,
    freshMuscles,
    lastWorkoutAt: lastWorkoutRow.rows[0]?.finished_at || null,
    totals: {
      last7DaysVolume: last7Total,
      baselineVolume: totalsBaseline,
      fatigueScore: totalFatigueScore,
    },
  };
};

const fetchTemplatesWithMuscles = async (userId: string) => {
  await seedExercisesTable();
  const result = await query<TemplateMuscleRow>(
    `
      SELECT
        t.id,
        t.name,
        t.split_type,
        ARRAY_REMOVE(ARRAY_AGG(DISTINCT COALESCE(e.primary_muscle_group, 'other')), NULL) as muscle_groups
      FROM workout_templates t
      LEFT JOIN workout_template_exercises te ON te.template_id = t.id
      LEFT JOIN exercises e ON e.id = te.exercise_id
      WHERE t.user_id = $1
      GROUP BY t.id
    `,
    [userId]
  );

  return result.rows.map((row) => ({
    id: row.id,
    name: row.name,
    splitType: row.split_type ?? undefined,
    muscleGroups: (row.muscle_groups ?? []).filter(Boolean),
  }));
};

export const getTrainingRecommendations = async (
  userId: string,
  existingFatigue?: FatigueResult
): Promise<TrainingRecommendation> => {
  const fatigue = existingFatigue ?? (await getFatigueScores(userId));
  const fatigueList = fatigue.perMuscle;

  const underTrained = fatigueList.filter((m) => m.underTrained);
  const fatigued = fatigueList.filter((m) => m.fatigued);
  const optimal = fatigueList.filter((m) => m.status === "optimal");

  const targetMuscles =
    underTrained.length > 0
      ? underTrained.map((m) => m.muscleGroup)
      : optimal
          .filter((m) => !fatigued.some((f) => f.muscleGroup === m.muscleGroup))
          .map((m) => m.muscleGroup);

  const avoidMuscles = new Set(fatigued.map((m) => m.muscleGroup));
  const targetSet = new Set(targetMuscles);

  const templatesWithFlags = (await fetchTemplatesWithMuscles(userId)).map((tpl) => ({
    ...tpl,
    hitsTarget: tpl.muscleGroups.some((g) => targetSet.has(g)),
    hitsAvoid: tpl.muscleGroups.some((g) => avoidMuscles.has(g)),
  }));

  const actionableTemplates = templatesWithFlags.filter((tpl) => tpl.hitsTarget && !tpl.hitsAvoid);

  const rankedTemplates =
    actionableTemplates.length > 0
      ? actionableTemplates
      : templatesWithFlags.filter((tpl) => !tpl.hitsAvoid);

  const recommendations = rankedTemplates.slice(0, 3).map((tpl) => ({
    id: tpl.id,
    name: tpl.name,
    muscleGroups: tpl.muscleGroups,
    reason: tpl.hitsTarget
      ? `Targets ${tpl.muscleGroups.filter((g) => targetSet.has(g)).join(", ")}`
      : "Balanced option while avoiding fatigued muscles",
  }));

  if (recommendations.length === 0) {
    return {
      targetMuscles: targetMuscles.slice(0, 3),
      recommendedWorkouts: [
        {
          id: "fallback-full-body",
          name: "Full Body / Mobility",
          muscleGroups: ["full_body"],
          reason: "Light full-body or mobility session recommended while data is limited",
        },
      ],
    };
  }

  return {
    targetMuscles: targetMuscles.slice(0, 3),
    recommendedWorkouts: recommendations,
  };
};

/**
 * Legacy helper retained for AI prompt compatibility.
 * Returns a map of muscle group -> fatigue score (0-200+).
 */
export const calculateMuscleFatigue = async (
  userId: string
): Promise<MuscleFatigueData> => {
  const result = await getFatigueScores(userId);
  return result.perMuscle.reduce<MuscleFatigueData>((acc, item) => {
    acc[item.muscleGroup as keyof MuscleFatigueData] = Math.round(item.fatigueScore);
    return acc;
  }, {});
};

/**
 * Fetch recent workout history for AI context
 */
export const getRecentWorkouts = async (
  userId: string,
  limit: number = 5
): Promise<RecentWorkout[]> => {
  try {
    const sessionsResult = await query<{
      session_id: string;
      template_name: string;
      split_type: string;
      finished_at: string;
    }>(
      `
      SELECT
        ws.id as session_id,
        COALESCE(wt.name, 'Unnamed Workout') as template_name,
        wt.split_type,
        ws.finished_at
      FROM workout_sessions ws
      LEFT JOIN workout_templates wt ON ws.template_id = wt.id
      WHERE ws.user_id = $1
        AND ws.finished_at IS NOT NULL
      ORDER BY ws.finished_at DESC
      LIMIT $2
    `,
      [userId, limit]
    );

    const workouts: RecentWorkout[] = [];

    for (const session of sessionsResult.rows) {
      const exercisesResult = await query<{
        exercise_id: string;
        exercise_name: string;
        total_sets: string;
        avg_reps: string;
        avg_weight: string;
      }>(
        `
        SELECT
          ws.exercise_id,
          MAX(ws.exercise_name) as exercise_name,
          COUNT(*) as total_sets,
          AVG(ws.actual_reps) as avg_reps,
          AVG(ws.actual_weight) as avg_weight
        FROM workout_sets ws
        WHERE ws.session_id = $1
          AND ws.actual_reps IS NOT NULL
        GROUP BY ws.exercise_id
        ORDER BY MIN(ws.set_index)
      `,
        [session.session_id]
      );

      workouts.push({
        templateName: session.template_name,
        splitType: session.split_type,
        completedAt: new Date(session.finished_at).toISOString().split("T")[0],
        exercises: exercisesResult.rows.map((ex) => ({
          exerciseId: ex.exercise_id,
          exerciseName: ex.exercise_name || "Unknown",
          sets: parseInt(ex.total_sets),
          avgReps: Math.round(parseFloat(ex.avg_reps)),
          avgWeight: ex.avg_weight ? Math.round(parseFloat(ex.avg_weight)) : undefined,
        })),
      });
    }

    return workouts;
  } catch (error) {
    console.error("[Fatigue] Error fetching recent workouts:", error);
    return [];
  }
};
