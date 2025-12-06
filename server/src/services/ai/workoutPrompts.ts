import {
  WorkoutGenerationParams,
  RecentWorkout,
  MuscleFatigueData,
  FatigueTargets,
} from "./AIProvider.interface";

/**
 * Determine the next workout in a split cycle based on recent history
 */
export const determineNextInCycle = (
  recentWorkouts: RecentWorkout[],
  preferredSplit?: string
): string | undefined => {
  if (!preferredSplit || !recentWorkouts || recentWorkouts.length === 0) {
    return undefined;
  }

  // Define split cycles
  const splitCycles: Record<string, string[]> = {
    ppl: ["push", "pull", "legs"],
    upper_lower: ["upper", "lower"],
    bro_split: ["chest", "back", "legs", "shoulders", "arms"],
  };

  const cycle = splitCycles[preferredSplit];
  if (!cycle || cycle.length === 0) {
    return undefined;
  }

  // Get the most recent workout's split type
  const lastSplit = recentWorkouts[0]?.splitType?.toLowerCase();

  if (!lastSplit) {
    return cycle[0]; // Start with first in cycle
  }

  // Find where we are in the cycle
  const lastIndex = cycle.findIndex(
    (split) => lastSplit.includes(split) || split.includes(lastSplit)
  );

  if (lastIndex === -1) {
    return cycle[0]; // Not found, start from beginning
  }

  // Return next in cycle (wrapping around)
  const nextIndex = (lastIndex + 1) % cycle.length;
  return cycle[nextIndex];
};

/**
 * Format recent workouts for the AI prompt
 */
export const formatRecentWorkouts = (workouts: RecentWorkout[]): string => {
  if (!workouts || workouts.length === 0) {
    return "No recent workout history available.";
  }

  return workouts
    .map((workout, idx) => {
      const exerciseList = workout.exercises
        .map(
          (ex) =>
            `  - ${ex.exerciseName}: ${ex.sets} sets × ${ex.avgReps} reps${
              ex.avgWeight ? ` @ ${ex.avgWeight}lb` : ""
            }`
        )
        .join("\n");

      return `${idx + 1}. ${workout.templateName} (${
        workout.splitType || "custom"
      }) - ${workout.completedAt}\n${exerciseList}`;
    })
    .join("\n\n");
};

/**
 * Format muscle fatigue scores for the AI prompt
 */
export const formatFatigueScores = (fatigue?: MuscleFatigueData): string => {
  if (!fatigue) {
    return "No fatigue data available - treat all muscle groups as fresh.";
  }

  const scores = Object.entries(fatigue)
    .filter(([_, score]) => score !== undefined)
    .map(([muscle, score]) => {
      let status = "";
      if (score! < 70) status = "✅ Under-trained (prioritize)";
      else if (score! < 110) status = "🟢 Optimal";
      else if (score! < 130) status = "🟡 Moderate fatigue";
      else status = "🔴 High fatigue (avoid heavy work)";

      return `  - ${muscle}: ${score} (${status})`;
    })
    .join("\n");

  return scores || "No fatigue data available.";
};

const formatFatigueTargets = (targets?: FatigueTargets) => {
  if (!targets) return "No specific muscle bias provided.";
  const prioritize = targets.prioritize?.filter(Boolean) ?? [];
  const avoid = targets.avoid?.filter(Boolean) ?? [];

  if (prioritize.length === 0 && avoid.length === 0) {
    return "No specific muscle bias provided.";
  }

  return `Prioritize: ${
    prioritize.length > 0 ? prioritize.join(", ") : "auto based on split"
  }${avoid.length > 0 ? ` | Avoid/limit: ${avoid.join(", ")}` : ""}`;
};

/**
 * Generate the system prompt for workout generation
 */
