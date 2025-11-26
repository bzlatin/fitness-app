import { Router } from "express";
import { getFatigueScores, getTrainingRecommendations } from "../services/fatigue";
import {
  getProgressionSuggestions,
  applyProgressionSuggestions,
} from "../services/progression";
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

export default router;
