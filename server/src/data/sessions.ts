import { WorkoutSession } from "../types/workouts";

export let sessions: WorkoutSession[] = [];

export const findSession = (id: string, userId: string) =>
  sessions.find((session) => session.id === id && session.userId === userId);
