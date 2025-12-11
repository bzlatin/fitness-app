import { Router } from "express";
import { getFatigueScores, getTrainingRecommendations } from "../services/fatigue";
import {
  getProgressionSuggestions,
  applyProgressionSuggestions,
} from "../services/progression";
import {
  getAdvancedAnalytics,
  getWeeklyVolumeByMuscleGroup,
  getMuscleGroupSummaries,
  getPushPullBalance,
  getVolumePRs,
  getFrequencyHeatmap,
} from "../services/muscleAnalytics";
import { getRecapSlice } from "../services/recap";
import { requireProPlan } from "../middleware/planLimits";

const router = Router();

router.get("/fatigue", async (_req, res) => {
  const userId = res.locals.userId;
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const data = await getFatigueScores(userId);
    return res.json({ data });
  } catch (err) {
    console.error("[Analytics] Failed to fetch fatigue scores", err);
    return res.status(500).json({ error: "Failed to fetch fatigue scores" });
  }
});

router.get("/recommendations", requireProPlan, async (_req, res) => {
  const userId = res.locals.userId;
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const fatigue = await getFatigueScores(userId);
    const data = await getTrainingRecommendations(userId, fatigue);
    return res.json({ data });
  } catch (err) {
    console.error("[Analytics] Failed to fetch training recommendations", err);
    return res.status(500).json({ error: "Failed to fetch recommendations" });
  }
});

router.get("/progression/:templateId", requireProPlan, async (req, res) => {
  const userId = res.locals.userId;
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { templateId } = req.params;
  if (!templateId) {
    return res.status(400).json({ error: "Template ID is required" });
  }

  try {
    const data = await getProgressionSuggestions(userId, templateId);
    return res.json({ data });
  } catch (err) {
    console.error("[Analytics] Failed to fetch progression suggestions", err);
    return res.status(500).json({ error: "Failed to fetch progression suggestions" });
  }
});

router.post("/progression/:templateId/apply", requireProPlan, async (req, res) => {
  const userId = res.locals.userId;
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { templateId } = req.params;
  if (!templateId) {
    return res.status(400).json({ error: "Template ID is required" });
  }

  const { exerciseIds } = req.body as { exerciseIds?: string[] };

  try {
    const result = await applyProgressionSuggestions(userId, templateId, exerciseIds);
    return res.json({ data: result });
  } catch (err) {
    console.error("[Analytics] Failed to apply progression suggestions", err);
    return res.status(500).json({ error: "Failed to apply progression suggestions" });
  }
});

// Advanced Muscle Group Analytics (Pro feature)
router.get("/muscle-analytics", requireProPlan, async (req, res) => {
  const userId = res.locals.userId;
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const weeks = parseInt(req.query.weeks as string) || 12;

  try {
    const data = await getAdvancedAnalytics(userId, weeks);
    return res.json({ data });
  } catch (err) {
    console.error("[Analytics] Failed to fetch muscle analytics", err);
    return res.status(500).json({ error: "Failed to fetch muscle analytics" });
  }
});

router.get("/weekly-volume", requireProPlan, async (req, res) => {
  const userId = res.locals.userId;
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const weeks = parseInt(req.query.weeks as string) || 12;

  try {
    const data = await getWeeklyVolumeByMuscleGroup(userId, weeks);
    return res.json({ data });
  } catch (err) {
    console.error("[Analytics] Failed to fetch weekly volume", err);
    return res.status(500).json({ error: "Failed to fetch weekly volume" });
  }
});

router.get("/muscle-summaries", requireProPlan, async (req, res) => {
  const userId = res.locals.userId;
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const weeks = parseInt(req.query.weeks as string) || 12;

  try {
    const data = await getMuscleGroupSummaries(userId, weeks);
    return res.json({ data });
  } catch (err) {
    console.error("[Analytics] Failed to fetch muscle summaries", err);
    return res.status(500).json({ error: "Failed to fetch muscle summaries" });
  }
});

router.get("/push-pull-balance", requireProPlan, async (req, res) => {
  const userId = res.locals.userId;
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const weeks = parseInt(req.query.weeks as string) || 12;

  try {
    const data = await getPushPullBalance(userId, weeks);
    return res.json({ data });
  } catch (err) {
    console.error("[Analytics] Failed to fetch push/pull balance", err);
    return res.status(500).json({ error: "Failed to fetch push/pull balance" });
  }
});

router.get("/volume-prs", requireProPlan, async (req, res) => {
  const userId = res.locals.userId;
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const weeks = parseInt(req.query.weeks as string) || 52;

  try {
    const data = await getVolumePRs(userId, weeks);
    return res.json({ data });
  } catch (err) {
    console.error("[Analytics] Failed to fetch volume PRs", err);
    return res.status(500).json({ error: "Failed to fetch volume PRs" });
  }
});

router.get("/frequency-heatmap", requireProPlan, async (req, res) => {
  const userId = res.locals.userId;
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const weeks = parseInt(req.query.weeks as string) || 12;

  try {
    const data = await getFrequencyHeatmap(userId, weeks);
    return res.json({ data });
  } catch (err) {
    console.error("[Analytics] Failed to fetch frequency heatmap", err);
    return res.status(500).json({ error: "Failed to fetch frequency heatmap" });
  }
});

router.get("/recap", requireProPlan, async (_req, res) => {
  const userId = res.locals.userId;
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const data = await getRecapSlice(userId);
    return res.json({ data });
  } catch (err) {
    console.error("[Analytics] Failed to fetch recap slice", err);
    return res.status(500).json({ error: "Failed to fetch recap" });
  }
});

export default router;
