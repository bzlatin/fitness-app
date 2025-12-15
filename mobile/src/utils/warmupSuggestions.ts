export type WarmupSuggestion = {
  title: string;
  note?: string;
};

const normalizeMuscleGroup = (value: string) => value.trim().toLowerCase();

const SUGGESTIONS: Record<string, WarmupSuggestion[]> = {
  chest: [
    { title: "Roll chest", note: "30–45s per side" },
    { title: "Band pull-aparts", note: "2×12 smooth reps" },
  ],
  back: [
    { title: "Dead hang", note: "2×20–30s" },
    { title: "Band rows", note: "2×12 smooth reps" },
  ],
  shoulders: [
    { title: "Shoulder circles", note: "30–45s each direction" },
    { title: "Band external rotations", note: "2×10/side" },
  ],
  biceps: [
    { title: "Light curls", note: "1–2×12 easy reps" },
    { title: "Forearm extensor opens", note: "30–45s" },
  ],
  triceps: [
    { title: "Band pressdowns", note: "1–2×12 easy reps" },
    { title: "Overhead triceps stretch", note: "30–45s/side" },
  ],
  legs: [
    { title: "Bodyweight squats", note: "2×10 smooth reps" },
    { title: "Walking lunges", note: "10/side" },
  ],
  glutes: [
    { title: "Glute bridges", note: "2×10 with pause" },
    { title: "Lateral band walks", note: "10 steps each way" },
  ],
  core: [
    { title: "Dead bug", note: "2×6/side" },
    { title: "Plank", note: "20–30s" },
  ],
};

export const getWarmupSuggestionsForMuscleGroups = (
  muscleGroups: string[],
  options?: { maxSuggestions?: number }
) => {
  const maxSuggestions = options?.maxSuggestions ?? 4;
  const seen = new Set<string>();
  const suggestions: WarmupSuggestion[] = [];

  for (const group of muscleGroups.map(normalizeMuscleGroup)) {
    const list = SUGGESTIONS[group];
    if (!list) continue;
    for (const item of list) {
      const key = `${item.title}|${item.note ?? ""}`;
      if (seen.has(key)) continue;
      seen.add(key);
      suggestions.push(item);
      if (suggestions.length >= maxSuggestions) return suggestions;
    }
  }

  return suggestions;
};

