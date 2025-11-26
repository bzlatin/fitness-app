"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const fatigue_1 = require("../services/fatigue");
const progression_1 = require("../services/progression");
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
router.get("/recommendations", async (_req, res) => {
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
router.get("/progression/:templateId", async (req, res) => {
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
router.post("/progression/:templateId/apply", async (req, res) => {
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
exports.default = router;
