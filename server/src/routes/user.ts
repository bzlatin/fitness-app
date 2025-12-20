import { Router } from "express";
import { query } from "../db";
import { validateBody } from "../middleware/validate";
import {
  gymPreferencesSchema,
  normalizeGymPreferences,
} from "../utils/gymPreferences";

const router = Router();

router.get("/gym-preferences", async (_req, res) => {
  const userId = res.locals.userId as string | undefined;
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const result = await query<{ gym_preferences: unknown }>(
      `SELECT gym_preferences FROM users WHERE id = $1 LIMIT 1`,
      [userId]
    );
    if (!result.rowCount) {
      return res.status(404).json({ error: "User not found" });
    }
    const gymPreferences = normalizeGymPreferences(
      result.rows[0]?.gym_preferences
    );
    return res.json({ gymPreferences });
  } catch (err) {
    console.error("Failed to load gym preferences", err);
    return res.status(500).json({ error: "Failed to load gym preferences" });
  }
});

router.put(
  "/gym-preferences",
  validateBody(gymPreferencesSchema),
  async (req, res) => {
    const userId = res.locals.userId as string | undefined;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    try {
      const normalized = normalizeGymPreferences(req.body);
      const result = await query<{ gym_preferences: unknown }>(
        `
          UPDATE users
          SET gym_preferences = $2, updated_at = NOW()
          WHERE id = $1
          RETURNING gym_preferences
        `,
        [userId, normalized]
      );
      if (!result.rowCount) {
        return res.status(404).json({ error: "User not found" });
      }
      return res.json({ gymPreferences: normalized });
    } catch (err) {
      console.error("Failed to update gym preferences", err);
      return res.status(500).json({ error: "Failed to update gym preferences" });
    }
  }
);

export default router;
