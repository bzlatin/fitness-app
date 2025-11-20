import { WorkoutSession } from "../types/workouts";

export let sessions: WorkoutSession[] = [];

export const findSession = (id: string) =>
  sessions.find((session) => session.id === id);
