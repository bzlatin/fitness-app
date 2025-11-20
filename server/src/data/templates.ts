import { generateId } from "../utils/id";
import {
  WorkoutTemplate,
  WorkoutTemplateExercise,
  DEMO_USER_ID,
} from "../types/workouts";

const nowIso = () => new Date().toISOString();

const empty = (): WorkoutTemplate[] => [];

export let templates: WorkoutTemplate[] = empty();

export const createTemplate = (input: {
  name: string;
  description?: string;
  splitType?: WorkoutTemplate["splitType"];
  exercises: Omit<
    WorkoutTemplateExercise,
    "id" | "orderIndex"
  >[];
}): WorkoutTemplate => {
  const createdAt = nowIso();
  const exerciseEntries: WorkoutTemplateExercise[] = input.exercises.map(
    (ex, idx) => ({
      ...ex,
      id: generateId(),
      orderIndex: idx,
    })
  );

  const template: WorkoutTemplate = {
    id: generateId(),
    userId: DEMO_USER_ID,
    name: input.name,
    description: input.description,
    splitType: input.splitType,
    isFavorite: false,
    exercises: exerciseEntries,
    createdAt,
    updatedAt: createdAt,
  };

  templates.push(template);
  return template;
};

export const findTemplate = (id: string) =>
  templates.find((t) => t.id === id);
