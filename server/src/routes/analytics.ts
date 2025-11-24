import { Router } from "express";
import { getFatigueScores, getTrainingRecommendations } from "../services/fatigue";

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

router.get("/recommendations", async (_req, res) => {
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

export default router;
