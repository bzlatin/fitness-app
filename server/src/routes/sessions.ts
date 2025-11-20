import { Router } from "express";
import { templates as templateStore } from "../data/templates";
import { sessions, findSession } from "../data/sessions";
import { WorkoutSession, WorkoutSet } from "../types/workouts";
import { generateId } from "../utils/id";

const router = Router();

router.post("/from-template/:templateId", (req, res) => {
  const userId = res.locals.userId;
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const template = templateStore.find(
    (t) => t.id === req.params.templateId && t.userId === userId
  );
  if (!template) {
    return res.status(404).json({ error: "Template not found" });
  }

  const startedAt = new Date().toISOString();

  const sets: WorkoutSet[] = template.exercises.flatMap((templateExercise) =>
    Array.from({ length: templateExercise.defaultSets }).map((_, idx) => ({
      id: generateId(),
      sessionId: "", // temp placeholder, assigned later
      templateExerciseId: templateExercise.id,
      exerciseId: templateExercise.exerciseId,
      setIndex: idx,
      targetReps: templateExercise.defaultReps,
      targetWeight: undefined,
    }))
  );

  const sessionId = generateId();
  sets.forEach((s) => {
    s.sessionId = sessionId;
  });

  const session: WorkoutSession = {
    id: sessionId,
    userId,
    templateId: template.id,
    startedAt,
    finishedAt: undefined,
    sets,
  };

  sessions.push(session);
  return res.status(201).json(session);
});

router.get("/:id", (req, res) => {
  const userId = res.locals.userId;
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const session = findSession(req.params.id, userId);
  if (!session) {
    return res.status(404).json({ error: "Session not found" });
  }
  return res.json(session);
});

router.patch("/:id", (req, res) => {
  const userId = res.locals.userId;
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const session = findSession(req.params.id, userId);
  if (!session) {
    return res.status(404).json({ error: "Session not found" });
  }

  const { sets, finishedAt } = req.body as Partial<WorkoutSession>;
  if (sets) {
    session.sets = sets.map((s) => ({
      ...s,
      sessionId: session.id,
      id: s.id ?? generateId(),
    }));
  }
  if (finishedAt !== undefined) {
    session.finishedAt = finishedAt;
  }

  return res.json(session);
});

export default router;
