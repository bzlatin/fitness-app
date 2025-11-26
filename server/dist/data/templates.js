"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.findTemplate = exports.createTemplate = exports.templates = void 0;
const id_1 = require("../utils/id");
const workouts_1 = require("../types/workouts");
const nowIso = () => new Date().toISOString();
const empty = () => [];
exports.templates = empty();
const createTemplate = (input) => {
    const createdAt = nowIso();
    const exerciseEntries = input.exercises.map((ex, idx) => ({
        ...ex,
        id: (0, id_1.generateId)(),
        orderIndex: idx,
    }));
    const template = {
        id: (0, id_1.generateId)(),
        userId: workouts_1.DEMO_USER_ID,
        name: input.name,
        description: input.description,
        splitType: input.splitType,
        isFavorite: false,
        exercises: exerciseEntries,
        createdAt,
        updatedAt: createdAt,
    };
    exports.templates.push(template);
    return template;
};
exports.createTemplate = createTemplate;
const findTemplate = (id) => exports.templates.find((t) => t.id === id);
exports.findTemplate = findTemplate;
