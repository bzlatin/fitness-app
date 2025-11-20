import { Router } from "express";
import { generateId } from "../utils/id";
import { templates as templateStore } from "../data/templates";
import { DEMO_USER_ID, WorkoutTemplate, WorkoutTemplateExercise } from "../types/workouts";

const router = Router();

const findTemplate = (id: string) =>
  templateStore.find((t) => t.id === id);

router.get("/", (_req, res) => {
  const templates = templateStore.filter((t) => t.userId === DEMO_USER_ID);
  res.json(templates);
});

router.get("/:id", (req, res) => {
  const template = findTemplate(req.params.id);
  if (!template) {
    return res.status(404).json({ error: "Template not found" });
  }
  return res.json(template);
});

router.post("/", (req, res) => {
  const { name, description, splitType, exercises } = req.body as {
    name?: string;
    description?: string;
    splitType?: WorkoutTemplate["splitType"];
    exercises?: Array<{
      exerciseId: string;
      defaultSets: number;
      defaultReps: number;
      defaultRestSeconds?: number;
      notes?: string;
    }>;
  };

  if (!name || !name.trim()) {
    return res.status(400).json({ error: "Name is required" });
  }
  if (!exercises || exercises.length < 1) {
    return res.status(400).json({ error: "At least one exercise required" });
  }

  const createdAt = new Date().toISOString();
  const exerciseEntries: WorkoutTemplateExercise[] = exercises.map(
    (ex, idx) => ({
      id: generateId(),
      exerciseId: ex.exerciseId,
      orderIndex: idx,
      defaultSets: ex.defaultSets,
      defaultReps: ex.defaultReps,
      defaultRestSeconds: ex.defaultRestSeconds,
      notes: ex.notes,
    })
  );

  const template: WorkoutTemplate = {
    id: generateId(),
    userId: DEMO_USER_ID,
    name: name.trim(),
    description,
    splitType,
    isFavorite: false,
    exercises: exerciseEntries,
    createdAt,
    updatedAt: createdAt,
  };

  templateStore.push(template);
  return res.status(201).json(template);
});

router.put("/:id", (req, res) => {
  const template = findTemplate(req.params.id);
  if (!template) {
    return res.status(404).json({ error: "Template not found" });
  }

  const { name, description, splitType, isFavorite, exercises } = req.body as Partial<
    WorkoutTemplate
  > & {
    exercises?: Array<{
      exerciseId: string;
      defaultSets: number;
      defaultReps: number;
      defaultRestSeconds?: number;
      notes?: string;
    }>;
  };

  if (name !== undefined && !name.trim()) {
    return res.status(400).json({ error: "Name is required" });
  }
  if (exercises && exercises.length < 1) {
    return res.status(400).json({ error: "At least one exercise required" });
  }

  if (name) template.name = name.trim();
  if (description !== undefined) template.description = description;
  if (splitType !== undefined) template.splitType = splitType;
  if (isFavorite !== undefined) template.isFavorite = isFavorite;

  if (exercises) {
    template.exercises = exercises.map((ex, idx) => ({
      id: generateId(),
      exerciseId: ex.exerciseId,
      orderIndex: idx,
      defaultSets: ex.defaultSets,
      defaultReps: ex.defaultReps,
      defaultRestSeconds: ex.defaultRestSeconds,
      notes: ex.notes,
    }));
  }

  template.updatedAt = new Date().toISOString();

  return res.json(template);
});

router.post("/:id/duplicate", (req, res) => {
  const existing = findTemplate(req.params.id);
  if (!existing) {
    return res.status(404).json({ error: "Template not found" });
  }

  const createdAt = new Date().toISOString();
  const duplicatedExercises = existing.exercises.map((ex) => ({
    ...ex,
    id: generateId(),
  }));

  const duplicate: WorkoutTemplate = {
    ...existing,
    id: generateId(),
    name: `${existing.name} (Copy)`,
    isFavorite: false,
    exercises: duplicatedExercises,
    createdAt,
    updatedAt: createdAt,
  };

  templateStore.push(duplicate);
  return res.status(201).json(duplicate);
});

export default router;
