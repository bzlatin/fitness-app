import { query } from "../db";
import { MuscleGroup } from "../types/workouts";

// Muscle group categories for push/pull analysis
const PUSH_MUSCLES: MuscleGroup[] = ["chest", "shoulders", "triceps"];
const PULL_MUSCLES: MuscleGroup[] = ["back", "biceps"];
const LEG_MUSCLES: MuscleGroup[] = ["legs", "glutes"];

export type WeeklyVolumeData = {
  weekStartDate: string; // ISO date string (Monday of that week)
  weekNumber: number; // Week number (1-52)
  year: number;
  muscleGroup: string;
  totalVolume: number;
  totalSets: number;
  workoutCount: number;
};

export type MuscleGroupSummary = {
  muscleGroup: string;
  totalVolume: number;
  totalSets: number;
  workoutCount: number;
  averageVolumePerWorkout: number;
  lastTrainedDate: string | null;
};

export type PushPullBalance = {
  pushVolume: number;
  pullVolume: number;
  legVolume: number;
  otherVolume: number;
  pushPullRatio: number; // push/pull
  balanceStatus: "balanced" | "push-heavy" | "pull-heavy";
  recommendations: string[];
};

export type VolumePR = {
  muscleGroup: string;
  peakVolume: number;
  peakWeekDate: string; // ISO date string
  currentVolume: number; // Last week's volume
  percentOfPR: number; // currentVolume / peakVolume * 100
};

export type FrequencyHeatmapData = {
  muscleGroup: string;
  dateTrainingCount: Record<string, number>; // ISO date -> number of times trained
  weeklyFrequency: number; // Average times per week
  mostTrainedDay: string | null; // Day of week (Monday, Tuesday, etc.)
};

export type AdvancedAnalytics = {
  weeklyVolumeData: WeeklyVolumeData[];
  muscleGroupSummaries: MuscleGroupSummary[];
  pushPullBalance: PushPullBalance;
  volumePRs: VolumePR[];
  frequencyHeatmap: FrequencyHeatmapData[];
};

const BODYWEIGHT_FALLBACK_LBS = 100;

/**
 * Get the Monday of a given week
 */
const getMonday = (date: Date): Date => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
  return new Date(d.setDate(diff));
};

/**
 * Format date as ISO string (YYYY-MM-DD)
 */
const formatDate = (date: Date): string => {
  return date.toISOString().split("T")[0];
};

/**
 * Get week number and year from a date
 */
const getWeekNumber = (date: Date): { week: number; year: number } => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 4 - (d.getDay() || 7)); // Thursday of current week
  const yearStart = new Date(d.getFullYear(), 0, 1);
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return { week: weekNo, year: d.getFullYear() };
};

/**
 * Fetch weekly volume data for the last N weeks
 */
export const getWeeklyVolumeByMuscleGroup = async (
  userId: string,
  weeks: number = 12
): Promise<WeeklyVolumeData[]> => {
  const now = new Date();
  const startDate = new Date(now);
  startDate.setDate(startDate.getDate() - weeks * 7);

  const result = await query<{
    week_start: string;
    muscle_group: string;
    total_volume: string;
    total_sets: string;
    workout_count: string;
  }>(
    `
    SELECT
      DATE_TRUNC('week', s.finished_at)::date as week_start,
      COALESCE(e.primary_muscle_group, 'other') as muscle_group,
      SUM(
        COALESCE(ws.actual_reps, ws.target_reps, 0) *
        COALESCE(
          ws.actual_weight,
          ws.target_weight,
          CASE WHEN COALESCE(e.equipment, 'bodyweight') = 'bodyweight' THEN $3 ELSE 0 END
        )
      ) as total_volume,
      COUNT(DISTINCT ws.id) as total_sets,
      COUNT(DISTINCT s.id) as workout_count
    FROM workout_sets ws
    JOIN workout_sessions s ON s.id = ws.session_id
    LEFT JOIN exercises e ON e.id = ws.exercise_id
    WHERE s.user_id = $1
      AND s.finished_at IS NOT NULL
      AND s.ended_reason IS DISTINCT FROM 'auto_inactivity'
      AND s.finished_at >= $2
    GROUP BY DATE_TRUNC('week', s.finished_at), COALESCE(e.primary_muscle_group, 'other')
    ORDER BY week_start DESC, total_volume DESC
    `,
    [userId, startDate.toISOString(), BODYWEIGHT_FALLBACK_LBS]
  );

  return result.rows.map((row) => {
    const weekStart = new Date(row.week_start);
    const { week, year } = getWeekNumber(weekStart);

    return {
      weekStartDate: formatDate(weekStart),
      weekNumber: week,
      year,
      muscleGroup: row.muscle_group,
      totalVolume: Math.round(Number(row.total_volume)),
      totalSets: Number(row.total_sets),
      workoutCount: Number(row.workout_count),
    };
  });
};

/**
 * Get muscle group summaries (total volume, sets, frequency) over a time period
 */
