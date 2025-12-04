"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importStar(require("express"));
const path_1 = __importDefault(require("path"));
const db_1 = require("../db");
const exerciseCatalog_1 = require("../utils/exerciseCatalog");
const router = (0, express_1.Router)();
const mapExerciseRow = (row) => {
    const imagePath = row.image_paths?.[0];
    return {
        id: row.id,
        name: row.name,
        primaryMuscleGroup: (row.primary_muscle_group ?? "other").toLowerCase(),
        equipment: (row.equipment ?? "bodyweight").toLowerCase(),
        category: row.category ?? undefined,
        gifUrl: imagePath ? `/api/exercises/assets/${imagePath}` : undefined,
    };
};
// Serve static exercise images (dist dataset first, then raw exercises folder as fallback)
const imagesDirDist = path_1.default.join(__dirname, "../data/dist");
const imagesDirLegacy = path_1.default.join(__dirname, "../data/exercises");
router.use("/assets", express_1.default.static(imagesDirDist));
router.use("/assets", express_1.default.static(imagesDirLegacy));
router.get("/search", async (req, res) => {
    const { query: search, muscleGroup } = req.query;
    const searchValue = typeof search === "string" ? search.toLowerCase() : "";
    const muscleValue = typeof muscleGroup === "string" ? muscleGroup.toLowerCase() : "";
    const musclePattern = muscleValue ? `%${muscleValue}%` : "";
    try {
        const results = await (0, db_1.query)(`
        SELECT id, name, primary_muscle_group, equipment, category, image_paths
        FROM exercises
        WHERE ($1 = '' OR LOWER(name) LIKE $2)
          AND ($3 = '' OR LOWER(primary_muscle_group) LIKE $3)
        ORDER BY name ASC
        LIMIT 100
      `, [searchValue, `%${searchValue}%`, musclePattern]);
        return res.json(results.rows.map(mapExerciseRow));
    }
    catch (err) {
        console.error("Failed to search exercises", err);
        return res.status(500).json({ error: "Failed to search exercises" });
    }
});
// Batch fetch exercises by IDs
router.get("/batch", async (req, res) => {
    const { ids } = req.query;
    if (!ids || typeof ids !== "string") {
        return res.json([]);
    }
    const requestedIds = ids.split(",").map((id) => id.trim());
    try {
        const metaMap = await (0, exerciseCatalog_1.fetchExerciseMetaByIds)(requestedIds);
        const results = requestedIds
            .map((id) => metaMap.get(id))
            .filter((ex) => Boolean(ex));
        return res.json(results);
    }
    catch (err) {
        console.error("Failed to load exercises batch", err);
        return res.status(500).json({ error: "Failed to load exercises" });
    }
});
exports.default = router;
