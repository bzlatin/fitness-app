# AI Workout Generator Setup Guide

This document explains how to configure and use the AI Workout Generator feature (Roadmap 2.1).

## Overview

The AI Workout Generator uses OpenAI's GPT-4o to create personalized workout programs based on:
- User profile (goals, experience level, available equipment)
- Recent workout history (last 5 workouts)
- Muscle group fatigue analysis (7-day rolling volume)
- Specific user requests

## Requirements

- **Pro Plan Required**: This feature is only available to users with an active Pro subscription
- **OpenAI API Key**: You need a valid OpenAI API key

## Setup Instructions

### 1. Get an OpenAI API Key

1. Go to [https://platform.openai.com/api-keys](https://platform.openai.com/api-keys)
2. Sign in or create an account
3. Click "Create new secret key"
4. Copy the key (starts with `sk-...`)

### 2. Add API Key to Environment

Add your OpenAI API key to `/server/.env`:

```bash
# Required: Your OpenAI API key
OPENAI_API_KEY=sk-your-actual-api-key-here

# Optional: Override the default model (default: gpt-4o)
# OPENAI_MODEL=gpt-4o-mini
```

### 3. Restart the Server

```bash
cd server
npm run dev
```

## Architecture

### Backend Structure

```
server/src/
├── services/ai/
│   ├── AIProvider.interface.ts    # Model-agnostic interface
│   ├── OpenAIProvider.ts          # OpenAI implementation
│   ├── workoutPrompts.ts          # Prompt engineering
│   └── index.ts                   # Factory function
├── services/fatigue.ts            # Muscle fatigue calculations
├── middleware/planLimits.ts       # Pro plan enforcement
└── routes/ai.ts                   # API endpoints
```

### Frontend Structure

```
mobile/src/
├── screens/WorkoutGeneratorScreen.tsx  # Main AI generation UI
├── components/premium/
│   └── UpgradePrompt.tsx              # Paywall for free users
└── api/ai.ts                          # API client
```

## API Endpoints

### POST `/api/ai/generate-workout`

Generate a personalized workout.

**Auth**: Required (Pro plan)

**Request Body**:
```json
{
  "requestedSplit": "push" | "pull" | "legs" | "upper" | "lower" | "full_body",
  "specificRequest": "Optional: Focus on chest, avoid squats, etc."
}
```

**Response**:
```json
{
  "success": true,
  "workout": {
    "name": "Upper Body Power",
    "splitType": "upper",
    "exercises": [
      {
        "exerciseId": "barbell_bench_press",
        "exerciseName": "Barbell Bench Press",
        "sets": 4,
        "reps": 8,
        "restSeconds": 180,
        "notes": "Focus on explosive concentric",
        "orderIndex": 0
      }
    ],
    "reasoning": "Prioritized chest and back with 2:1 ratio...",
    "estimatedDurationMinutes": 55
  }
}
```

**Error Responses**:
- `403`: User is not on Pro plan
- `429`: Rate limit exceeded (10 requests/minute)
- `500`: OpenAI API error

### GET `/api/ai/usage`

Get AI generation statistics for the current user.

**Auth**: Required (Pro plan)

**Response**:
```json
{
  "totalGenerations": 42,
  "lastGeneratedAt": "2025-11-23T10:30:00Z"
}
```

## Rate Limiting

- **Pro Users**: 10 workout generations per minute
- **Free Users**: No access (blocked with upgrade prompt)

## Database Tables

### `ai_generations`

Tracks all AI workout generations for analytics.

```sql
CREATE TABLE ai_generations (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  generation_type TEXT NOT NULL,  -- 'workout'
  input_params JSONB,
  output_data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

## How It Works

1. **User Profile**: Fetches onboarding data (goals, equipment, experience)
2. **Recent History**: Analyzes last 5 completed workouts
3. **Fatigue Analysis**: Calculates 7-day volume per muscle group
4. **AI Prompt**: Constructs detailed prompt with:
   - User context
   - Available exercises (filtered by equipment)
   - Recovery recommendations
   - Split-specific programming guidelines
5. **Generation**: GPT-4o generates structured JSON workout
6. **Validation**: Ensures all exercise IDs exist in database
7. **Preview**: User can review, regenerate, or save

## Prompt Engineering

The AI is instructed to:
- **Prioritize** under-trained muscle groups (fatigue < 70%)
- **Reduce volume** for fatigued muscles (fatigue > 130%)
- **Respect** equipment limitations and injuries
- **Program** sets/reps based on experience level
- **Order** exercises properly (compounds first)
- **Estimate** workout duration

## Cost Estimates

Using GPT-4o:
- **Input tokens**: ~2,000-3,000 tokens (user data + exercise database)
- **Output tokens**: ~500-800 tokens (workout JSON)
- **Cost per generation**: ~$0.015-$0.03

With 100 Pro users generating 10 workouts/month:
- **Monthly API cost**: ~$15-$30

## Swapping AI Providers

The architecture is model-agnostic. To add a new provider:

1. Create a new class implementing `AIProvider` interface:

```typescript
// server/src/services/ai/AnthropicProvider.ts
import { AIProvider } from "./AIProvider.interface";

export class AnthropicProvider implements AIProvider {
  async generateWorkout(params) {
    // Use Anthropic Claude API
  }
}
```

2. Update the factory function:

```typescript
// server/src/services/ai/index.ts
export const getAIProvider = (): AIProvider => {
  if (process.env.AI_PROVIDER === 'anthropic') {
    return new AnthropicProvider();
  }
  return new OpenAIProvider();
};
```

## Testing

To test the AI generation:

1. **Set user to Pro plan**:
   ```sql
   UPDATE users SET plan = 'pro' WHERE id = 'your-user-id';
   ```

2. **Add onboarding data** (optional, but improves results):
   ```sql
   UPDATE users SET onboarding_data = '{
     "goals": ["build_muscle", "strength"],
     "experience_level": "intermediate",
     "available_equipment": ["barbell", "dumbbell", "machine"],
     "weekly_frequency": 4,
     "session_duration": 60,
     "preferred_split": "push_pull_legs"
   }'::jsonb WHERE id = 'your-user-id';
   ```

3. **Complete some workouts** to generate history (optional)

4. **Navigate** to "My Workouts" → "Generate with AI"

5. **Select split** and click "Generate Workout"

## Troubleshooting

### "AI service not configured" error
- Check that `OPENAI_API_KEY` is set in `/server/.env`
- Verify the key starts with `sk-`
- Restart the server after adding the key

### "Pro plan required" error
- User is on free plan
- Update user plan: `UPDATE users SET plan = 'pro' WHERE id = 'user-id';`

### "Rate limit exceeded" error
- User made >10 requests in 1 minute
- Wait 60 seconds before trying again

### "No valid exercises generated" error
- AI returned exercise IDs not in the database
- Check that exercises database is loaded properly
- Try regenerating (AI may have hallucinated exercise names)

### Generation takes too long
- Normal: 10-30 seconds for GPT-4o
- Consider switching to `gpt-4o-mini` for faster responses (set `OPENAI_MODEL=gpt-4o-mini`)

## Future Enhancements

Planned for later phases:
- Exercise substitution suggestions (when user can't do an exercise)
- Progressive overload integration (suggest weight increases)
- Deload week detection (auto-generate recovery workouts)
- Custom exercise creation (add exercises not in database)
- Voice input for specific requests
- Save favorite generation preferences

## Security Notes

- ✅ API key stored in environment variables (not committed to git)
- ✅ Pro plan enforcement on backend (client-side check is just UX)
- ✅ Rate limiting to prevent abuse
- ✅ Usage tracking for billing and analytics
- ✅ Input validation on all parameters
- ⚠️ Exercise IDs validated against database (prevent injection)

## Support

For issues or questions:
1. Check server logs for detailed error messages
2. Verify OpenAI API key is valid and has credits
3. Test with simple requests first (e.g., "push" split with no specific notes)
4. Check OpenAI API status: https://status.openai.com/