export const getMuscleGroupSummaries = async (
  userId: string,
  weeks: number = 12
): Promise<MuscleGroupSummary[]> => {
  const now = new Date();
  const startDate = new Date(now);
  startDate.setDate(startDate.getDate() - weeks * 7);

  const result = await query<{
    muscle_group: string;
    total_volume: string;
    total_sets: string;
    workout_count: string;
    last_trained: string | null;
  }>(
    `
    SELECT
      COALESCE(e.primary_muscle_group, 'other') as muscle_group,
      SUM(
        COALESCE(ws.actual_reps, ws.target_reps, 0) *
        COALESCE(
          ws.actual_weight,
          ws.target_weight,
          CASE WHEN COALESCE(e.equipment, 'bodyweight') = 'bodyweight' THEN $3 ELSE 0 END
        )
      ) as total_volume,
      COUNT(DISTINCT ws.id) as total_sets,
      COUNT(DISTINCT s.id) as workout_count,
      MAX(s.finished_at) as last_trained
    FROM workout_sets ws
    JOIN workout_sessions s ON s.id = ws.session_id
    LEFT JOIN exercises e ON e.id = ws.exercise_id
    WHERE s.user_id = $1
      AND s.finished_at IS NOT NULL
      AND s.ended_reason IS DISTINCT FROM 'auto_inactivity'
      AND s.finished_at >= $2
    GROUP BY COALESCE(e.primary_muscle_group, 'other')
    ORDER BY total_volume DESC
    `,
    [userId, startDate.toISOString(), BODYWEIGHT_FALLBACK_LBS]
  );

  return result.rows.map((row) => ({
    muscleGroup: row.muscle_group,
    totalVolume: Math.round(Number(row.total_volume)),
    totalSets: Number(row.total_sets),
    workoutCount: Number(row.workout_count),
    averageVolumePerWorkout:
      Number(row.workout_count) > 0
        ? Math.round(Number(row.total_volume) / Number(row.workout_count))
        : 0,
    lastTrainedDate: row.last_trained ? formatDate(new Date(row.last_trained)) : null,
  }));
};

/**
 * Calculate push/pull balance and provide recommendations
 */
export const getPushPullBalance = async (
  userId: string,
  weeks: number = 12
): Promise<PushPullBalance> => {
  const summaries = await getMuscleGroupSummaries(userId, weeks);

  let pushVolume = 0;
  let pullVolume = 0;
  let legVolume = 0;
  let otherVolume = 0;

  summaries.forEach((summary) => {
    const muscle = summary.muscleGroup as MuscleGroup;
    if (PUSH_MUSCLES.includes(muscle)) {
      pushVolume += summary.totalVolume;
    } else if (PULL_MUSCLES.includes(muscle)) {
      pullVolume += summary.totalVolume;
    } else if (LEG_MUSCLES.includes(muscle)) {
      legVolume += summary.totalVolume;
    } else {
      otherVolume += summary.totalVolume;
    }
  });

  // Avoid a misleading 1:1 ratio when there is no data
  const pushPullRatio = pullVolume > 0 ? pushVolume / pullVolume : pushVolume > 0 ? 999 : 0;

  let balanceStatus: PushPullBalance["balanceStatus"] = "balanced";
  const recommendations: string[] = [];

  // Ideal ratio is 1:1 to 1.2:1 (push:pull)
  if (pushPullRatio > 1.5) {
    balanceStatus = "push-heavy";
    recommendations.push("Consider adding more pulling exercises (back, biceps)");
    recommendations.push("Aim for 1:1 to 1.2:1 push-to-pull ratio for balanced development");
  } else if (pushPullRatio < 0.7) {
    balanceStatus = "pull-heavy";
    recommendations.push("Consider adding more pushing exercises (chest, shoulders, triceps)");
    recommendations.push("Aim for 1:1 to 1.2:1 push-to-pull ratio for balanced development");
  } else {
    recommendations.push("Great push/pull balance! Keep it up.");
  }

  // Check for leg volume relative to upper body
  const upperBodyVolume = pushVolume + pullVolume;
  if (legVolume < upperBodyVolume * 0.5 && upperBodyVolume > 0) {
    recommendations.push("Consider increasing leg training volume to match upper body development");
  }

  return {
    pushVolume: Math.round(pushVolume),
    pullVolume: Math.round(pullVolume),
    legVolume: Math.round(legVolume),
    otherVolume: Math.round(otherVolume),
    pushPullRatio: Math.round(pushPullRatio * 100) / 100,
    balanceStatus,
    recommendations,
  };
};

/**
 * Get volume PRs (personal records) for each muscle group
 */
