"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAdvancedAnalytics = exports.getFrequencyHeatmap = exports.getVolumePRs = exports.getPushPullBalance = exports.getMuscleGroupSummaries = exports.getWeeklyVolumeByMuscleGroup = void 0;
const db_1 = require("../db");
// Muscle group categories for push/pull analysis
const PUSH_MUSCLES = ["chest", "shoulders", "triceps"];
const PULL_MUSCLES = ["back", "biceps"];
const LEG_MUSCLES = ["legs", "glutes"];
const BODYWEIGHT_FALLBACK_LBS = 100;
/**
 * Get the Monday of a given week
 */
const getMonday = (date) => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
    return new Date(d.setDate(diff));
};
/**
 * Format date as ISO string (YYYY-MM-DD)
 */
const formatDate = (date) => {
    return date.toISOString().split("T")[0];
};
/**
 * Get week number and year from a date
 */
const getWeekNumber = (date) => {
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
const getWeeklyVolumeByMuscleGroup = async (userId, weeks = 12) => {
    const now = new Date();
    const startDate = new Date(now);
    startDate.setDate(startDate.getDate() - weeks * 7);
    const result = await (0, db_1.query)(`
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
      AND s.finished_at >= $2
    GROUP BY DATE_TRUNC('week', s.finished_at), COALESCE(e.primary_muscle_group, 'other')
    ORDER BY week_start DESC, total_volume DESC
    `, [userId, startDate.toISOString(), BODYWEIGHT_FALLBACK_LBS]);
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
exports.getWeeklyVolumeByMuscleGroup = getWeeklyVolumeByMuscleGroup;
/**
 * Get muscle group summaries (total volume, sets, frequency) over a time period
 */
const getMuscleGroupSummaries = async (userId, weeks = 12) => {
    const now = new Date();
    const startDate = new Date(now);
    startDate.setDate(startDate.getDate() - weeks * 7);
    const result = await (0, db_1.query)(`
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
      AND s.finished_at >= $2
    GROUP BY COALESCE(e.primary_muscle_group, 'other')
    ORDER BY total_volume DESC
    `, [userId, startDate.toISOString(), BODYWEIGHT_FALLBACK_LBS]);
    return result.rows.map((row) => ({
        muscleGroup: row.muscle_group,
        totalVolume: Math.round(Number(row.total_volume)),
        totalSets: Number(row.total_sets),
        workoutCount: Number(row.workout_count),
        averageVolumePerWorkout: Number(row.workout_count) > 0
            ? Math.round(Number(row.total_volume) / Number(row.workout_count))
            : 0,
        lastTrainedDate: row.last_trained ? formatDate(new Date(row.last_trained)) : null,
    }));
};
exports.getMuscleGroupSummaries = getMuscleGroupSummaries;
/**
 * Calculate push/pull balance and provide recommendations
 */
const getPushPullBalance = async (userId, weeks = 12) => {
    const summaries = await (0, exports.getMuscleGroupSummaries)(userId, weeks);
    let pushVolume = 0;
    let pullVolume = 0;
    let legVolume = 0;
    let otherVolume = 0;
    summaries.forEach((summary) => {
        const muscle = summary.muscleGroup;
        if (PUSH_MUSCLES.includes(muscle)) {
            pushVolume += summary.totalVolume;
        }
        else if (PULL_MUSCLES.includes(muscle)) {
            pullVolume += summary.totalVolume;
        }
        else if (LEG_MUSCLES.includes(muscle)) {
            legVolume += summary.totalVolume;
        }
        else {
            otherVolume += summary.totalVolume;
        }
    });
    const pushPullRatio = pullVolume > 0 ? pushVolume / pullVolume : pushVolume > 0 ? 999 : 1;
    let balanceStatus = "balanced";
    const recommendations = [];
    // Ideal ratio is 1:1 to 1.2:1 (push:pull)
    if (pushPullRatio > 1.5) {
        balanceStatus = "push-heavy";
        recommendations.push("Consider adding more pulling exercises (back, biceps)");
        recommendations.push("Aim for 1:1 to 1.2:1 push-to-pull ratio for balanced development");
    }
    else if (pushPullRatio < 0.7) {
        balanceStatus = "pull-heavy";
        recommendations.push("Consider adding more pushing exercises (chest, shoulders, triceps)");
        recommendations.push("Aim for 1:1 to 1.2:1 push-to-pull ratio for balanced development");
    }
    else {
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
exports.getPushPullBalance = getPushPullBalance;
/**
 * Get volume PRs (personal records) for each muscle group
 */
const getVolumePRs = async (userId, lookbackWeeks = 52) => {
    const weeklyData = await (0, exports.getWeeklyVolumeByMuscleGroup)(userId, lookbackWeeks);
    // Group by muscle group and find peak volume
    const muscleGroupPeaks = new Map();
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
    const currentWeekData = await (0, exports.getWeeklyVolumeByMuscleGroup)(userId, 1);
    const currentWeekVolumes = new Map();
    currentWeekData.forEach((week) => {
        currentWeekVolumes.set(week.muscleGroup, week.totalVolume);
    });
    const volumePRs = [];
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
exports.getVolumePRs = getVolumePRs;
/**
 * Get frequency heatmap data for muscle groups
 */
const getFrequencyHeatmap = async (userId, weeks = 12) => {
    const now = new Date();
    const startDate = new Date(now);
    startDate.setDate(startDate.getDate() - weeks * 7);
    const result = await (0, db_1.query)(`
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
      AND s.finished_at >= $2
    GROUP BY COALESCE(e.primary_muscle_group, 'other'), s.finished_at::date, TO_CHAR(s.finished_at, 'Day')
    ORDER BY training_date DESC
    `, [userId, startDate.toISOString()]);
    // Group by muscle group
    const muscleGroupData = new Map();
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
        const data = muscleGroupData.get(muscle);
        data.dateTrainingCount[date] = (data.dateTrainingCount[date] || 0) + setCount;
        data.dayOfWeekCount[dayOfWeek] = (data.dayOfWeekCount[dayOfWeek] || 0) + 1;
    });
    const heatmapData = [];
    muscleGroupData.forEach((data, muscleGroup) => {
        const totalDays = Object.keys(data.dateTrainingCount).length;
        const weeklyFrequency = totalDays > 0 ? Math.round((totalDays / weeks) * 10) / 10 : 0;
        // Find most trained day
        let mostTrainedDay = null;
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
exports.getFrequencyHeatmap = getFrequencyHeatmap;
/**
 * Get all advanced analytics data in one call
 */
const getAdvancedAnalytics = async (userId, weeks = 12) => {
    const [weeklyVolumeData, muscleGroupSummaries, pushPullBalance, volumePRs, frequencyHeatmap] = await Promise.all([
        (0, exports.getWeeklyVolumeByMuscleGroup)(userId, weeks),
        (0, exports.getMuscleGroupSummaries)(userId, weeks),
        (0, exports.getPushPullBalance)(userId, weeks),
        (0, exports.getVolumePRs)(userId, Math.max(weeks, 52)), // At least 1 year for PRs
        (0, exports.getFrequencyHeatmap)(userId, weeks),
    ]);
    return {
        weeklyVolumeData,
        muscleGroupSummaries,
        pushPullBalance,
        volumePRs,
        frequencyHeatmap,
    };
};
exports.getAdvancedAnalytics = getAdvancedAnalytics;
