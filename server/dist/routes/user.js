"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_1 = require("../db");
const validate_1 = require("../middleware/validate");
const gymPreferences_1 = require("../utils/gymPreferences");
const router = (0, express_1.Router)();
router.get("/gym-preferences", async (_req, res) => {
    const userId = res.locals.userId;
    if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
    }
    try {
        const result = await (0, db_1.query)(`SELECT gym_preferences FROM users WHERE id = $1 LIMIT 1`, [userId]);
        if (!result.rowCount) {
            return res.status(404).json({ error: "User not found" });
        }
        const gymPreferences = (0, gymPreferences_1.normalizeGymPreferences)(result.rows[0]?.gym_preferences);
        return res.json({ gymPreferences });
    }
    catch (err) {
        console.error("Failed to load gym preferences", err);
        return res.status(500).json({ error: "Failed to load gym preferences" });
    }
});
router.put("/gym-preferences", (0, validate_1.validateBody)(gymPreferences_1.gymPreferencesSchema), async (req, res) => {
    const userId = res.locals.userId;
    if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
    }
    try {
        const normalized = (0, gymPreferences_1.normalizeGymPreferences)(req.body);
        const result = await (0, db_1.query)(`
          UPDATE users
          SET gym_preferences = $2, updated_at = NOW()
          WHERE id = $1
          RETURNING gym_preferences
        `, [userId, normalized]);
        if (!result.rowCount) {
            return res.status(404).json({ error: "User not found" });
        }
        return res.json({ gymPreferences: normalized });
    }
    catch (err) {
        console.error("Failed to update gym preferences", err);
        return res.status(500).json({ error: "Failed to update gym preferences" });
    }
});
exports.default = router;