export const buildWorkoutGenerationPrompt = (
  params: WorkoutGenerationParams,
  availableExercises: {
    id: string;
    name: string;
    primaryMuscleGroup: string;
    equipment: string;
  }[]
): string => {
  const profile = params.userProfile || {};
  const experience = profile.experienceLevel || "intermediate";
  const goals = profile.goals?.join(", ") || "general fitness";
  const equipment = profile.availableEquipment?.join(", ") || "full gym access";
  const limitations = profile.injuryNotes || "None";
  const sessionDuration = profile.sessionDuration || 60;
  const requestedSplit =
    params.requestedSplit ||
    (params.specificRequest ? "custom" : profile.preferredSplit || "full_body");
  const focusLabel = params.specificRequest
    ? params.specificRequest
        .replace(/focus on/gi, "")
        .replace(/target|emphasize|please/gi, "")
        .trim()
    : "";

  // Filter exercises if specific muscle groups are requested
  let exercisesToUse = availableExercises;
  let muscleGroupFilter = "";

  if (
    params.specificRequest &&
    params.specificRequest.toLowerCase().includes("focus on")
  ) {
    // Extract muscle groups from the specific request
    const muscleGroups = params.specificRequest
      .toLowerCase()
      .replace(/focus on/gi, "")
      .split(",")
      .map((m) => m.trim());

    // Create a mapping for muscle group variations
    const muscleGroupVariations: Record<string, string[]> = {
      back: ["middle back", "lower back", "lats", "back"],
      chest: ["chest", "pectorals"],
      shoulders: ["shoulders", "delts", "deltoids"],
      legs: ["quadriceps", "hamstrings", "glutes", "calves", "legs"],
      biceps: ["bicep", "biceps brachii", "arms"],
      triceps: ["tricep", "triceps brachii", "arms"],
      arms: ["biceps", "triceps", "forearms", "arms"], // Backwards compatibility with older clients
    };

    // Filter to only exercises that match these muscle groups
    exercisesToUse = availableExercises.filter((ex) => {
      return muscleGroups.some((requestedMuscle) => {
        // Direct match
        if (
          ex.primaryMuscleGroup.includes(requestedMuscle) ||
          requestedMuscle.includes(ex.primaryMuscleGroup)
        ) {
          return true;
        }

        // Check variations
        const variations = muscleGroupVariations[requestedMuscle] || [];
        return variations.some(
          (variation) =>
            ex.primaryMuscleGroup.includes(variation) ||
            variation.includes(ex.primaryMuscleGroup)
        );
      });
    });

    muscleGroupFilter = `\n\n⚠️ CRITICAL CONSTRAINT: You MUST ONLY select exercises that target these muscle groups: ${muscleGroups
      .join(", ")
      .toUpperCase()}. The exercise list below has been PRE-FILTERED to only include exercises for these muscles. DO NOT deviate from this constraint.`;
  }

  return `You are an expert strength and conditioning coach inspired by evidence-based training methodologies from top coaches like JPG Coaching, Jeff Nippard, Dr. Mike Israetel (Renaissance Periodization), and John Meadows. Your task is to generate a personalized, scientifically-backed workout program.

# USER PROFILE
- Experience Level: ${experience}
- Goals: ${goals}
- Available Equipment: ${equipment}
- Session Duration Target: ${sessionDuration} minutes
- Injury/Limitations: ${limitations}

# RECENT TRAINING HISTORY (Last 7 Days)
${formatRecentWorkouts(params.recentWorkouts || [])}

# MUSCLE GROUP FATIGUE ANALYSIS
${formatFatigueScores(params.muscleFatigue)}

# WORKOUT REQUEST
Split Type: ${requestedSplit}${
    params.specificRequest
      ? `\nSpecific Request: ${params.specificRequest}`
      : ""
  }${muscleGroupFilter}

# RECOVERY-BASED GUIDANCE
${formatFatigueTargets(params.fatigueTargets)}

# AVAILABLE EXERCISES DATABASE
You MUST select exercises ONLY from this list. Each exercise includes its ID, name, primary muscle, and required equipment:
${exercisesToUse
  .map(
    (ex) =>
      `- [${ex.id}] ${ex.name} | ${ex.primaryMuscleGroup} | ${ex.equipment}`
  )
  .join("\n")}

# INSTRUCTIONS
1. **Exercise Selection**:
   - Choose 4-8 exercises appropriate for ${
     params.specificRequest
       ? "the SPECIFIC muscle groups requested"
       : `a ${requestedSplit} workout`
   }
   - ONLY use exercises from the available exercises list above
   - ALWAYS include the exact exercise ID in your response
   - Use the human-friendly exercise name from the list (never the ID/slug) so photos and labels render correctly
   - Respect equipment limitations (only select exercises matching available equipment)
   - Avoid exercises that conflict with stated injuries/limitations
   - ${
     params.specificRequest
       ? "⚠️ CRITICAL: ALL exercises must target the specified muscle groups - do NOT include exercises for other muscle groups"
       : "Follow the split type guidelines strictly"
   }

2. **Volume & Intensity** (Based on Hypertrophy Research):
   - Beginner: 3-4 sets, 8-12 reps, 2-3 RIR (Reps In Reserve)
   - Intermediate: 3-5 sets, 6-12 reps, 1-3 RIR, progressive overload
   - Advanced: 4-6 sets, 4-12 reps (periodized), 0-2 RIR on most sets
   - Total weekly sets per muscle: 10-20 sets for hypertrophy (adjust based on fatigue)

3. **Recovery-Aware Programming** (SFR - Stimulus to Fatigue Ratio):
   - PRIORITIZE under-trained muscle groups (fatigue score < 70)
   - Use optimal muscle groups (70-110) with normal volume
   - REDUCE volume for moderate fatigue (110-130) - use 2-3 sets max
   - AVOID high fatigue muscle groups (130+) unless absolutely necessary for the split

4. **Exercise Order** (Based on Movement Patterns):
   - Start with compound movements (squats, deadlifts, bench, rows)
   - Progress to isolation exercises
   - For hypertrophy: prioritize exercises with good lengthened position (stretch-mediated hypertrophy)
   - Consider exercise variation to target different muscle regions

5. **Rest Periods** (Evidence-Based):
   - Compound lifts: 2-4 minutes (full ATP-PC recovery)
   - Isolation exercises: 60-120 seconds
   - Adjust for: strength = 3-5min, hypertrophy = 1.5-3min, metabolic stress = 30-90sec

6. **Workout Duration**:
   - Estimate total duration and try to stay within ${sessionDuration}±10 minutes
   - Include warm-up time in your estimate

7. **Naming & Labeling**:
   - Keep the workout name EXTREMELY brief (1-8 words max) - just a simple overview of what's trained
   - Use simple muscle group names or split types: "Push", "Pull", "Legs", "Upper", "Lower", "Full Body", "Back & Biceps", "Chest", etc.
   - NO descriptive words like "power", "volume", "focused", "day", "session", "workout", "training"
   - NO emojis or special characters except "&" and "-"
   - If a specific muscle focus is requested (${
     focusLabel || "none"
   }), name it after those muscles (e.g., "Arms", "Glutes & Hamstrings")
   - Use "custom" splitType for muscle-focus requests that are not standard splits.

# OUTPUT FORMAT
Respond with ONLY valid JSON matching this exact schema (no markdown, no additional text):

{
  "name": "Simple workout name (1-8 words, e.g., 'Push', 'Pull', 'Upper', 'Back & Biceps', 'Arms and Shoulder focus')",
  "splitType": "push|pull|legs|upper|lower|full_body|custom",
  "exercises": [
    {
      "exerciseId": "exact ID from available exercises list",
      "exerciseName": "exact name from available exercises list (never the ID/slug)",
      "primaryMuscleGroup": "exact muscle group from available exercises list",
      "sets": number,
      "reps": number,
      "restSeconds": number,
      "notes": "Brief coaching cue or progression note (optional)",
      "orderIndex": number (starting from 0)
    }
  ],
  "reasoning": "2-3 sentence explanation of why you programmed this workout this way, considering the user's fatigue, history, and goals",
  "estimatedDurationMinutes": number
}

Remember: Only use exercises from the provided database, always include exact exercise IDs, and prioritize user safety and recovery.`;
};

