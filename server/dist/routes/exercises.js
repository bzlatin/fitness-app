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
const exerciseData_1 = require("../utils/exerciseData");
const exercises_1 = require("../data/exercises");
const router = (0, express_1.Router)();
const distExercises = (0, exerciseData_1.loadExercisesJson)();
const exercisesSource = distExercises.length > 0 ? distExercises : exercises_1.exercises;
const dedupeId = (id) => id.replace(/\s+/g, "_");
const normalizeExercise = (item) => {
    const primary = item.primaryMuscles?.[0] ||
        (Array.isArray(item.primaryMuscleGroup)
            ? item.primaryMuscleGroup[0]
            : item.primaryMuscleGroup) ||
        "other";
    const equipment = item.equipment ||
        (Array.isArray(item.equipments)
            ? item.equipments[0]
            : item.equipments) ||
        "bodyweight";
    const images = item.images ?? [];
    const imageUrl = images.length > 0 ? `/api/exercises/assets/${images[0]}` : undefined;
    return {
        id: item.id || dedupeId(item.name),
        name: item.name,
        primaryMuscleGroup: primary.toLowerCase(),
        equipment: equipment.toLowerCase(),
        category: item.category?.toLowerCase(),
        gifUrl: imageUrl,
    };
};
// Build catalog from the JSON database
const normalizedCatalog = exercisesSource.map(normalizeExercise);
const exerciseMap = new Map(normalizedCatalog.map((item) => [item.id, item]));
// Serve static exercise images (dist dataset first, then raw exercises folder as fallback)
const imagesDirDist = path_1.default.join(__dirname, "../data/dist");
const imagesDirLegacy = path_1.default.join(__dirname, "../data/exercises");
router.use("/assets", express_1.default.static(imagesDirDist));
router.use("/assets", express_1.default.static(imagesDirLegacy));
router.get("/search", (req, res) => {
    const { query, muscleGroup } = req.query;
    const searchValue = typeof query === "string" ? query.toLowerCase() : "";
    const muscleValue = typeof muscleGroup === "string" ? muscleGroup.toLowerCase() : "";
    const results = normalizedCatalog
        .filter((ex) => {
        const matchesQuery = !searchValue || ex.name.toLowerCase().includes(searchValue);
        const matchesMuscle = !muscleValue ||
            ex.primaryMuscleGroup.toLowerCase().includes(muscleValue);
        return matchesQuery && matchesMuscle;
    })
        .slice(0, 100);
    return res.json(results);
});
// Batch fetch exercises by IDs
router.get("/batch", (req, res) => {
    const { ids } = req.query;
    if (!ids || typeof ids !== "string") {
        return res.json([]);
    }
    const requestedIds = ids.split(",").map((id) => id.trim());
    const results = requestedIds
        .map((id) => exerciseMap.get(id))
        .filter((ex) => Boolean(ex));
    return res.json(results);
});
exports.default = router;
