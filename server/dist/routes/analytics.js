"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const fatigue_1 = require("../services/fatigue");
const progression_1 = require("../services/progression");
const muscleAnalytics_1 = require("../services/muscleAnalytics");
const planLimits_1 = require("../middleware/planLimits");
const router = (0, express_1.Router)();
router.get("/fatigue", async (_req, res) => {
    const userId = res.locals.userId;
    if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
    }
    try {
        const data = await (0, fatigue_1.getFatigueScores)(userId);
        return res.json({ data });
    }
    catch (err) {
        console.error("[Analytics] Failed to fetch fatigue scores", err);
        return res.status(500).json({ error: "Failed to fetch fatigue scores" });
    }
});
router.get("/recommendations", planLimits_1.requireProPlan, async (_req, res) => {
    const userId = res.locals.userId;
    if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
    }
    try {
        const fatigue = await (0, fatigue_1.getFatigueScores)(userId);
        const data = await (0, fatigue_1.getTrainingRecommendations)(userId, fatigue);
        return res.json({ data });
    }
    catch (err) {
        console.error("[Analytics] Failed to fetch training recommendations", err);
        return res.status(500).json({ error: "Failed to fetch recommendations" });
    }
});
router.get("/progression/:templateId", planLimits_1.requireProPlan, async (req, res) => {
    const userId = res.locals.userId;
    if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
    }
    const { templateId } = req.params;
    if (!templateId) {
        return res.status(400).json({ error: "Template ID is required" });
    }
    try {
        const data = await (0, progression_1.getProgressionSuggestions)(userId, templateId);
        return res.json({ data });
    }
    catch (err) {
        console.error("[Analytics] Failed to fetch progression suggestions", err);
        return res.status(500).json({ error: "Failed to fetch progression suggestions" });
    }
});
router.post("/progression/:templateId/apply", planLimits_1.requireProPlan, async (req, res) => {
    const userId = res.locals.userId;
    if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
    }
    const { templateId } = req.params;
    if (!templateId) {
        return res.status(400).json({ error: "Template ID is required" });
    }
    const { exerciseIds } = req.body;
    try {
        const result = await (0, progression_1.applyProgressionSuggestions)(userId, templateId, exerciseIds);
        return res.json({ data: result });
    }
    catch (err) {
        console.error("[Analytics] Failed to apply progression suggestions", err);
        return res.status(500).json({ error: "Failed to apply progression suggestions" });
    }
});
// Advanced Muscle Group Analytics (Pro feature)
router.get("/muscle-analytics", planLimits_1.requireProPlan, async (req, res) => {
    const userId = res.locals.userId;
    if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
    }
    const weeks = parseInt(req.query.weeks) || 12;
    try {
        const data = await (0, muscleAnalytics_1.getAdvancedAnalytics)(userId, weeks);
        return res.json({ data });
    }
    catch (err) {
        console.error("[Analytics] Failed to fetch muscle analytics", err);
        return res.status(500).json({ error: "Failed to fetch muscle analytics" });
    }
});
router.get("/weekly-volume", planLimits_1.requireProPlan, async (req, res) => {
    const userId = res.locals.userId;
    if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
    }
    const weeks = parseInt(req.query.weeks) || 12;
    try {
        const data = await (0, muscleAnalytics_1.getWeeklyVolumeByMuscleGroup)(userId, weeks);
        return res.json({ data });
    }
    catch (err) {
        console.error("[Analytics] Failed to fetch weekly volume", err);
        return res.status(500).json({ error: "Failed to fetch weekly volume" });
    }
});
router.get("/muscle-summaries", planLimits_1.requireProPlan, async (req, res) => {
    const userId = res.locals.userId;
    if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
    }
    const weeks = parseInt(req.query.weeks) || 12;
    try {
        const data = await (0, muscleAnalytics_1.getMuscleGroupSummaries)(userId, weeks);
        return res.json({ data });
    }
    catch (err) {
        console.error("[Analytics] Failed to fetch muscle summaries", err);
        return res.status(500).json({ error: "Failed to fetch muscle summaries" });
    }
});
router.get("/push-pull-balance", planLimits_1.requireProPlan, async (req, res) => {
    const userId = res.locals.userId;
    if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
    }
    const weeks = parseInt(req.query.weeks) || 12;
    try {
        const data = await (0, muscleAnalytics_1.getPushPullBalance)(userId, weeks);
        return res.json({ data });
    }
    catch (err) {
        console.error("[Analytics] Failed to fetch push/pull balance", err);
        return res.status(500).json({ error: "Failed to fetch push/pull balance" });
    }
});
router.get("/volume-prs", planLimits_1.requireProPlan, async (req, res) => {
    const userId = res.locals.userId;
    if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
    }
    const weeks = parseInt(req.query.weeks) || 52;
    try {
        const data = await (0, muscleAnalytics_1.getVolumePRs)(userId, weeks);
        return res.json({ data });
    }
    catch (err) {
        console.error("[Analytics] Failed to fetch volume PRs", err);
        return res.status(500).json({ error: "Failed to fetch volume PRs" });
    }
});
router.get("/frequency-heatmap", planLimits_1.requireProPlan, async (req, res) => {
    const userId = res.locals.userId;
    if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
    }
    const weeks = parseInt(req.query.weeks) || 12;
    try {
        const data = await (0, muscleAnalytics_1.getFrequencyHeatmap)(userId, weeks);
        return res.json({ data });
    }
    catch (err) {
        console.error("[Analytics] Failed to fetch frequency heatmap", err);
        return res.status(500).json({ error: "Failed to fetch frequency heatmap" });
    }
});
exports.default = router;