/**
 * Generate prompt for exercise substitution
 */
export const buildSubstitutionPrompt = (
  exerciseName: string,
  exerciseMuscle: string,
  reason: string,
  availableEquipment: string[],
  availableExercises: {
    id: string;
    name: string;
    primaryMuscleGroup: string;
    equipment: string;
  }[]
): string => {
  const equipmentList = availableEquipment.join(", ");

  return `You are an expert personal trainer. A user needs to substitute an exercise.

# ORIGINAL EXERCISE
Name: ${exerciseName}
Primary Muscle: ${exerciseMuscle}

# SUBSTITUTION REASON
${reason}

# AVAILABLE EQUIPMENT
${equipmentList}

# AVAILABLE EXERCISES DATABASE
${availableExercises
  .filter((ex) => ex.primaryMuscleGroup === exerciseMuscle)
  .map((ex) => `- [${ex.id}] ${ex.name} | ${ex.equipment}`)
  .join("\n")}

# INSTRUCTIONS
Find the best alternative exercise that:
1. Targets the same primary muscle group
2. Works with available equipment
3. Addresses the reason for substitution
4. Is biomechanically similar if possible

Respond with ONLY valid JSON:
{
  "exerciseId": "exact ID from list",
  "exerciseName": "exact name from list",
  "reasoning": "Brief explanation of why this is a good substitute"
}

If no suitable substitute exists, respond with: {"exerciseId": null}`;
};
