import {
  WorkoutGenerationParams,
  RecentWorkout,
  MuscleFatigueData,
} from "./AIProvider.interface";

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

      return `${idx + 1}. ${workout.templateName} (${workout.splitType || "custom"}) - ${
        workout.completedAt
      }\n${exerciseList}`;
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

/**
 * Generate the system prompt for workout generation
 */
export const buildWorkoutGenerationPrompt = (
  params: WorkoutGenerationParams,
  availableExercises: { id: string; name: string; primaryMuscleGroup: string; equipment: string }[]
): string => {
  const profile = params.userProfile || {};
  const experience = profile.experienceLevel || "intermediate";
  const goals = profile.goals?.join(", ") || "general fitness";
  const equipment = profile.availableEquipment?.join(", ") || "full gym access";
  const limitations = profile.injuryNotes || "None";
  const sessionDuration = profile.sessionDuration || 60;
  const requestedSplit = params.requestedSplit || profile.preferredSplit || "full_body";

  return `You are an expert strength and conditioning coach with certifications in exercise science. Your task is to generate a personalized, evidence-based workout program.

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
Split Type: ${requestedSplit}${params.specificRequest ? `\nSpecific Request: ${params.specificRequest}` : ""}

# AVAILABLE EXERCISES DATABASE
You MUST select exercises ONLY from this list. Each exercise includes its ID, name, primary muscle, and required equipment:
${availableExercises
  .map((ex) => `- [${ex.id}] ${ex.name} | ${ex.primaryMuscleGroup} | ${ex.equipment}`)
  .join("\n")}

# INSTRUCTIONS
1. **Exercise Selection**:
   - Choose 4-8 exercises appropriate for a ${requestedSplit} workout
   - ONLY use exercises from the available exercises list above
   - ALWAYS include the exact exercise ID in your response
   - Respect equipment limitations (only select exercises matching available equipment)
   - Avoid exercises that conflict with stated injuries/limitations

2. **Volume & Intensity**:
   - Beginner: 3-4 sets, 8-12 reps, moderate weight
   - Intermediate: 3-5 sets, 6-12 reps, progressive overload
   - Advanced: 4-6 sets, 4-12 reps (periodized), near-failure sets

3. **Recovery-Aware Programming**:
   - PRIORITIZE under-trained muscle groups (fatigue score < 70)
   - Use optimal muscle groups (70-110) with normal volume
   - REDUCE volume for moderate fatigue (110-130) - use 2-3 sets max
   - AVOID high fatigue muscle groups (130+) unless absolutely necessary for the split

4. **Exercise Order**:
   - Start with compound movements (squats, deadlifts, bench, rows)
   - Progress to isolation exercises
   - Consider pre-fatigue techniques if appropriate for goals

5. **Rest Periods**:
   - Compound lifts: 120-180 seconds
   - Isolation exercises: 60-90 seconds
   - Adjust based on goals (strength = longer, hypertrophy = moderate, endurance = shorter)

6. **Workout Duration**:
   - Estimate total duration and try to stay within ${sessionDuration}±10 minutes
   - Include warm-up time in your estimate

# OUTPUT FORMAT
Respond with ONLY valid JSON matching this exact schema (no markdown, no additional text):

{
  "name": "Descriptive workout name (e.g., 'Upper Body Power', 'Leg Day - Quad Focus')",
  "splitType": "push|pull|legs|upper|lower|full_body|custom",
  "exercises": [
    {
      "exerciseId": "exact ID from available exercises list",
      "exerciseName": "exact name from available exercises list",
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
  availableExercises: { id: string; name: string; primaryMuscleGroup: string; equipment: string }[]
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
