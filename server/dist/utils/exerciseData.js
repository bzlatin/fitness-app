"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadExercisesJson = exports.resolveExercisesPath = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
/**
 * Locate the bundled exercises.json in both dev (src) and production (dist) environments.
 * Render wasn't copying the static dataset, so we try multiple fallbacks to avoid crashes.
 */
const resolveExercisesPath = () => {
    const candidates = [
        // When running compiled code
        path_1.default.join(__dirname, "../data/dist/exercises.json"),
        // When running from repository root or during build
        path_1.default.resolve(process.cwd(), "dist/data/dist/exercises.json"),
        path_1.default.resolve(process.cwd(), "src/data/dist/exercises.json"),
        // When start/build is executed from repo root and server/ is nested
        path_1.default.resolve(process.cwd(), "server/dist/data/dist/exercises.json"),
        path_1.default.resolve(process.cwd(), "server/src/data/dist/exercises.json"),
        // When running from compiled folder but need to reach back to source
        path_1.default.resolve(__dirname, "../../src/data/dist/exercises.json"),
    ];
    for (const candidate of candidates) {
        if (fs_1.default.existsSync(candidate)) {
            return candidate;
        }
    }
    console.error("[Exercises] Database not found. Tried paths:", candidates);
    return null;
};
exports.resolveExercisesPath = resolveExercisesPath;
const loadExercisesJson = () => {
    const filePath = (0, exports.resolveExercisesPath)();
    if (!filePath)
        return [];
    try {
        return JSON.parse(fs_1.default.readFileSync(filePath, "utf-8"));
    }
    catch (error) {
        console.error(`[Exercises] Failed to read ${filePath}:`, error);
        return [];
    }
};
exports.loadExercisesJson = loadExercisesJson;
