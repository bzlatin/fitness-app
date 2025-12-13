# Push/Pull Fitness App - Post-Launch Roadmap

> **Status**: Planning | **Last Updated**: 2025-12-12
>
> This document contains features and enhancements planned for after the initial app launch.
>
> For pre-launch features and current development status, see [ROADMAP.md](ROADMAP.md)

---

## Table of Contents

1. [Data Export](#data-export)
2. [Gift Pass Feature](#gift-pass-feature)
3. [Gym Equipment Preferences & Settings](#gym-equipment-preferences--settings)
4. [Social Video Workout Import](#social-video-workout-import)
5. [Apple Watch Companion App](#apple-watch-companion-app)

---

## Data Export

**Priority**: MEDIUM | **Effort**: 2-3 days | **Impact**: MEDIUM | **Status**: ☐ PLANNED

### Goal

Provide a user-controlled export of workout history for portability/compliance.

### User Experience

- Settings action: "Export my data" → choose CSV or JSON → email/share sheet with download link (time-limited)
- Export includes workouts, sets, templates, AI generations, and streak history; excludes PII beyond profile basics
- Show export status (queued → ready) and ability to regenerate

### Implementation Details

**Features**:

- Server job to compile export into CSV/JSON, store in object storage with signed URL (24h expiration)
- Rate limit to one export per user per 24h; log audit trail for compliance
- Client polling or web socket to update export status; uses share sheet for delivery if on device

**API Endpoints**:

- `POST /api/account/export` - Request data export
- `GET /api/account/export/status` - Check export status
- `GET /api/account/export/download/:exportId` - Download export file (signed URL)

**Files to Create/Modify**:

- `/server/src/routes/account.ts` - Data export request + status endpoints
- `/server/src/jobs/exportData.ts` - Export generator + storage upload
- `/mobile/src/screens/SettingsScreen.tsx` - Export CTA + status UI
- `/mobile/src/api/account.ts` - Export API client

**Export Format (CSV)**:

Multiple CSV files in a ZIP archive:
- `workouts.csv` - All workout sessions with dates and duration
- `sets.csv` - All logged sets with exercise, weight, reps
- `templates.csv` - All workout templates
- `exercises.csv` - Exercise library snapshot
- `analytics.csv` - Volume, fatigue, progression data

**Export Format (JSON)**:

Single JSON file with nested structure:
```json
{
  "user": { "handle": "@exhibited", "created_at": "..." },
  "workouts": [...],
  "templates": [...],
  "ai_generations": [...],
  "streaks": {...}
}
```

**Privacy & Compliance**:

- Export excludes sensitive data (password hash, payment info, email)
- Includes only user's own data (no squad member data)
- Audit log tracks all export requests
- Signed URLs expire after 24 hours
- GDPR/CCPA compliant data portability

---

## Gift Pass Feature

**Priority**: MEDIUM | **Effort**: 5-7 days | **Impact**: MEDIUM | **Status**: ☐ PLANNED

### Goal

Allow users to gift a 14-day Pro trial pass to friends/family, driving viral growth and Pro awareness.

### User Experience

- "Gift a Pass" button in Settings/Profile (Pro users only, or anyone)
- User enters recipient's email or handle
- Recipient gets notification/email with unique redemption link
- Link activates 14-day Pro trial (no payment method required)
- Tracking: who sent, who redeemed, conversion rate from gifted trials

### Implementation Details

**Features**:
- New `gift_passes` table with sender/recipient tracking and redemption status
- Email template for gift notification with redemption link
- Deep link handler for `pushpull://redeem/gift/{code}`
- Backend endpoint to create, send, and redeem gift passes
- UI in Settings for "Gift a Pass" with recipient input modal
- Analytics dashboard for tracking gift pass usage and conversions

**Database Schema**:

```sql
CREATE TABLE gift_passes (
  id TEXT PRIMARY KEY,
  sender_id TEXT REFERENCES users(id),
  recipient_email TEXT,
  recipient_id TEXT REFERENCES users(id),
  code TEXT UNIQUE NOT NULL,
  trial_days INTEGER NOT NULL DEFAULT 14,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  redeemed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'redeemed', 'expired'))
);

CREATE INDEX gift_passes_code_idx ON gift_passes(code);
CREATE INDEX gift_passes_sender_idx ON gift_passes(sender_id);
CREATE INDEX gift_passes_recipient_idx ON gift_passes(recipient_id);
```

**API Endpoints**:

- `POST /api/gifts/create` - Create gift pass
- `GET /api/gifts/sent` - List sent gift passes
- `GET /api/gifts/redeem/:code` - Get gift pass details
- `POST /api/gifts/redeem/:code` - Redeem gift pass
- `GET /api/gifts/analytics` - Gift pass analytics (admin)

**Files to Create/Modify**:

- `/server/src/routes/gifts.ts` - Gift pass CRUD endpoints
- `/server/src/services/email.ts` - Gift notification email template
- `/mobile/src/screens/GiftPassScreen.tsx` - Gift pass sending UI
- `/mobile/src/screens/RedeemGiftScreen.tsx` - Gift pass redemption UI
- `/mobile/src/api/gifts.ts` - Gift pass API client
- `/mobile/App.tsx` - Deep link handler for gift redemption
- `/server/src/db.ts` - Add gift_passes table

---

## Gym Equipment Preferences & Settings

**Priority**: HIGH | **Effort**: 8-12 days | **Impact**: VERY HIGH | **Status**: ☐ PLANNED

### Goal

Let users define their gym's available equipment to improve AI workout generation accuracy and enable warm-up sets and cardio recommendations.

### User Experience

**New Screen**: Gym Preferences (accessible from Settings → "Gym Equipment & Preferences")

#### 1. Equipment Selection

- **Categories with checkboxes**:
  - Small Weights (dumbbells, kettlebells)
  - Bars & Plates (barbells, EZ bars, trap bars)
  - Benches & Racks (flat/incline bench, squat rack, power rack)
  - Cable Machines (cable crossover, lat pulldown, cable row)
  - Resistance Bands (loop bands, resistance tubes)
  - Exercise Balls & More (stability ball, foam roller, medicine ball)
  - Plate-Loaded Machines (leg press, hack squat, chest press)
  - Weight Machines (Smith machine, leg extension, pec deck)
  - Rope & Suspension (battle ropes, TRX, suspension trainer)

- **Quick toggles**:
  - "Bodyweight Only" toggle (disables all equipment)
  - "Home Gym" vs "Commercial Gym" presets for quick setup

#### 2. Warm-Up Sets

- **Toggle**: "Auto-calculate warm-up sets"
- **Settings**:
  - Number of warm-up sets (1-3)
  - Starting percentage of working weight (40%, 50%, 60%)
  - Increment percentage per warm-up set (10%, 15%, 20%)
- **Display**: Show warm-up sets in WorkoutSessionScreen before working sets
- **Example**: Working weight 225 lbs → Warm-up sets:
  - Set 1: 90 lbs (40%)
  - Set 2: 135 lbs (60%)
  - Set 3: 180 lbs (80%)

#### 3. Cardio Recommendations

- **Toggle**: "Include cardio recommendations"
- **Settings**:
  - Cardio timing: Before weights / After weights / Separate session
  - Cardio type preference: LISS (steady state) / HIIT / Mixed
  - Target duration: 10/15/20/30 minutes
  - Frequency: 0-7 days per week
- **Features**:
  - AI workout generation includes cardio based on preferences
  - Cardio tracked separately in workout sessions (optional sets/reps)

#### 4. Workout Duration Preference

- **Slider**: Target session length (30/45/60/90 minutes)
- **AI Adjustment**: AI adjusts exercise selection, sets, and rest times to fit duration
- **Display**: Show estimated duration on workout templates and AI-generated workouts

### AI Integration

- Equipment selections filter exercises during AI workout generation
- AI only suggests exercises available with user's equipment
- Bodyweight-only mode prioritizes calisthenics and bodyweight exercises
- Warm-up sets auto-generated based on first working set weight
- Cardio recommendations added to workout template based on user preferences

### Implementation Details

**Database Schema**:

```sql
-- Extend users table with gym preferences
ALTER TABLE users ADD COLUMN gym_preferences JSONB DEFAULT '{
  "equipment": [],
  "bodyweightOnly": false,
  "warmupSets": {
    "enabled": false,
    "numSets": 2,
    "startPercentage": 50,
    "incrementPercentage": 15
  },
  "cardio": {
    "enabled": false,
    "timing": "after",
    "type": "mixed",
    "duration": 20,
    "frequency": 2
  },
  "sessionDuration": 60
}';

-- Extend workout_sessions to track cardio
ALTER TABLE workout_sessions ADD COLUMN cardio_data JSONB;
-- Structure: { type: "LISS" | "HIIT", duration: number, notes: string }
```

**API Endpoints**:

- `GET /api/user/gym-preferences` - Get user gym preferences
- `PUT /api/user/gym-preferences` - Update gym preferences

**Files to Create/Modify**:

- `/mobile/src/screens/GymPreferencesScreen.tsx` - Full gym preferences UI (new)
- `/mobile/src/components/gym/EquipmentSelector.tsx` - Equipment category selection
- `/mobile/src/components/gym/WarmupSettings.tsx` - Warm-up set configuration
- `/mobile/src/components/gym/CardioSettings.tsx` - Cardio preferences
- `/server/src/routes/social.ts` - Update profile endpoint to save gym_preferences
- `/server/src/services/ai/workoutPrompts.ts` - Filter exercises by equipment
- `/mobile/src/screens/WorkoutSessionScreen.tsx` - Display warm-up sets + cardio
- `/mobile/src/screens/SettingsScreen.tsx` - Add "Gym Preferences" navigation link
- `/mobile/src/utils/warmupCalculator.ts` - Warm-up set weight calculations

**Implementation Notes**:

- Equipment selections stored as array of strings (e.g., `["dumbbells", "barbells", "cable_machines"]`)
- Warm-up sets calculated client-side but could be server-side for consistency
- Cardio data optional in workout sessions (not required)
- AI prompt includes equipment filter: "Only use exercises available with: dumbbells, barbells, cable machines"
- Session duration impacts exercise count and rest times in AI generation

---

## Social Video Workout Import

**Priority**: MEDIUM | **Effort**: 10-14 days | **Impact**: MEDIUM | **Status**: ☐ PLANNED

### Goal

Let Pro users paste TikTok/Instagram fitness videos to generate a workout (transcript/caption driven).

### User Experience

- Paste video URL from TikTok or Instagram
- App fetches video metadata and transcript/captions
- AI analyzes content to extract exercises, sets, reps
- User previews generated workout and can edit before saving
- Saved template tagged with source video URL for reference

### Implementation Details

**Requirements**:

- Safe ingestion of third-party content plus transcript parsing and caching
- Pro gating + usage limits (e.g., 10 imports per month)
- Content safety filters to prevent inappropriate content
- Respect platform API rate limits and terms of service

**Features**:

- Reuse `user_exercises` table to tag generated templates with provenance (`source: "social_video"`, original URL)
- Transcript parsing service to extract exercise names and programming
- Fallback to caption/description if transcript unavailable
- Video URL validation and caching to avoid re-fetching

**Files to Create/Modify**:

- `/server/src/routes/ai.ts` - Social video import endpoint + Pro gating
- `/server/src/services/ai/socialVideoImport.ts` - Transcript parsing + workout generation
- `/mobile/src/screens/AIWorkoutImportScreen.tsx` - Paste link, show transcript preview, accept workout

**API Endpoints**:

- `POST /api/ai/import-video` - Import workout from video URL
- `GET /api/ai/import-status/:importId` - Check import status (async processing)

**Cost Considerations**:

- Video transcript extraction may require additional API costs
- Consider caching video metadata to reduce API calls
- Rate limit imports to prevent abuse

---

## Apple Watch Companion App

**Priority**: HIGH | **Effort**: 14-21 days | **Impact**: HIGH | **Status**: ☐ PLANNED

### Goal

Mirror active workouts to Apple Watch with a lightweight UI for at-a-glance progress and quick actions.

### User Experience

**Watch Features**:

- When a workout starts on iPhone, watch shows:
  - Current exercise name
  - Set/rep/weight target
  - Rest timer countdown
  - Set completion progress

**Simple Controls**:

- Log set (complete/skip)
- Start/pause rest timer
- Next/previous exercise
- End workout

**Offline Support**:

- Queue watch actions and reconcile with phone session when reconnected
- Phone remains source of truth
- Watch syncs updates bi-directionally

**Complications**:

- Show active session status
- Display rest countdown
- Quick launch to active workout

### Implementation Details

**Architecture**:

- Add watchOS companion app (SwiftUI) in Xcode
- Use Watch Connectivity framework to sync active session payloads from React Native bridge
- Expose native module on iOS to publish workout updates to watch
- Receive queued actions from watch (log set, advance exercise)
- Phone persists all actions to API and echoes updates back to watch

**Technical Requirements**:

- Requires custom dev client / bare workflow for watch target
- Watch app built in SwiftUI (native)
- React Native bridge for bidirectional communication
- Handle connectivity loss gracefully with action queuing
- Background app refresh for session updates

**Files to Create/Modify**:

- `/mobile/ios/WatchCompanion/` - SwiftUI watch app + connectivity session manager
- `/mobile/ios/WatchConnectivityModule.swift` - Native bridge for session sync and action handling
- `/mobile/src/services/watchSync.ts` - JS wrapper to publish workout updates and process watch intents
- `/mobile/src/screens/WorkoutSessionScreen.tsx` - Emit sync payloads on session start/set logged/next exercise
- `/mobile/docs/APPLE_WATCH_SETUP.md` - Build/setup guide (dev client, provisioning, pairing)

**Development Setup**:

1. Add watchOS target in Xcode project
2. Configure App Groups for data sharing
3. Set up Watch Connectivity session
4. Build custom dev client with watch extension
5. Test with paired Apple Watch (physical device required)

**Watch App Features**:

- **Home View**: Current exercise, set progress, targets
- **Controls View**: Quick actions (log set, skip, rest)
- **Rest Timer View**: Full-screen countdown with haptic feedback
- **Session Summary**: Final stats when workout completes

**Data Sync Strategy**:

- Push updates to watch on every set logged
- Pull latest state when watch app opens
- Reconcile conflicts with phone as source of truth
- Cache last session state for offline resilience

---

## Future Considerations

### Additional Post-Launch Features (Not Yet Specified)

- **Workout Program Templates**: Pre-built 4-12 week programs (e.g., "Beginner Strength", "Hypertrophy Focus")
- **Nutrition Tracking**: Basic macro logging integration (optional)
- **Form Video Library**: Exercise form videos with AI form check (camera-based)
- **Challenge System**: Community challenges (e.g., "30-day squat challenge")
- **Coach Portal**: Allow certified trainers to manage client workouts
- **API for Third-Party Integrations**: Zapier, MyFitnessPal, etc.

---

## Success Metrics (Post-Launch)

### Engagement

- **Gift Pass Conversion**: Target 20% redemption → paid conversion rate
- **Watch App Adoption**: 30% of iOS users with Apple Watch use companion app
- **Video Import Usage**: 10% of Pro users import at least one video workout per month

### Retention Impact

- Users with gym preferences configured: +15% 90-day retention
- Users with warm-up sets enabled: +10% workout completion rate
- Watch app users: +25% workout frequency vs non-watch users

### Technical Performance

- Watch app sync latency: <500ms for set logging
- Video import processing: <30 seconds for average video
- Gym preferences save: <200ms round-trip

---

## Version History

- **v2.0**: Gift Pass Feature + Gym Equipment Preferences
- **v2.1**: Social Video Import (TikTok/Instagram)
- **v2.2**: Apple Watch Companion App
- **v2.x**: Additional features TBD based on user feedback

---

## Questions & Decisions Needed

1. **Gift Pass Limits**: Should there be a limit on how many passes a user can send per month?
2. **Equipment Database**: Do we need to expand the exercise database with equipment tags?
3. **Video Import API**: Which third-party service for video transcript extraction? (YouTube API, AssemblyAI, etc.)
4. **Watch App Scope**: Should watch app support starting new workouts or only mirror active sessions?
5. **Warm-Up Set Logic**: Should warm-up percentages vary by exercise type (compound vs isolation)?
6. **Cardio Tracking**: Should cardio be its own session type or always attached to strength workouts?

---

**For current development status and pre-launch features, see [ROADMAP.md](ROADMAP.md)**