export const getVolumePRs = async (
  userId: string,
  lookbackWeeks: number = 52
): Promise<VolumePR[]> => {
  const weeklyData = await getWeeklyVolumeByMuscleGroup(userId, lookbackWeeks);

  // Group by muscle group and find peak volume
  const muscleGroupPeaks = new Map<string, { peakVolume: number; peakWeekDate: string }>();

  weeklyData.forEach((week) => {
    const existing = muscleGroupPeaks.get(week.muscleGroup);
    if (!existing || week.totalVolume > existing.peakVolume) {
      muscleGroupPeaks.set(week.muscleGroup, {
        peakVolume: week.totalVolume,
        peakWeekDate: week.weekStartDate,
      });
    }
  });

  // Get current week's volume (last 7 days)
  const currentWeekData = await getWeeklyVolumeByMuscleGroup(userId, 1);
  const currentWeekVolumes = new Map<string, number>();
  currentWeekData.forEach((week) => {
    currentWeekVolumes.set(week.muscleGroup, week.totalVolume);
  });

  const volumePRs: VolumePR[] = [];
  muscleGroupPeaks.forEach((peak, muscleGroup) => {
    const currentVolume = currentWeekVolumes.get(muscleGroup) || 0;
    const percentOfPR = peak.peakVolume > 0 ? (currentVolume / peak.peakVolume) * 100 : 0;

    volumePRs.push({
      muscleGroup,
      peakVolume: peak.peakVolume,
      peakWeekDate: peak.peakWeekDate,
      currentVolume,
      percentOfPR: Math.round(percentOfPR),
    });
  });

  // Sort by peak volume descending
  return volumePRs.sort((a, b) => b.peakVolume - a.peakVolume);
};

/**
 * Get frequency heatmap data for muscle groups
 */
export const getFrequencyHeatmap = async (
  userId: string,
  weeks: number = 12
): Promise<FrequencyHeatmapData[]> => {
  const now = new Date();
  const startDate = new Date(now);
  startDate.setDate(startDate.getDate() - weeks * 7);

  const result = await query<{
    muscle_group: string;
    training_date: string;
    day_of_week: string;
    set_count: string;
  }>(
    `
    SELECT
      COALESCE(e.primary_muscle_group, 'other') as muscle_group,
      s.finished_at::date as training_date,
      TO_CHAR(s.finished_at, 'Day') as day_of_week,
      COUNT(DISTINCT ws.id) as set_count
    FROM workout_sets ws
    JOIN workout_sessions s ON s.id = ws.session_id
    LEFT JOIN exercises e ON e.id = ws.exercise_id
    WHERE s.user_id = $1
      AND s.finished_at IS NOT NULL
      AND s.ended_reason IS DISTINCT FROM 'auto_inactivity'
      AND s.finished_at >= $2
    GROUP BY COALESCE(e.primary_muscle_group, 'other'), s.finished_at::date, TO_CHAR(s.finished_at, 'Day')
    ORDER BY training_date DESC
    `,
    [userId, startDate.toISOString()]
  );

  // Group by muscle group
  const muscleGroupData = new Map<
    string,
    {
      dateTrainingCount: Record<string, number>;
      dayOfWeekCount: Record<string, number>;
    }
  >();

  result.rows.forEach((row) => {
    const muscle = row.muscle_group;
    const date = formatDate(new Date(row.training_date));
    const dayOfWeek = row.day_of_week.trim();
    const setCount = Number(row.set_count);

    if (!muscleGroupData.has(muscle)) {
      muscleGroupData.set(muscle, {
        dateTrainingCount: {},
        dayOfWeekCount: {},
      });
    }

    const data = muscleGroupData.get(muscle)!;
    data.dateTrainingCount[date] = (data.dateTrainingCount[date] || 0) + setCount;
    data.dayOfWeekCount[dayOfWeek] = (data.dayOfWeekCount[dayOfWeek] || 0) + 1;
  });

  const heatmapData: FrequencyHeatmapData[] = [];

  muscleGroupData.forEach((data, muscleGroup) => {
    const totalDays = Object.keys(data.dateTrainingCount).length;
    const weeklyFrequency = totalDays > 0 ? Math.round((totalDays / weeks) * 10) / 10 : 0;

    // Find most trained day
    let mostTrainedDay: string | null = null;
    let maxDayCount = 0;
    Object.entries(data.dayOfWeekCount).forEach(([day, count]) => {
      if (count > maxDayCount) {
        maxDayCount = count;
        mostTrainedDay = day;
      }
    });

    heatmapData.push({
      muscleGroup,
      dateTrainingCount: data.dateTrainingCount,
      weeklyFrequency,
      mostTrainedDay,
    });
  });

  return heatmapData.sort((a, b) => b.weeklyFrequency - a.weeklyFrequency);
};

/**
 * Get all advanced analytics data in one call
 */
export const getAdvancedAnalytics = async (
  userId: string,
  weeks: number = 12
): Promise<AdvancedAnalytics> => {
  const [weeklyVolumeData, muscleGroupSummaries, pushPullBalance, volumePRs, frequencyHeatmap] =
    await Promise.all([
      getWeeklyVolumeByMuscleGroup(userId, weeks),
      getMuscleGroupSummaries(userId, weeks),
      getPushPullBalance(userId, weeks),
      getVolumePRs(userId, Math.max(weeks, 52)), // At least 1 year for PRs
      getFrequencyHeatmap(userId, weeks),
    ]);

  return {
    weeklyVolumeData,
    muscleGroupSummaries,
    pushPullBalance,
    volumePRs,
    frequencyHeatmap,
  };
};
