"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRecapSlice = void 0;
const db_1 = require("../db");
const LOOKBACK_WEEKS = 8;
const BODYWEIGHT_FALLBACK_LBS = 100;
const CACHE_TTL_MS = 2 * 60 * 1000;
const recapCache = new Map();
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const formatDateKey = (date) => date.toISOString().split("T")[0];
const startOfDayUtc = (date) => {
    const copy = new Date(date);
    copy.setUTCHours(0, 0, 0, 0);
    return copy;
};
const subtractDays = (date, days) => {
    const copy = new Date(date);
    copy.setUTCDate(copy.getUTCDate() - days);
    return copy;
};
const median = (values) => {
    if (!values.length)
        return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
};
const average = (values) => {
    if (!values.length)
        return 0;
    const sum = values.reduce((total, current) => total + current, 0);
    return sum / values.length;
};
const computeCurrentStreak = (dates) => {
    if (!dates.length)
        return 0;
    const dateSet = new Set(dates);
    let streak = 0;
    let cursor = startOfDayUtc(new Date());
    while (dateSet.has(formatDateKey(cursor))) {
        streak += 1;
        cursor = subtractDays(cursor, 1);
    }
    return streak;
};
const computeBestStreak = (dates) => {
    if (!dates.length)
        return 0;
    const sorted = [...new Set(dates.map((date) => startOfDayUtc(new Date(date)).getTime()))].sort((a, b) => a - b);
    let best = 1;
    let current = 1;
    for (let i = 1; i < sorted.length; i++) {
        const prev = sorted[i - 1];
        const curr = sorted[i];
        const isConsecutive = curr - prev === 24 * 60 * 60 * 1000;
        current = isConsecutive ? current + 1 : 1;
        best = Math.max(best, current);
    }
    return best;
};
const fetchRecentSessions = async (userId, lookbackWeeks) => {
    const now = new Date();
    const lookbackStart = new Date(now);
    lookbackStart.setDate(now.getDate() - lookbackWeeks * 7);
    const result = await (0, db_1.query)(`
      SELECT
        s.id,
        s.template_id,
        COALESCE(s.template_name, wt.name) as template_name,
        s.finished_at,
        SUM(
          COALESCE(ws.actual_reps, ws.target_reps, 0) *
          COALESCE(
            ws.actual_weight,
            ws.target_weight,
            CASE WHEN COALESCE(e.equipment, 'bodyweight') = 'bodyweight' THEN $3 ELSE 0 END
          )
        ) as total_volume,
        AVG(ws.rpe) as avg_rpe,
        COUNT(ws.id) as set_count,
        ARRAY_REMOVE(ARRAY_AGG(DISTINCT COALESCE(e.primary_muscle_group, 'other')), NULL) as muscle_groups
      FROM workout_sessions s
      LEFT JOIN workout_sets ws ON ws.session_id = s.id
      LEFT JOIN exercises e ON e.id = ws.exercise_id
      LEFT JOIN workout_templates wt ON wt.id = s.template_id
      WHERE s.user_id = $1
        AND s.finished_at IS NOT NULL
        AND s.ended_reason IS DISTINCT FROM 'auto_inactivity'
        AND s.finished_at >= $2
      GROUP BY s.id, wt.name
      ORDER BY s.finished_at DESC
    `, [userId, lookbackStart.toISOString(), BODYWEIGHT_FALLBACK_LBS]);
    return result.rows;
};
const computeQualityScore = (volume, baselineVolume, avgRpe, baselineRpe) => {
    const safeBaseline = baselineVolume && baselineVolume > 0 ? baselineVolume : volume || 1;
    const volumeRatio = clamp(volume / safeBaseline, 0.4, 1.6);
    const volumeComponent = volumeRatio;
    const targetRpe = 8;
    const rpeValue = avgRpe ?? baselineRpe;
    const rpeComponent = rpeValue === null
        ? 0.75
        : clamp(1 - Math.abs(rpeValue - targetRpe) / 5, 0.45, 1.05);
    const rpeTrendBoost = baselineRpe === null || rpeValue === null
        ? 1
        : clamp(1 + ((rpeValue - baselineRpe) / 3) * 0.1, 0.9, 1.1);
    const combined = volumeComponent * 0.7 + rpeComponent * 0.3;
    const score = Math.round(clamp(combined * 100 * rpeTrendBoost, 35, 100));
    if (score >= 90)
        return { score, status: "peak" };
    if (score >= 75)
        return { score, status: "solid" };
    return { score, status: "dip" };
};
const buildHighlights = (quality, streak, baselineVolume, qualityDip) => {
    const highlights = [];
    const bestQuality = [...quality].sort((a, b) => b.qualityScore - a.qualityScore)[0];
    const topVolume = [...quality].sort((a, b) => b.totalVolume - a.totalVolume)[0];
    if (bestQuality) {
        highlights.push({
            id: `quality-${bestQuality.sessionId}`,
            type: "pr",
            title: "Standout session",
            subtitle: bestQuality.templateName || "Recent workout",
            date: bestQuality.finishedAt,
            tone: "positive",
            value: bestQuality.qualityScore,
        });
    }
    if (topVolume && baselineVolume && topVolume.totalVolume > baselineVolume * 1.15) {
        highlights.push({
            id: `volume-${topVolume.sessionId}`,
            type: "volume_high",
            title: "Volume high",
            subtitle: `${Math.round(topVolume.totalVolume / 100) / 10}k lbs moved`,
            date: topVolume.finishedAt,
            tone: "positive",
            value: topVolume.totalVolume,
        });
    }
    if (streak.current >= 3) {
        highlights.push({
            id: `streak-current-${streak.current}`,
            type: "streak",
            title: `${streak.current}-day streak`,
            subtitle: "Nice consistency—keep it steady",
            date: streak.lastWorkoutAt ?? formatDateKey(new Date()),
            tone: "info",
        });
    }
    else if (streak.best >= 5) {
        highlights.push({
            id: `streak-best-${streak.best}`,
            type: "streak",
            title: `Best streak: ${streak.best} days`,
            subtitle: "You’ve hit this before—time to match it",
            date: streak.lastWorkoutAt ?? formatDateKey(new Date()),
            tone: "info",
        });
    }
    if (qualityDip) {
        highlights.push({
            id: `dip-${qualityDip.since}`,
            type: "dip",
            title: "Quality dip detected",
            subtitle: qualityDip.suggestion,
            date: qualityDip.since,
            tone: "warning",
        });
    }
    return highlights
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 6);
};
const buildRecap = async (userId) => {
    const sessions = await fetchRecentSessions(userId, LOOKBACK_WEEKS);
    if (!sessions.length) {
        const empty = {
            generatedAt: new Date().toISOString(),
            lookbackWeeks: LOOKBACK_WEEKS,
            baselineVolume: null,
            baselineRpe: null,
            streak: { current: 0, best: 0, lastWorkoutAt: null },
            quality: [],
            highlights: [],
            qualityDip: null,
            winBack: null,
        };
        return empty;
    }
    const volumes = sessions
        .map((session) => Math.max(0, Math.round(Number(session.total_volume) || 0)))
        .filter((value) => value > 0);
    const rpes = sessions
        .map((session) => session.avg_rpe !== null && !Number.isNaN(Number(session.avg_rpe))
        ? Number(session.avg_rpe)
        : null)
        .filter((value) => value !== null);
    const baselineVolume = volumes.length >= 3 ? median(volumes) : volumes[0] ?? null;
    const baselineRpe = rpes.length >= 3 ? average(rpes) : rpes[0] ?? null;
    const quality = sessions.map((session) => {
        const volume = Math.max(0, Math.round(Number(session.total_volume) || 0));
        const avgRpe = session.avg_rpe === null || Number.isNaN(Number(session.avg_rpe))
            ? null
            : Number(session.avg_rpe);
        const { score, status } = computeQualityScore(volume, baselineVolume, avgRpe, baselineRpe);
        return {
            sessionId: session.id,
            finishedAt: formatDateKey(new Date(session.finished_at)),
            templateName: session.template_name,
            qualityScore: score,
            status,
            totalVolume: volume,
            avgRpe,
        };
    });
    const sessionDates = quality.map((session) => session.finishedAt);
    const streak = {
        current: computeCurrentStreak(sessionDates),
        best: computeBestStreak(sessionDates),
        lastWorkoutAt: sessionDates[0] ?? null,
    };
    let consecutiveDipCount = 0;
    for (const session of quality) {
        if (session.status === "dip") {
            consecutiveDipCount += 1;
        }
        else {
            break;
        }
    }
    const qualityDip = consecutiveDipCount >= 2
        ? {
            consecutive: consecutiveDipCount,
            since: quality.slice(0, consecutiveDipCount)[0]?.finishedAt ?? sessionDates[0],
            suggestion: consecutiveDipCount >= 3
                ? "Dial back intensity and try a short recovery session"
                : "Ease back in with focused form and lighter loads",
            lastScore: quality[0]?.qualityScore ?? 0,
        }
        : null;
    const lastWorkoutAt = sessions[0]?.finished_at ? new Date(sessions[0].finished_at) : null;
    const daysSinceLast = lastWorkoutAt === null
        ? Infinity
        : Math.round((startOfDayUtc(new Date()).getTime() - startOfDayUtc(lastWorkoutAt).getTime()) /
            (1000 * 60 * 60 * 24));
    const winBack = qualityDip && daysSinceLast >= 5
        ? {
            headline: "Quality dipped—take an easy win",
            message: `Last workout was ${daysSinceLast} days ago. Try a short recovery or technique session to reset.`,
            since: qualityDip.since,
        }
        : null;
    const highlights = buildHighlights(quality, streak, baselineVolume, qualityDip);
    return {
        generatedAt: new Date().toISOString(),
        lookbackWeeks: LOOKBACK_WEEKS,
        baselineVolume: baselineVolume ?? null,
        baselineRpe: baselineRpe ?? null,
        streak,
        quality,
        highlights,
        qualityDip,
        winBack,
    };
};
const getRecapSlice = async (userId) => {
    const now = Date.now();
    const cached = recapCache.get(userId);
    if (cached && cached.expires > now) {
        return cached.data;
    }
    const data = await buildRecap(userId);
    recapCache.set(userId, { data, expires: now + CACHE_TTL_MS });
    return data;
};
exports.getRecapSlice = getRecapSlice;
