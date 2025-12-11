# Push/Pull Fitness App - Feature Roadmap

> Last Updated: 2025-12-06
> Status: Phase 1-4 complete — Phase 4.4 (Retention & Feedback) 🎯 In progress (Profile/Settings + Streaks shipped) — Phase 5 (Marketing & Growth) ▶️ On deck after 4.4

## Product Vision

Build a social-first fitness app that combines intelligent workout programming with community motivation. Differentiate from competitors (Fitbod, Hevy, Strong) through AI-powered workout generation and robust squad features.

---

## Monetization Strategy

### Free Tier (Optimized for Viral Growth)

- ✅ Unlimited manual workout logging
- ✅ Full squad features (create, join, share, feed)
- ✅ Follow/followers social system
- ✅ Up to 3 saved workout templates
- ✅ Basic analytics (volume, streaks, calendar)
- ✅ Complete exercise library access
- ✅ Workout history tracking

### Pro Tier: $4.99/month or $49.99/year

- ✅ Unlimited workout templates
- ✅ AI workout generation (unlimited)
- ✅ Fatigue & recovery intelligence
- ✅ Progressive overload automation
- ✅ Advanced muscle group analytics
- ✅ Priority support
- ✅ 7-day free trial

**Competitive Positioning**: Priced at $49.99/year vs Fitbod's $60/year (~17% cheaper)

---

## Technical Stack

### Frontend

- React Native + Expo SDK 54
- TypeScript
- TanStack React Query (server state)
- NativeWind (Tailwind CSS)
- React Navigation 6

### Backend

- Node.js + Express + TypeScript
- PostgreSQL (no ORM, raw SQL)
- Auth0 (OIDC/JWT)
- OpenAI API (swappable architecture)

### Payments

- Stripe (React Native SDK + webhooks)

---

## Implementation Roadmap

### ✅ Phase 0: MVP Complete (Current State)

- [x] User authentication (Auth0)
- [x] Workout template builder
- [x] Live workout tracking
- [x] Workout history with calendar
- [x] Squad creation and management
- [x] Social feed (active workouts + shares)
- [x] Follow/followers system
- [x] Basic profile and settings
- [x] Exercise library (1700+ exercises)
- [x] Basic onboarding flow

---

### ✅ Phase 1: Core Experience & Foundation (Weeks 1-2)

#### 1.1 Target Muscle Display Accuracy ⚡ Quick Win ✅

**Priority**: HIGH | **Effort**: 1-2 days | **Impact**: HIGH

**Problem**: Users see "Target muscles" placeholder but no actual data based on loaded workout.

**Implementation**:

- [x] Create utility function to aggregate muscle groups from workout template exercises
- [x] Calculate primary + secondary muscle distribution percentages
- [x] Update HomeScreen to show muscle breakdown when workout is loaded
- [x] Add muscle group volume chart to WorkoutTemplateDetailScreen
- [x] Display muscle group breakdown in WorkoutSessionScreen header

**Technical Details**:

- Use existing `primaryMuscleGroup` field from exercises
- Group by muscle and calculate set count / total sets
- Visual: Simple bar chart or pill badges with percentages
- Data source: `workoutTemplate.exercises` joined with exercise DB

**Files Created/Modified**:

- ✅ `/mobile/src/screens/HomeScreen.tsx` - Added real muscle group data
- ✅ `/mobile/src/screens/WorkoutTemplateDetailScreen.tsx` - Added detailed breakdown
- ✅ `/mobile/src/screens/WorkoutSessionScreen.tsx` - Added header breakdown
- ✅ `/mobile/src/utils/muscleGroupCalculations.ts` - Created utility functions
- ✅ `/mobile/src/components/MuscleGroupBreakdown.tsx` - Created reusable component
- ✅ `/mobile/src/hooks/useMuscleGroupDistribution.ts` - Created data fetching hook

---

#### 1.2 Enhanced Onboarding Flow

**Priority**: HIGH | **Effort**: 5-7 days | **Impact**: HIGH

**Problem**: Current onboarding is single-step and doesn't capture data needed for AI workout generation.

**New Onboarding Steps**:

1. **Welcome** - Name, handle (optional)
2. **Goals** - Build muscle, lose weight, strength, endurance, general fitness (multi-select)
3. **Experience** - Beginner (<6 months), intermediate (6-24 months), advanced (2+ years)
4. **Equipment** - Gym (full), home (limited), bodyweight only, specific equipment list
5. **Schedule** - Weekly workout goal (3-7 days), preferred session length (30/45/60/90 min)
6. **Limitations** - Injury history (free text), movements to avoid (optional)
7. **Training Style** - Push/pull/legs, upper/lower, full body, custom

**Database Changes**:

```sql
ALTER TABLE users ADD COLUMN onboarding_data JSONB;
-- Structure: {
--   goals: string[],
--   experience_level: string,
--   available_equipment: string[],
--   weekly_frequency: number,
--   session_duration: number,
--   injury_notes: string,
--   preferred_split: string
-- }
```

**Implementation**:

- [x] Design multi-step wizard UI with progress indicator
- [x] Create OnboardingStep components for each screen
- [x] Add `onboarding_data` JSONB column to users table
- [x] Add onboarding handling to `/api/social/me` profile update endpoint
- [x] Update OnboardingScreen to multi-step flow
- [x] Store structured JSON in database
- [x] Add ability to re-take onboarding from settings

**Files to Create/Modify**:

- ✅ `/mobile/src/screens/OnboardingScreen.tsx` - Multi-step wizard + progress
- ✅ `/mobile/src/components/onboarding/` (new directory)
  - `WelcomeStep.tsx`
  - `GoalsStep.tsx`
  - `ExperienceStep.tsx` / `ExperienceLevelStep.tsx`
  - `EquipmentStep.tsx`
  - `ScheduleStep.tsx`
  - `LimitationsStep.tsx`
  - `TrainingSplitStep.tsx` / `TrainingStyleStep.tsx`
- ✅ `/server/src/routes/social.ts` - Profile update supports onboarding data + retake flow
- ✅ `/server/src/db.ts` - Added `onboarding_data` column to users

---

#### 1.3 Squad Invite Links (Viral Growth Feature)

**Priority**: HIGH | **Effort**: 3-4 days | **Impact**: HIGH

**Problem**: Inviting by handle is high-friction. Users want to share a link to group chats.

**Implementation**:

- [x] Generate unique invite code for each squad
- [x] Create `squad_invite_links` table with expiration support
- [x] Add "Share Invite Link" button to squad screen
- [x] Create deep link handler for `app://squad/join/{code}`
- [x] Build SquadJoinScreen that shows squad preview before joining
- [x] Implement join via link endpoint (validates code, adds member)
- [x] Track invite attribution (who invited whom)

**Database Schema**:

```sql
CREATE TABLE squad_invite_links (
  id TEXT PRIMARY KEY,
  squad_id TEXT REFERENCES squads(id) ON DELETE CASCADE,
  code TEXT UNIQUE NOT NULL,
  created_by TEXT REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  is_revoked BOOLEAN DEFAULT FALSE,
  uses_count INTEGER DEFAULT 0
);
```

**Technical Details**:

- Use Expo deep linking for `app://` URLs
- Share via React Native Share API
- Link format: `https://push-pull.app/squad/join/{code}` (redirects to deep link)
- Validate link hasn't expired or exceeded max uses
- Show squad name, member count, and sample members before joining

**Files to Create/Modify**:

- ✅ `/server/src/routes/social.ts` (invite endpoints + squad preview/join logic)
- ✅ `/mobile/src/screens/SquadJoinScreen.tsx` (new)
- ✅ `/mobile/src/screens/SquadScreen.tsx` (share button + invite management)
- ✅ `/mobile/App.tsx` (deep link config for `squad/join/:code`)
- ✅ `/server/src/db.ts` (migration + indexes for `squad_invite_links`)

**API Endpoints**:

- `POST /api/social/squads/:id/invites` - Create invite link
- `GET /api/social/squad-invite/:code` - Get squad preview
- `POST /api/social/squad-invite/:code/join` - Join squad via link
- `GET /api/social/squads/:id/invites` - List + manage active links
- `DELETE /api/social/squads/:id/invites/:inviteId` - Revoke link

---

### 🎯 Phase 2: AI & Premium Features (Weeks 3-6)

#### 2.1 AI Workout Generator (Killer Feature) ✅ COMPLETE

**Priority**: CRITICAL | **Effort**: 10-14 days | **Impact**: VERY HIGH | **Status**: ✅ IMPLEMENTED

**Goal**: Generate personalized workout programs using OpenAI based on user profile and history.

**Architecture** (Model-Agnostic):

```typescript
// /server/src/services/ai/AIProvider.interface.ts
interface AIProvider {
  generateWorkout(params: WorkoutGenerationParams): Promise<WorkoutTemplate>;
  suggestExerciseSubstitution(exercise: Exercise, reason: string): Promise<Exercise>;
}

// /server/src/services/ai/OpenAIProvider.ts
class OpenAIProvider implements AIProvider { ... }

// Easy to swap: class AnthropicProvider implements AIProvider { ... }
```

**Input Parameters**:

- User onboarding data (goals, experience, equipment, schedule)
- Recent workout history (last 4 weeks)
- Muscle group fatigue scores (calculated from history)
- Specific request (optional: "upper body", "leg day", "push workout")

**Output**:

- Complete WorkoutTemplate with exercises, sets, reps, rest times
- Exercise selection reasoning
- Progressive overload notes
- Estimated duration

**Implementation Steps**:

- [x] Create AIProvider interface and OpenAI implementation
- [x] Design prompt template with structured output (JSON mode)
- [x] Build workout generation endpoint with rate limiting
- [x] Integrated into HomeScreen swap modal (muscle focus + split selection)
- [x] Auto-save generated workouts as templates
- [x] Regeneration functionality built-in
- [x] Track AI generation usage per user (for analytics)
- [x] Show upgrade prompt if user is on free tier
- [x] Pro plan enforcement with proper gating

**Prompt Engineering**:

```typescript
const systemPrompt = `You are an expert strength & conditioning coach. Generate a personalized workout program based on the user's profile, goals, and recent training history.

User Profile:
- Experience: ${experience}
- Goals: ${goals.join(", ")}
- Equipment: ${equipment.join(", ")}
- Limitations: ${limitations}

Recent Training:
${formatRecentWorkouts(history)}

Muscle Group Fatigue:
${formatFatigueScores(fatigue)}

Instructions:
1. Select 4-8 exercises appropriate for ${requestedSplit}
2. Prioritize underworked muscle groups (low fatigue)
3. Respect equipment limitations and injuries
4. Program sets/reps for ${experience} level
5. Include progression notes

Output valid JSON matching this schema:
{
  "name": string,
  "split_type": string,
  "exercises": [
    {
      "exercise_id": string,
      "exercise_name": string,
      "sets": number,
      "reps": number,
      "rest_seconds": number,
      "notes": string,
      "order_index": number
    }
  ],
  "reasoning": string,
  "estimated_duration_minutes": number
}`;
```

**Files Created/Modified**:

- ✅ `/server/src/services/ai/` (new directory)
  - `AIProvider.interface.ts` - Model-agnostic interface
  - `OpenAIProvider.ts` - GPT-4o implementation
  - `workoutPrompts.ts` - Prompt engineering
  - `index.ts` - Factory function
- ✅ `/server/src/services/fatigue.ts` - Muscle fatigue calculations
- ✅ `/server/src/routes/ai.ts` - AI endpoints
- ✅ `/server/src/middleware/planLimits.ts` - Pro plan enforcement
- ✅ `/mobile/src/screens/HomeScreen.tsx` - Integrated AI into swap modal
- ✅ `/mobile/src/components/premium/UpgradePrompt.tsx` - Paywall modal
- ✅ `/mobile/src/api/ai.ts` - AI API client
- ✅ `/server/src/db.ts` - Added ai_generations table
- ✅ `AI_SETUP.md` - Complete documentation

**API Endpoints**:

- `POST /api/ai/generate-workout` - Generate workout
- `POST /api/ai/suggest-substitution` - Suggest alternative exercise

**Rate Limiting**:

- Free tier: Blocked with upgrade prompt (no trial auto-start)
- Pro tier: Unlimited (but track for abuse)
- Rate limit: 10 requests per minute per user

**Implementation Notes**:

- AI generation integrated into HomeScreen "Swap" modal
- Two flows: "Pick muscle focus" (Chest, Back, Legs, Shoulders, Arms) or "AI workout" (Push, Pull, Legs, Upper, Lower, Full Body)
- Auto-saves generated workouts as templates
- Loading state shows 10-30 second generation time
- Uses GPT-4o for best workout programming quality (~$0.02 per generation)
- Pro badges shown to free users
- @exhibited user temporarily set to Pro for testing (remove after Stripe integration)

**Cost Analysis**:

- Per generation: ~$0.015-0.03
- 100 Pro users × 10 workouts/month: ~$15-30/month API costs

---

#### 2.2 Fatigue & Recovery Intelligence

**Priority**: HIGH | **Effort**: 5-7 days | **Impact**: HIGH

**Goal**: Analyze training volume to estimate muscle group fatigue and suggest optimal training frequency.

**Methodology**:

1. Calculate volume per muscle group over rolling 7-day window
2. Compare to user's baseline (average from previous 4 weeks)
3. Flag muscle groups >130% of baseline as "fatigued"
4. Flag muscle groups <70% of baseline as "under-trained"
5. Suggest workouts targeting under-trained muscles

**Fatigue Score Algorithm**:

```typescript
// Simple but effective
fatigueScore = (last7DaysVolume / baselineVolume) * 100;
// 0-70: Under-trained (green)
// 70-110: Optimal (blue)
// 110-130: Moderate fatigue (yellow)
// 130+: High fatigue (red)
```

**Implementation**:

- [x] Create fatigue calculation service
- [x] Add weekly volume aggregation query (by muscle group)
- [x] Build RecoveryDashboard component showing fatigue scores
- [x] Add "What should I train today?" recommendation feature
- [x] Integrate fatigue data into AI workout generation
- [x] Show recovery status on HomeScreen
- [x] Add deload week detection (total volume <50% baseline)

**Database**:
No new tables needed - calculate from existing `workout_sessions` and `workout_sets`.

**Files to Create/Modify**:

- `/server/src/services/fatigue.ts` (new)
- `/server/src/routes/analytics.ts` (new)
- `/mobile/src/screens/RecoveryScreen.tsx` (new)
- `/mobile/src/components/FatigueIndicator.tsx` (new)
- `/mobile/src/screens/HomeScreen.tsx` (add recovery widget)

**API Endpoints**:

- `GET /api/analytics/fatigue` - Get current fatigue scores
- `GET /api/analytics/recommendations` - Get workout recommendations

---

#### 2.3 Progressive Overload Automation ✅ COMPLETE

**Priority**: MEDIUM | **Effort**: 4-5 days | **Impact**: MEDIUM | **Status**: ✅ IMPLEMENTED

**Goal**: Analyze performance trends and suggest weight increases when user is ready.

**Logic**:

- Track last 3 sessions for each exercise
- If user hit target reps on all sets for 2+ consecutive sessions → suggest +5-10lb increase
- If user exceeded target reps → suggest +2.5-5lb increase
- Display suggestions on template detail screen and during workout

**Implementation**:

- [x] Create progressive overload analysis service
- [x] Query last 3 sessions for each exercise in template
- [x] Calculate readiness score for weight increase
- [x] Add progression suggestion modal before workout starts
- [x] Show weight increase recommendations in modal
- [x] Add one-tap to apply suggestions (all or selected)
- [x] User preference toggle in Settings screen
- [x] Template-level override option
- [x] Support bodyweight exercises with rep progression suggestions
- [x] Smart increment calculation based on exercise type and current weight
- [x] Confidence levels (high/medium/low) for each suggestion
- [x] Modal blocks workout timer until dismissed

**Files Created/Modified**:

- ✅ `/server/src/services/progression.ts` - Complete progression analysis logic
- ✅ `/server/src/routes/analytics.ts` - Progression endpoints
- ✅ `/mobile/src/components/ProgressionSuggestion.tsx` - Full-featured modal UI
- ✅ `/mobile/src/screens/WorkoutSessionScreen.tsx` - Auto-check on workout start
- ✅ `/mobile/src/screens/SettingsScreen.tsx` - Global toggle setting
- ✅ `/mobile/src/api/analytics.ts` - API client functions
- ✅ `/server/src/db.ts` - Added `progressive_overload_enabled` columns
- ✅ `/mobile/src/types/user.ts` - Added preference type
- ✅ `/mobile/src/types/workouts.ts` - Added template-level setting

**API Endpoints**:

- `GET /api/analytics/progression/:templateId` - Get progression suggestions
- `POST /api/analytics/progression/:templateId/apply` - Apply selected/all suggestions

**Features Implemented**:

- **Smart Weight Increments**:
  - Compound exercises: 5-10 lb increases
  - Isolation exercises: 2.5-5 lb increases
  - Bodyweight exercises: Rep progression suggestions (no weight)
  - Weight-based scaling: Heavier lifts get larger increments
- **Confidence Scoring**: High/medium/low based on consistency
- **Selective Application**: Users can apply all or choose specific exercises
- **User Preferences**: Global toggle + template-level overrides
- **Modal Timing**: Shows 1.5s after workout loads, pauses timer until dismissed
- **Data Requirements**: Needs at least 3 sessions for suggestions

---

### ✅ Phase 3: Monetization (Weeks 7-9) — Complete

#### 3.1 Stripe Integration

**Priority**: CRITICAL | **Effort**: 10-12 days | **Impact**: VERY HIGH

**Goal**: Accept payments and manage subscriptions via Stripe.

**Stripe Products**:

1. **Pro Monthly**: $4.99/month (product ID: `prod_pro_monthly`)
2. **Pro Annual**: $49.99/year (product ID: `prod_pro_annual`)

**Implementation**:

- [x] Install Stripe React Native SDK
- [x] Create Stripe account and get API keys
- [x] Set up Stripe products and prices in dashboard
- [x] Create payment backend service
- [x] Implement subscription checkout flow
- [x] Build webhook handler for subscription events
- [x] Update user plan status on successful payment
- [x] Handle trial period (7 days)
- [x] Implement subscription cancellation
- [x] Build billing portal link
- [x] Add subscription status to profile screen

**Database Schema**:

```sql
ALTER TABLE users ADD COLUMN stripe_customer_id TEXT;
ALTER TABLE users ADD COLUMN stripe_subscription_id TEXT;
ALTER TABLE users ADD COLUMN trial_started_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN trial_ends_at TIMESTAMPTZ;

CREATE TABLE subscription_events (
  id TEXT PRIMARY KEY DEFAULT nanoid(),
  user_id TEXT REFERENCES users(id),
  event_type TEXT NOT NULL,
  stripe_event_id TEXT UNIQUE,
  payload JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Webhook Events to Handle**:

- `customer.subscription.created` → Set plan to 'pro', store subscription ID
- `customer.subscription.updated` → Update plan status
- `customer.subscription.deleted` → Revert to free plan
- `invoice.payment_succeeded` → Extend plan expiration
- `invoice.payment_failed` → Send warning, grace period

**Files to Create/Modify**:

- `/server/src/services/stripe.ts` (new)
- `/server/src/routes/subscriptions.ts` (new)
- `/server/src/webhooks/stripe.ts` (new)
- `/mobile/src/screens/UpgradeScreen.tsx` (new)
- `/mobile/src/screens/SettingsScreen.tsx` (add billing section)
- `/mobile/src/api/subscriptions.ts` (new)

**API Endpoints**:

- `POST /api/subscriptions/create-checkout-session` - Start checkout
- `GET /api/subscriptions/status` - Check subscription status
- `POST /api/subscriptions/cancel` - Cancel subscription
- `POST /api/subscriptions/billing-portal` - Get Stripe portal link
- `POST /webhooks/stripe` - Handle Stripe events (no auth)

**Security**:

- Verify webhook signatures
- Never trust client-side plan status (always check Stripe)
- Use Stripe test mode for development

---

#### 3.1b iOS In-App Purchases (IAP)

**Priority**: CRITICAL | **Effort**: 12-15 days | **Impact**: VERY HIGH | **Status**: ⚠️ BLOCKING iOS LAUNCH

**Goal**: Implement Apple In-App Purchases for iOS to comply with App Store guidelines. Maintain Stripe for Android/web.

**Why This Is Required**:

Apple App Store Guidelines (Section 3.1.1) mandate that all digital subscriptions use Apple's IAP system. The current Stripe-only implementation will be **rejected during iOS App Store review**. This is non-negotiable for iOS deployment.

**Implementation Strategy**: Platform-Specific Payments

- **iOS** → Apple In-App Purchases (StoreKit 2)
- **Android** → Stripe (current implementation)
- **Backend** → Unified subscription management handling both sources

**Note**: No web app version planned. Web presence will be a landing page only (see Phase 5).

**Apple IAP Products** (to create in App Store Connect):

1. **Pro Monthly**: $4.99/month (product ID: `pro_monthly_subscription`)
2. **Pro Annual**: $49.99/year (product ID: `pro_yearly_subscription`)

**Revenue Split**:

- Apple: 30% first year, 15% after 1 year of continuous subscription
- Your app: 70% first year, 85% after 1 year

**Implementation Tasks**:

**Setup & Configuration:**

- [x] Create Apple Developer account ($99/year)
- [x] Register app in App Store Connect
- [x] Create two subscription products in App Store Connect
- [ ] Set up StoreKit Configuration file for local testing (app.config.ts expects `./ios/StoreKit/Configuration.storekit`, file not present)
- [x] Add iOS bundle identifier to `app.config.ts`
- [x] Configure Apple Team ID in Expo build settings (env values not set)

**Backend:**

- [x] Install `node-app-store-server-api` or `@apple/app-store-server-library`
- [x] Create iOS receipt validation service (`/server/src/services/appstore.ts`)
- [x] Add `apple_original_transaction_id` column to users table
- [x] Add `apple_subscription_id` column to users table
- [x] Create unified subscription service that handles both Stripe and Apple
- [x] Add endpoints for iOS receipt validation:
  - `POST /api/subscriptions/ios/validate-receipt` - Validate and activate subscription
  - `GET /api/subscriptions/ios/status` - Check App Store subscription status
- [x] Add Apple App Store Server Notification webhook handler (`/webhooks/appstore`)
- [x] Handle App Store notification types:
  - `INITIAL_BUY` → Activate Pro plan
  - `DID_RENEW` → Extend plan expiration
  - `DID_FAIL_TO_RENEW` → Grace period warning
  - `DID_CHANGE_RENEWAL_STATUS` → Handle cancellation
  - `EXPIRED` → Revert to free plan
  - `REFUND` → Immediate plan revocation

**Frontend:**

- [x] Install `react-native-iap` (most popular library)
- [x] Create platform-agnostic payment service (`/mobile/src/services/payments.ts`)
- [x] Implement iOS IAP flow:
  - Initialize IAP connection on app start
  - Fetch available products from App Store
  - Purchase product via `requestSubscription()`
  - Send receipt to backend for validation
  - Update local subscription status
- [x] Update UpgradeScreen to detect platform and route to correct payment flow
- [x] Add iOS-specific subscription management UI
- [ ] Handle App Store subscription states (trial, active, grace period, expired)
- [x] Add restore purchases functionality (required by Apple)
- [x] Handle pending purchases on app launch

**Database Schema**:

```sql
ALTER TABLE users ADD COLUMN apple_original_transaction_id TEXT;
ALTER TABLE users ADD COLUMN apple_subscription_id TEXT;
ALTER TABLE users ADD COLUMN subscription_platform TEXT; -- 'stripe', 'apple', null

CREATE TABLE appstore_notifications (
  id TEXT PRIMARY KEY DEFAULT nanoid(),
  user_id TEXT REFERENCES users(id),
  notification_type TEXT NOT NULL,
  transaction_id TEXT,
  original_transaction_id TEXT,
  payload JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_appstore_notifications_user ON appstore_notifications(user_id);
CREATE INDEX idx_appstore_notifications_original_tx ON appstore_notifications(original_transaction_id);
```

**Files to Create**:

- `/server/src/services/appstore.ts` - Receipt validation and status checks
- `/server/src/webhooks/appstore.ts` - Apple Server-to-Server notifications
- `/mobile/src/services/payments.ts` - Platform-agnostic payment abstraction
- `/mobile/src/services/iap.ts` - iOS-specific IAP logic
- `/mobile/ios/StoreKit/Configuration.storekit` - Local testing configuration

**Files to Modify**:

- `/server/src/db.ts` - Add Apple-specific columns and table
- `/server/src/index.ts` - Register App Store webhook route
- `/mobile/src/screens/UpgradeScreen.tsx` - Add platform detection and iOS IAP flow
- `/mobile/src/screens/SettingsScreen.tsx` - Add "Restore Purchases" button for iOS
- `/mobile/App.tsx` - Initialize IAP connection on startup
- `/mobile/app.config.ts` - Add iOS bundle ID and StoreKit config path
- `/mobile/package.json` - Add react-native-iap dependency

**API Endpoints** (New):

- `POST /api/subscriptions/ios/validate-receipt` - Validate App Store receipt
- `GET /api/subscriptions/ios/status` - Get subscription status from App Store
- `POST /webhooks/appstore` - Handle Apple Server Notifications (no auth)

**Platform Detection Logic**:

```typescript
// /mobile/src/services/payments.ts
import { Platform } from "react-native";
import * as IAP from "./iap"; // iOS implementation
import * as StripePayments from "./stripe"; // Android/web implementation

export const startSubscription = async (plan: "monthly" | "annual") => {
  if (Platform.OS === "ios") {
    return IAP.purchaseSubscription(plan);
  }
  return StripePayments.startCheckout(plan);
};
```

**iOS-Specific Requirements**:

- [x] Add "Restore Purchases" button (Apple requires this)
- [x] Handle subscription groups in App Store Connect
- [x] Configure introductory offers (7-day free trial)
- [x] Add subscription terms URL (required for App Store; content lives at `web/src/app/terms/page.tsx`)
- [x] Add privacy policy URL (required for App Store; content lives at `web/src/app/privacy/page.tsx`)
- [x] Implement "Manage Subscription" deep link to iOS Settings
- [x] Test with Sandbox users in App Store Connect
- [ ] Submit subscription details for App Review

**Testing Checklist**:

- [ ] Test iOS purchase flow in TestFlight
- [ ] Test Android purchase flow (Stripe should still work)
- [ ] Test trial period on iOS (7 days)
- [ ] Test restore purchases on new iOS device
- [ ] Test subscription renewal via App Store sandbox
- [ ] Test subscription cancellation from iOS Settings
- [ ] Test receipt validation with Apple servers
- [ ] Test webhook handling from App Store
- [ ] Test subscription status sync between platforms
- [ ] Verify 403 errors work correctly when subscription expires

**Security & Best Practices**:

- Validate all receipts server-side (never trust client)
- Use Apple's production servers for validation (not verifyReceipt - deprecated)
- Store original_transaction_id as source of truth for iOS
- Handle edge cases: refunds, subscription upgrades/downgrades
- Implement idempotency for webhook handlers
- Rate limit receipt validation endpoint

**Remaining Compliance TODO (iOS IAP)**

- Add subscription terms URL and privacy policy URL to product metadata (and in-app links).
- Configure Apple Team ID in Expo/EAS build settings.
- Finalize subscription group + intro offer settings in App Store Connect to match StoreKit config.
- Run sandbox tests (purchase, restore, renewal, cancellation, refund) and capture screenshots for App Review.

**Cost Analysis**:

- **Apple Commission**: 30% year 1, 15% after (vs Stripe's 2.9% + $0.30)
- **Example**: $4.99/month subscription
  - Apple IAP: You get $3.49 (30% = $1.50 to Apple)
  - Stripe: You get $4.70 (2.9% + $0.30 = $0.29 to Stripe)
- **Annual**: $49.99/year
  - Apple IAP: You get $33.59 (30% = $14.40 to Apple)
  - Stripe: You get $46.60 (2.9% + $0.30 = $1.39 to Stripe)

**Migration Path**:

Since this is pre-launch with no existing iOS users:

1. Implement iOS IAP alongside Stripe (not a migration, just addition)
2. Backend handles both payment platforms simultaneously
3. User record stores `subscription_platform` to know which system to check

**Documentation to Create**:

- [x] `IOS_IAP_SETUP.md` - Setup guide for App Store Connect
- [x] Update README with iOS testing instructions
- [x] Document subscription platform switching (if user moves from Android to iOS)

**Deployment Considerations**:

- App Store review typically takes 1-3 days
- First submission with subscriptions may take longer (extra scrutiny)
- Need screenshots of subscription UI for App Store listing
- Must provide test account for Apple reviewers

---

#### 3.2 Paywall Implementation

**Priority**: HIGH | **Effort**: 4-5 days | **Impact**: HIGH

**Goal**: Enforce free tier limits and trigger upgrade prompts.

**Free Tier Limits**:

- ✅ 3 workout templates maximum
- ✅ No AI generation (show upgrade prompt)
- ✅ No fatigue tracking (show upgrade prompt)
- ✅ No progression suggestions (show upgrade prompt)
- ✅ Basic analytics only

**Trial Logic**:

- User navigates to UpgradeScreen → starts 7-day trial via Stripe checkout
- Trial grants full Pro access (managed by Stripe subscription status)
- After 7 days → Stripe auto-charges if payment method added, or subscription expires
- If trial expires without payment → user reverts to free limits automatically

**Implementation Status**:

✅ **Completed**:

- [x] Create plan enforcement middleware (`requireProPlan`, `checkTemplateLimit`)
- [x] Create UpgradePrompt component (reusable)
- [x] Add upgrade prompts to AI generation button
- [x] Basic template limit enforcement in UI

✅ **Completed Tasks**:

**Backend:**

- [x] Apply `checkTemplateLimit` middleware to `POST /api/templates` endpoint
- [x] Apply `requireProPlan` middleware to `GET /api/analytics/fatigue` endpoint
- [x] Apply `requireProPlan` middleware to `GET /api/analytics/recommendations` endpoint
- [x] Apply `requireProPlan` middleware to `GET /api/analytics/progression/:templateId` endpoint
- [x] Apply `requireProPlan` middleware to `POST /api/analytics/progression/:templateId/apply` endpoint

**Frontend - Template Limits:**

- [x] Fix template limit constant: Change from 5 to 3 in `/mobile/src/utils/featureGating.ts`
- [x] Add "X/3 templates" counter UI to MyWorkoutsScreen header (always visible for free users)
- [x] Update template limit error message in MyWorkoutsScreen to show PaywallComparisonModal instead of Alert
- [x] Apply template limit check in WorkoutTemplateBuilderScreen before save

**Frontend - Recovery/Fatigue Paywall:**

- [x] Add Pro plan check to RecoveryScreen
- [x] Show PaywallComparisonModal when free users try to access AI workout generation
- [x] Navigate to UpgradeScreen from PaywallComparisonModal

**Frontend - Progression Paywall:**

- [x] Add Pro plan check before showing ProgressionSuggestion modal in WorkoutSessionScreen
- [x] Show PaywallComparisonModal when free users try to access progression
- [x] Disable progression toggle in SettingsScreen for free users (gray out with "Pro" badge)

**Frontend - Trial Experience:**

- [x] Create TrialBanner component showing "X days left in trial" countdown
- [x] Add TrialBanner to HomeScreen (show only during active trial)
- [x] Calculate days remaining from `subscriptionStatus.trialEndsAt` timestamp
- [x] Add "Upgrade Now" CTA button in TrialBanner

**Frontend - Onboarding Enhancement:**

- [x] Create PlanSelectionStep component (step 9 of onboarding)
- [x] Add plan selection to OnboardingScreen (Free vs Pro comparison)
- [x] Allow users to start 7-day trial or continue with free during onboarding

**Error Handling:**

- [x] Handle 403 errors from analytics endpoints gracefully (show upgrade prompt instead of crash)
- [x] Handle 403 errors from template save endpoint (show upgrade prompt)
- [ ] Add error boundary for subscription status fetch failures

**Testing Checklist:**

- [ ] Test free user cannot create 4th template
- [ ] Test free user sees upgrade prompt on AI generation attempt
- [ ] Test free user cannot access RecoveryScreen (or sees upgrade prompt)
- [ ] Test free user cannot access progression suggestions
- [ ] Test trial user has full Pro access for 7 days
- [ ] Test trial expires and user reverts to free tier
- [ ] Test Pro user has no limits

**Files Created/Modified**:

- ✅ `/server/src/middleware/planLimits.ts` - Created with `requireProPlan` and `checkTemplateLimit`
- ✅ `/mobile/src/components/premium/UpgradePrompt.tsx` - Created (deprecated in favor of PaywallComparisonModal)
- ✅ `/mobile/src/components/premium/PaywallComparisonModal.tsx` - Created full-featured comparison modal
- ✅ `/mobile/src/components/premium/TrialBanner.tsx` - Created trial countdown banner
- ✅ `/mobile/src/components/onboarding/PlanSelectionStep.tsx` - Created plan selection for onboarding
- ✅ `/mobile/src/utils/featureGating.ts` - Fixed template limit from 5 to 3
- ✅ `/mobile/src/screens/MyWorkoutsScreen.tsx` - Added template counter, PaywallComparisonModal integration
- ✅ `/mobile/src/screens/RecoveryScreen.tsx` - Added Pro check and PaywallComparisonModal for AI generation
- ✅ `/mobile/src/screens/WorkoutSessionScreen.tsx` - Added Pro check for progression with PaywallComparisonModal
- ✅ `/mobile/src/screens/SettingsScreen.tsx` - Disabled progression toggle for free users with upgrade prompt
- ✅ `/mobile/src/screens/HomeScreen.tsx` - Added TrialBanner during trial
- ✅ `/mobile/src/screens/OnboardingScreen.tsx` - Added plan selection step (9 steps total)
- ✅ `/server/src/routes/templates.ts` - Applied checkTemplateLimit to POST /
- ✅ `/server/src/routes/analytics.ts` - Applied requireProPlan to fatigue/recommendations/progression endpoints

**Upgrade Prompt Copy**:

```
🚀 Unlock Unlimited Templates

You've reached the 3 template limit on the free plan.

Upgrade to Pro to get:
✓ Unlimited workout templates
✓ AI workout generation
✓ Fatigue & recovery tracking
✓ Smart progression suggestions

Start 7-day free trial →
```

---

**Phase 3 Remaining Work (not yet in code):**

- [x] Add Apple Team ID env + StoreKit configuration file (`mobile/ios/StoreKit/Configuration.storekit`) to satisfy `app.config.ts`.
- [ ] Surface App Store subscription states (trial/grace/expired) in mobile UI (Upgrade/Settings/Home) and block expired/grace users with the paywall.
- [x] Wire App Store metadata and in-app links to legal pages: `web/src/app/terms/page.tsx` and `web/src/app/privacy/page.tsx`.
- [x] Configure App Store subscription group + 7-day intro offer to match StoreKit SKUs (handled in App Store Connect).
- [ ] Add an error boundary/fallback for subscription status fetch failures.
- [ ] Run monetization QA: iOS sandbox purchase/restore/renew/cancel/refund + webhook sync; Stripe/Android checkout regression; paywall/403 flows and template-limit gating. _(Deferred to post-Phase 4.2 alongside TestFlight/App Store Connect builds.)_

### 📊 Phase 4: Analytics & Retention (Weeks 10-12)

Current focus: 5.1 Landing Page & App Store Presence (next)

#### 4.1 Advanced Muscle Group Analytics ✅ COMPLETE

**Priority**: MEDIUM | **Effort**: 5-6 days | **Impact**: MEDIUM | **Status**: ✅ IMPLEMENTED (2025-11-30)

**Features**:

- [x] Weekly volume per muscle group chart (last 12 weeks)
- [x] Push vs Pull volume balance indicator
- [x] Most/least trained muscle groups
- [x] Volume PR tracking per muscle group
- [x] Muscle group frequency heatmap (calendar view)

**Implementation Details**:

**Backend Service** (`/server/src/services/muscleAnalytics.ts`):

- ✅ `getWeeklyVolumeByMuscleGroup()` - Aggregates volume by week and muscle for charting
- ✅ `getMuscleGroupSummaries()` - Total volume, sets, workouts, and last trained date per muscle
- ✅ `getPushPullBalance()` - Calculates push/pull/leg volume with balance recommendations
- ✅ `getVolumePRs()` - Tracks peak volume weeks and current progress per muscle
- ✅ `getFrequencyHeatmap()` - Training frequency analysis with most common training days
- ✅ `getAdvancedAnalytics()` - Combined endpoint for all analytics

**API Endpoints** (all Pro-gated):

- `GET /api/analytics/muscle-analytics?weeks={4|8|12}` - All analytics data
- `GET /api/analytics/weekly-volume?weeks={N}` - Chart data
- `GET /api/analytics/muscle-summaries?weeks={N}` - Summary cards
- `GET /api/analytics/push-pull-balance?weeks={N}` - Balance analysis
- `GET /api/analytics/volume-prs?weeks={N}` - PR tracking
- `GET /api/analytics/frequency-heatmap?weeks={N}` - Frequency data

**UI Components**:

- ✅ `/mobile/src/components/VolumeChart.tsx` - Interactive SVG line chart with:

  - Multi-muscle group visualization with color coding
  - Clickable legend for filtering muscle groups
  - Horizontal scrolling for 12-week view
  - Auto-scaling Y-axis based on volume
  - Data point tooltips via circles on graph

- ✅ `/mobile/src/screens/AnalyticsScreen.tsx` - Comprehensive Pro analytics dashboard:
  - Pro plan paywall with feature list for free users
  - Time range selector (4/8/12 weeks)
  - Weekly volume chart with muscle filtering
  - Push/Pull balance card with ratio and recommendations
  - Muscle group summary cards (top 8 by volume)
  - Volume PR tracking with % of peak for top 6 muscles
  - Training frequency summary with weekly averages
  - Pull-to-refresh support
  - Loading and error states

**Navigation**:

- ✅ Added `Analytics` route to `/mobile/src/navigation/types.ts`
- ✅ Registered screen in `/mobile/src/navigation/RootNavigator.tsx`
- ✅ Added "Advanced Analytics" card to HomeScreen (Pro users only)

**TypeScript Types** (`/mobile/src/types/analytics.ts`):

- ✅ `WeeklyVolumeData` - Chart data structure
- ✅ `MuscleGroupSummary` - Summary metrics
- ✅ `PushPullBalance` - Balance analysis
- ✅ `VolumePR` - PR tracking data
- ✅ `FrequencyHeatmapData` - Frequency metrics
- ✅ `AdvancedAnalytics` - Combined type

**Files Created**:

- `/server/src/services/muscleAnalytics.ts` - Complete analytics service
- `/mobile/src/components/VolumeChart.tsx` - Custom SVG chart component
- `/mobile/src/screens/AnalyticsScreen.tsx` - Full analytics dashboard

**Files Modified**:

- `/server/src/routes/analytics.ts` - Added 6 new Pro endpoints
- `/mobile/src/api/analytics.ts` - API client functions
- `/mobile/src/types/analytics.ts` - TypeScript definitions
- `/mobile/src/navigation/types.ts` - Added Analytics route
- `/mobile/src/navigation/RootNavigator.tsx` - Registered screen
- `/mobile/src/screens/HomeScreen.tsx` - Added navigation card

**Key Design Decisions**:

- **Pro Feature**: All advanced analytics are Pro-only to drive subscriptions
- **Performance**: Week-based aggregation with configurable time ranges (4/8/12 weeks)
- **Push/Pull Categories**: chest/shoulders/triceps = Push, back/biceps = Pull, legs/glutes = Legs
- **Chart Library**: Custom SVG implementation using react-native-svg (already installed)
- **Volume Calculation**: `sets × reps × weight` with bodyweight fallback (100 lbs)
- **PR Tracking**: Rolling 52-week window for peak volume detection

---

#### 4.2 Squad Management Enhancements ✅ COMPLETE

**Priority**: LOW | **Effort**: 3-4 days | **Impact**: MEDIUM | **Status**: ✅ IMPLEMENTED (2025-12-05)

**Features**:

- [x] Remove member (admin only)
- [x] Add co-admin role
- [x] Squad settings page (rename, change visibility, description)
- [x] Leave squad option
- [x] Block/report user
- [x] Squad member search
- [x] Leave emojis or comments on squad members workouts
- [x] Improve UI of overall squad viewing page to make it feel more like a community, making it more interactive
- [x] Transfer ownership functionality

**Database Changes**:

```sql
-- Squad description and visibility (already had role column)
ALTER TABLE squads ADD COLUMN description TEXT;
ALTER TABLE squads ADD COLUMN is_public BOOLEAN NOT NULL DEFAULT false;

-- Workout reactions (unified for both active statuses and shares)
CREATE TABLE workout_reactions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL CHECK (target_type IN ('status', 'share')),
  target_id TEXT NOT NULL,
  reaction_type TEXT NOT NULL CHECK (reaction_type IN ('emoji', 'comment')),
  emoji TEXT,
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX workout_reactions_target_idx ON workout_reactions(target_type, target_id);
CREATE INDEX workout_reactions_user_idx ON workout_reactions(user_id);
CREATE UNIQUE INDEX workout_reactions_unique_emoji_idx
  ON workout_reactions(user_id, target_type, target_id, emoji)
  WHERE reaction_type = 'emoji';

-- User blocks table
CREATE TABLE user_blocks (
  blocker_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blocked_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (blocker_id, blocked_id)
);
```

**Files Created**:

- `/mobile/src/screens/SquadDetailScreen.tsx` - Enhanced squad viewing with member management
- `/mobile/src/screens/SquadSettingsScreen.tsx` - Squad settings page (name, description, visibility)
- `/mobile/src/components/social/WorkoutReactions.tsx` - Reusable emoji reactions and comments component

**Files Modified**:

- `/server/src/db.ts` - Added new tables and columns for reactions, blocks, squad settings
- `/server/src/routes/social.ts` - Added 15+ new endpoints for squad management, reactions, comments, blocking
- `/mobile/src/api/social.ts` - Added API client functions for all new endpoints
- `/mobile/src/types/social.ts` - Extended SquadDetail, added EmojiReaction, WorkoutComment, ReactionsData types
- `/mobile/src/screens/SquadScreen.tsx` - Integrated WorkoutReactions component, added long-press navigation to SquadDetailScreen
- `/mobile/src/navigation/types.ts` - Added SquadDetail and SquadSettings routes
- `/mobile/src/navigation/RootNavigator.tsx` - Registered new screens

**API Endpoints (New)**:

Squad Management:

- `GET /api/social/squads/:squadId` - Get squad details
- `PUT /api/social/squads/:squadId` - Update squad settings (name, description, isPublic)
- `DELETE /api/social/squads/:squadId/members/:memberId` - Remove member (admin only)
- `PUT /api/social/squads/:squadId/members/:memberId/role` - Promote/demote member (owner only)
- `POST /api/social/squads/:squadId/leave` - Leave squad
- `POST /api/social/squads/:squadId/transfer` - Transfer ownership
- `GET /api/social/squads/:squadId/members/search` - Search squad members

User Blocking:

- `POST /api/social/block` - Block user
- `DELETE /api/social/block/:blockedId` - Unblock user
- `GET /api/social/blocked` - Get blocked users list

Reactions & Comments:

- `POST /api/social/reactions` - Add emoji reaction
- `DELETE /api/social/reactions/:targetType/:targetId/:emoji` - Remove reaction
- `POST /api/social/comments` - Add comment
- `DELETE /api/social/comments/:commentId` - Delete comment
- `GET /api/social/reactions/:targetType/:targetId` - Get reactions and comments

**Key Implementation Details**:

- **Role Hierarchy**: owner > admin > member
  - Owner: Can do everything, transfer ownership, delete squad
  - Admin: Can remove members (not other admins), manage invites, update settings
  - Member: Can view, leave, react, comment
- **Emoji Reactions**: Supported emojis: 🔥, 💪, 🚀, 🙌, ❤️, 👏
- **Comments**: 500 character limit, only author can delete
- **Optimistic UI**: Reactions update instantly with rollback on error
- **Long-press Navigation**: Hold squad pill to navigate to SquadDetailScreen
- **Admin Badge**: Shield icon shown next to admin/owner names

---

#### 4.3 Workout Reactions & Comments ✅ COMPLETE (Merged into 4.2)

**Priority**: LOW | **Effort**: 4-5 days | **Impact**: LOW | **Status**: ✅ IMPLEMENTED (2025-12-05)

**Note**: This feature was implemented as part of 4.2 Squad Management Enhancements.

**Features Implemented**:

- [x] Add emoji reactions to feed items (both active workout statuses and completed shares)
- [x] Add comment section to workout shares
- [x] Optimistic UI updates for instant feedback
- [x] Comments modal with full comment list
- [ ] Push notifications for reactions (future)

**Technical Details**:

- Single `workout_reactions` table handles both emojis and comments
- Unique constraint prevents duplicate emoji reactions per user
- Supports reactions on both "status" (live workouts) and "share" (completed workouts)
- Comments are text-only with 500 character limit
- Real-time reaction counts in compact view

---

### 🔄 Phase 4.4: Retention & Feedback (Pre-Phase 5)

#### 4.4.1 Smart Goal-Based Notifications ✅ COMPLETE

**Priority**: HIGH | **Effort**: 4-5 days | **Impact**: HIGH | **Status**: ✅ IMPLEMENTED (2025-12-05)

**Goal**: Deliver meaningful, non-spammy push notifications that protect weekly goals and celebrate consistency.

**Key Triggers**:

- [x] Approaching weekly goal miss (24-48 hours left with remaining sessions above threshold)
- [x] Inactivity nudge (no logged workout in 5-7 days, respects rest days)
- [x] Squad highlights (teammate hits weekly goal or reacts to your workout, with frequency capping)
- [x] Weekly goal met (positive reinforcement, single celebratory push)

**Implementation**:

- [x] Add notification scheduler to server (cron/worker) that checks goal risk and inactivity once daily
- [x] Add user-level quiet hours + frequency cap (max 3 per week) in settings
- [x] Add client-side in-app inbox for missed pushes
- [x] Instrument with analytics to measure open → session starts

**Files Created**:

- `/server/src/jobs/notifications.ts` - Complete notification scheduler with goal risk, inactivity, weekly goal met, and squad activity checks
- `/server/src/routes/notifications.ts` - Full notification preferences API (register token, get/update preferences, inbox management)
- `/mobile/src/services/notifications.ts` - Push registration, Expo notifications setup, and inbox sync
- `/mobile/src/components/notifications/NotificationInbox.tsx` - In-app notification inbox with unread badges
- `/mobile/src/screens/NotificationInboxScreen.tsx` - Full-screen notification inbox view

**Files Modified**:

- `/server/src/db.ts` - Added `push_token`, `notification_preferences` JSONB to users table; created `notification_events` table
- `/server/src/app.ts` - Registered notifications router
- `/mobile/src/screens/SettingsScreen.tsx` - Added notification preferences UI with toggles for each trigger type

**Key Features Implemented**:

- **Notification Triggers**:

  - Goal Risk: Sends 1-2 days before week end if user needs 1+ sessions to hit goal
  - Inactivity: One nudge after 5-7 days of no workouts
  - Weekly Goal Met: Celebration notification when completing weekly goal
  - Squad Reactions: Real-time or daily digest of squad member reactions
  - Squad Goal Met: When squad members complete their weekly goals

- **User Preferences** (stored in JSONB):

  - Toggle each notification type on/off
  - Quiet hours (default: 22:00 - 8:00)
  - Max notifications per week (default: 3)

- **In-App Inbox**:

  - View last 30 days of notifications
  - Unread badge count
  - Mark as read/clicked for analytics
  - Delete individual notifications
  - Pull-to-refresh

- **Smart Delivery**:
  - Respects quiet hours (no notifications during sleep)
  - Weekly cap prevents notification fatigue
  - Deduplication prevents multiple notifications for same trigger
  - Tracks delivery status (sent, failed, no_token)

**Database Schema**:

```sql
-- User notification preferences
ALTER TABLE users ADD COLUMN push_token TEXT;
ALTER TABLE users ADD COLUMN notification_preferences JSONB DEFAULT '{
  "goalReminders": true,
  "inactivityNudges": true,
  "squadActivity": true,
  "weeklyGoalMet": true,
  "quietHoursStart": 22,
  "quietHoursEnd": 8,
  "maxNotificationsPerWeek": 3
}';

-- Notification event tracking
CREATE TABLE notification_events (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  notification_type TEXT NOT NULL,
  trigger_reason TEXT,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  data JSONB,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  read_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ,
  delivery_status TEXT NOT NULL DEFAULT 'sent',
  error_message TEXT
);
```

**API Endpoints**:

- `POST /api/notifications/register-token` - Register Expo push token
- `GET /api/notifications/preferences` - Get notification preferences
- `PUT /api/notifications/preferences` - Update notification preferences
- `GET /api/notifications/inbox` - Get notification inbox with pagination
- `POST /api/notifications/inbox/:id/read` - Mark notification as read
- `POST /api/notifications/inbox/:id/clicked` - Mark notification as clicked
- `POST /api/notifications/inbox/mark-all-read` - Mark all as read
- `DELETE /api/notifications/inbox/:id` - Delete notification

**Notification Scheduler**:

The notification job (`processNotifications()`) should be run once daily (recommended: 9am local time) using a cron job or task scheduler:

```typescript
import { processNotifications } from "./jobs/notifications";

// Example: Run daily at 9am using node-cron
import cron from "node-cron";
cron.schedule("0 9 * * *", async () => {
  await processNotifications();
});
```

**Dependencies Added**:

- `expo-notifications` (mobile) - Push notification handling
- `expo-device` (mobile) - Device detection for push tokens
- `expo-server-sdk` (server) - Sending push notifications from backend

**Testing Notes**:

To test notifications:

1. Enable notifications in SettingsScreen
2. Grant notification permissions when prompted
3. Use the scheduler job or send test notifications via API
4. Check inbox in SettingsScreen → "View Inbox"
5. Verify quiet hours and weekly cap enforcement

#### 4.4.2 Profile & Settings Redesign

**Priority**: HIGH | **Effort**: 3-4 days | **Impact**: HIGH | **Status**: ✅ COMPLETE

**Goal**: Simplify profile, move settings-type controls into a dedicated settings hub, and spotlight identity/achievements. Tackle the SettingsScreen rework first; then refine the Profile layout and shortcuts.

**Changes**:

- Prioritize SettingsScreen: regroup Account, Preferences, Billing, Notifications, and Feedback; add clear section headers and safe defaults
- Compact settings into tappable rows/cards (Fitbod-style) with drill-in detail views for preferences, billing, and notifications
- Add gear icon on Profile to open SettingsScreen (no bottom nav change)
- Profile layout: hero with avatar/handle, quick stats (streak, goal progress), squad badge
- Add shortcuts: “Edit goals”, “Manage squads”, “View feedback board”

**Implementation**:

- Redesign ProfileScreen layout with cleaner hierarchy and tappable cards
- Expand SettingsScreen with grouped sections and empty states; wire navigation for billing/preferences/feedback
- Add graceful empty states and consistent spacing for mobile ergonomics

**Files to Create/Modify**:

- `/mobile/src/screens/ProfileScreen.tsx` - New layout + gear icon nav
- `/mobile/src/screens/SettingsScreen.tsx` - New sections and routing for billing/preferences/feedback
- `/mobile/src/navigation/RootNavigator.tsx` - Ensure Settings accessible only via Profile gear
- `/mobile/src/components/profile/ProfileHeader.tsx` - Extracted header for readability

#### 4.4.3 Consistency & Streaks (Weekly-Goal-Based)

**Priority**: HIGH | **Effort**: 4-6 days | **Impact**: HIGH | **Status**: ✅ COMPLETE

**Goal**: Encourage sustainable habits with weekly-goal streaks and squad-aware celebrations (rest-day friendly).

**Experience**:

- Surface current streak (weekly goal based) on Home hero and Profile header
- Weekly Goal Streak: Count consecutive weeks hitting goal; pauses on deload weeks flagged in fatigue service
- Recovery-Friendly Rules: Rest days baked in; streak only depends on weekly target, not daily check-ins
- Squad Shoutouts: Automatic feed card when a member extends streak; users can cheer/emoji react
- Streak Saver: One “grace week” per quarter users can spend to keep streak if within 1 session of goal

**Implementation**:

- Add streak calculation service (server) using existing workouts + goals
- Extend Home + Squad feeds with streak chips/badges
- Add streak history graph to Analytics screen (lightweight)

**Files to Create/Modify**:

- `/server/src/services/streaks.ts` - Weekly streak calculations + grace logic
- `/server/src/routes/engagement.ts` - Streak stats endpoint
- `/mobile/src/components/StreakBadge.tsx` - UI chip for Home/Squad
- `/mobile/src/screens/AnalyticsScreen.tsx` - Add streak history section
- `/mobile/src/screens/SquadScreen.tsx` - Show squad streak shoutouts

#### 4.4.4 In-App Feedback Board ✅ COMPLETE

**Priority**: MEDIUM | **Effort**: 4-5 days | **Impact**: MEDIUM | **Status**: ✅ COMPLETE (2025-12-06)

**Goal**: Capture and prioritize user requests without leaving the app; surface top-voted items.

**Experience**:

- [x] FeedbackBoard screen accessible from Profile → Settings (gear icon) with badge indicator for newly shipped features
- [x] Submit ideas with category + impact tag; vote/upvote functionality (no comments - keeping it simple)
- [x] Sort by trending (weighted recent votes), top all-time, and recent; show status pills (Submitted/Under Review/Planned/In Progress/Shipped/Won't Fix/Duplicate)
- [x] Lightweight moderation (report + auto-hide after 5 reports, admin review panel)
- [x] Admin interface for updating feedback status (accessible to users with handle @exhibited via admin_users table)

**Implementation**:

- [x] Added feedback_items, feedback_votes, feedback_reports, admin_users tables to database
- [x] Profanity filter middleware with rate limiting (5 submissions per hour per user)
- [x] Exposed endpoints for create, vote, report, status update (admin-only)
- [x] Client-side optimistic voting with React Query
- [x] Unique handle constraint enforcement to prevent duplicates during onboarding
- [x] Auto-hide feedback items after 5 reports (admin can review and unhide)

**Files Created/Modified**:

- ✅ `/server/src/routes/feedback.ts` - Full CRUD + voting + reporting endpoints
- ✅ `/server/src/middleware/profanityFilter.ts` - Content moderation + rate limiting
- ✅ `/server/src/db.ts` - Database schema with admin_users, feedback_items, feedback_votes, feedback_reports tables
- ✅ `/server/src/app.ts` - Registered feedback routes
- ✅ `/mobile/src/api/feedback.ts` - API client with React Query hooks + helper functions
- ✅ `/mobile/src/screens/FeedbackBoardScreen.tsx` - Main feedback board with sorting, filtering, admin controls
- ✅ `/mobile/src/components/feedback/FeedbackCard.tsx` - Card UI with vote button, status badges, report functionality
- ✅ `/mobile/src/components/feedback/SubmitFeedbackModal.tsx` - Full-screen modal for submitting feedback
- ✅ `/mobile/src/screens/SettingsScreen.tsx` - Added feedback board link with badge indicator for new shipped items
- ✅ `/mobile/src/navigation/RootNavigator.tsx` - Registered FeedbackBoard screen
- ✅ `/mobile/src/navigation/types.ts` - Added FeedbackBoard route type

**Implementation Notes**:

- Admin access is granted to users with handle @exhibited via the admin_users table
- Badge indicator shows count of newly shipped items (last 7 days) that the user voted on
- Profanity filter includes basic word list; can be expanded based on moderation needs
- Trending sort uses weighted algorithm: `vote_count * (1 + 1 / (days_since_creation + 1))`
- Auto-hide threshold set to 5 reports to balance spam prevention with false positives
- No comment system implemented to keep the feature simple and focused on voting

#### 4.4.5 iOS Widgets (Weekly Goal + Quick Actions) ✅ COMPLETE (Phase 1)

**Priority**: MEDIUM | **Effort**: 5-7 days | **Impact**: HIGH | **Status**: ✅ PHASE 1 COMPLETE (2025-12-06)

**Goal**: Improve retention with glanceable progress and one-tap entry points on iOS.

**Implementation Status**:

**Phase 1 (Completed)** ✅:

- [x] Weekly Goal Ring widget (Small & Medium sizes)
- [x] Quick Start widget (Medium size with action buttons)
- [x] Widget data API endpoint with caching
- [x] Deep linking support for widget actions
- [x] App Groups setup for data sharing
- [x] Config plugin for WidgetKit extension

**Phase 2 (Completed)** ✅:

- [x] Quick Set Logger (active session only) - COMPLETE (2025-12-07)

**Phase 3 (Completed)** ✅:

- [x] Dynamic Island support (iOS 16.1+) - COMPLETE (2025-12-07)
- [x] Live Activities for active workout sessions - COMPLETE (2025-12-07)
- [x] Live rest timer countdown in Live Activity

**Widget & Live Activity Concepts**:

- ✅ **Weekly Goal Ring** (Widget): Progress toward sessions/volume goal with streak indicator
- ✅ **Quick Start** (Widget): One-tap shortcuts to start workout or quick log
- ✅ **Quick Set Logger** (Widget): One-tap to log current set from home screen (Phase 2 COMPLETE)
- ✅ **Live Activities** (Dynamic Island + Lock Screen): Auto-appearing workout tracker (Phase 3 COMPLETE)
  - ✅ Appears automatically when workout starts (no manual install)
  - ✅ Dynamic Island support (iPhone 14 Pro+)
  - ✅ Lock Screen persistent notification (all devices iOS 16.1+)
  - ✅ Live rest timer countdown
  - ✅ Real-time exercise/set updates
  - ✅ Auto-dismisses on workout completion

**Files Created**:

**Phase 1 (Widgets - Weekly Goal)**:

- ✅ `/mobile/plugins/withWidgets.js` - Expo config plugin for WidgetKit
- ✅ `/mobile/ios/Widgets/README.md` - Setup instructions
- ✅ `/mobile/ios/Widgets/PushPullWidgets.swift` - Weekly Goal widget
- ✅ `/mobile/ios/Widgets/WidgetsBundle.swift` - Widget bundle registration
- ✅ `/mobile/ios/pushpull/WidgetSyncModule.swift` - Native bridge for widget data sync
- ✅ `/mobile/src/services/widgetSync.ts` - React Native widget data sync service
- ✅ `/server/src/routes/engagement.ts` - Widget data endpoint
- ✅ `/mobile/app.config.ts` - Added widget plugin
- ✅ `/mobile/App.tsx` - Added widget deep link routes

**Phase 2 (Quick Set Logger Widget)**:

- ✅ `/mobile/ios/Widgets/QuickSetLoggerWidget.swift` - Quick Set Logger widget UI
- ✅ `/mobile/WIDGET_INTEGRATION_GUIDE.md` - Integration guide
- ✅ `/mobile/src/services/widgetSync.ts` - Extended with active session support
- ✅ `/mobile/src/screens/WorkoutSessionScreen.tsx` - Integrated widget sync

**Phase 3 (Live Activities)**:

- ✅ `/mobile/ios/Widgets/WorkoutActivityAttributes.swift` - Live Activity data model
- ✅ `/mobile/ios/Widgets/WorkoutLiveActivity.swift` - Dynamic Island + Lock Screen UI
- ✅ `/mobile/ios/pushpull/LiveActivityModule.swift` - Native bridge for Live Activities
- ✅ `/mobile/ios/pushpull/LiveActivityModule.m` - Objective-C bridge
- ✅ `/mobile/src/services/liveActivity.ts` - JavaScript API wrapper
- ✅ `/mobile/src/screens/WorkoutSessionScreen.tsx` - Integrated Live Activity calls
- ✅ `/LIVE_ACTIVITIES_COMPLETE.md` - Complete implementation guide

**Deep Links Implemented**:

- `pushpull://workout/start` - Start new workout (navigates to Home)
- `pushpull://workout/log` - Quick log workout (navigates to Home)
- `pushpull://workout/log-set` - Log current set in active workout (Phase 2)
- `pushpull://profile` - View profile/settings

**Widget Sizes Supported**:

- **Small**: Weekly Goal Ring, Quick Set Logger
- **Medium**: Weekly Goal Ring + Stats, Quick Start buttons, Quick Set Logger with details

**Phase 2 Implementation Details**:

**Quick Set Logger Widget:**

- Displays current exercise name, set number (e.g., "Set 3/4"), and target reps/weight
- Shows last set performance after logging (e.g., "Last set: 8 reps @ 185 lbs")
- "Log Set" button deep links to app (`pushpull://workout/log-set`)
- Automatically updates when user logs sets in the app
- Shows "No Active Workout" state when no session is active
- Refreshes every 30 seconds during active workout, every 5 minutes otherwise

**Data Sync Architecture:**

- `syncActiveSessionToWidget()` helper function syncs session data to App Group UserDefaults
- Called when: workout starts, set logged, exercise changed, workout completed
- Widget reads from App Group UserDefaults via `QuickSetLoggerProvider`
- Deep link opens app and navigates to active WorkoutSessionScreen

**Integration Required:**

- Developers must integrate `syncActiveSessionToWidget()` into `WorkoutSessionScreen.tsx`
- See `/mobile/WIDGET_INTEGRATION_GUIDE.md` for detailed integration steps
- Test thoroughly using the provided testing checklist

**Next Steps for Full Implementation**:

1. **Integrate Quick Set Logger**: Follow `/mobile/WIDGET_INTEGRATION_GUIDE.md` to add sync calls to WorkoutSessionScreen
2. **Manual Xcode Setup Required**: Follow `/mobile/ios/Widgets/README.md` to add widget targets
3. **Build with EAS**: Run `eas build --platform ios --profile development --local` to test widgets
4. **Test Widget Data**: Verify API endpoint `/api/engagement/widget-data` returns correct data
5. **Test Deep Links**: Tap widgets to ensure navigation works correctly
6. **Test Active Session Sync**: Verify Quick Set Logger updates during workout
7. **Phase 3**: Explore ActivityKit for Dynamic Island (iOS 16.1+ only)

#### 4.4.6 Skip this - remove from roadmap

#### 4.4.7 Session Quality Recap

**Priority**: MEDIUM | **Effort**: 3-4 days | **Impact**: MEDIUM | **Status**: ☐ PLANNED

**Goal**: Give users a lightweight timeline of their best sessions and gentle nudges when quality dips to drive re-engagement.

**Experience**:

- Recap feed: PRs and volume highs (last 6-8 weeks), badge moments, and streak milestones
- Quality dip detector: flag 2-3 consecutive below-baseline sessions; suggest recovery or focus areas
- Win-back prompt: if quality dips + inactivity, pair with notification/in-app card pointing to an easy session

**Implementation**:

- Add quality scoring that blends volume vs. personal baselines and RPE trends
- Reuse analytics endpoints with a new “recap” slice; cache for quick load
- Add in-app card on Home + Analytics to view recap timeline

**Files to Create/Modify**:

- `/server/src/services/recap.ts` - Quality scoring and recap aggregation
- `/server/src/routes/analytics.ts` - Recap endpoint
- `/mobile/src/components/RecapCard.tsx` - Compact recap card for Home/Analytics
- `/mobile/src/screens/AnalyticsScreen.tsx` - Recap timeline section
- `/mobile/src/screens/HomeScreen.tsx` - Win-back card surface when quality dips

#### 4.4.8 Apple Health Sync (iOS)

**Priority**: HIGH | **Effort**: 4-6 days | **Impact**: HIGH | **Status**: ☐ PLANNED

**Goal**: Pull Apple Health workout + activity data into the app to enrich analytics, streak accuracy, and recovery signals.

**Experience**:

- First-run permission prompt with clear toggle per data type: workouts, active energy, heart rate (optional)
- Auto-import strength workouts (name, sets/reps/weight if available) into history with “Imported from Apple Health” badge
- Merge Apple Health sessions into streak + weekly goal calculations without double-counting in-app sessions
- Optional heart rate overlay on session summary (avg/max) and calories burned estimates

**Implementation**:

- Use HealthKit bindings (Expo config plugin or `react-native-health`) to read workouts/metrics; background sync once per day
- Normalize imported sessions to existing workout schema; dedupe against manually logged sessions by timestamp + duration
- Add user-level setting to disable/clear Apple Health imports
- Add migration to store `source` on workouts (`manual`, `ai`, `apple_health`)

**Files to Create/Modify**:

- `/mobile/src/services/appleHealth.ts` - HealthKit read/sync utilities
- `/mobile/src/screens/SettingsScreen.tsx` - Apple Health permissions + toggles
- `/server/src/routes/analytics.ts` - Endpoint to ingest/import synced sessions
- `/server/src/db.ts` - Add `source` + import metadata fields to workout tables

#### 4.4.9 Pro Social Video Workout Import + Custom Exercises

**Priority**: HIGH | **Effort**: 7-10 days | **Impact**: VERY HIGH | **Status**: ☐ PLANNED

**Goal**: Let Pro users paste TikTok/Instagram fitness videos to generate a workout and add missing exercises (with their own media) when our library lacks them.

**Experience**:

- “Import from TikTok/Instagram” entry in AI workout generator; paste link → fetch transcript/captions → preview suggested workout
- Review + edit generated exercises/sets before saving as a template; flag Pro-only
- “Add custom exercise” flow: name, muscle group, equipment, notes, optional user-uploaded image; only visible to creator unless shared to squad (future)
- Content safety check to block non-fitness or inappropriate videos

**Implementation**:

- Backend ingestion to download captions/transcripts from shared URL; fallback to lightweight on-device transcription if needed
- LLM prompt to extract exercises + structure a workout; gate behind Pro checks and usage limits
- New `user_exercises` table scoped to user (or squad) with optional image upload (S3/Cloudinary)
- Store provenance on generated templates (`source: "social_video"`, original URL) for auditability
- Add caching of transcripts to avoid repeated fetches for the same URL

**Files to Create/Modify**:

- `/server/src/routes/ai.ts` - Social video import endpoint + Pro gating
- `/server/src/services/ai/socialVideoImport.ts` - Transcript parsing + workout generation
- `/server/src/db.ts` - Add `user_exercises` table + template provenance fields
- `/mobile/src/screens/AIWorkoutImportScreen.tsx` - Paste link, show transcript preview, accept workout
- `/mobile/src/screens/ExerciseLibraryScreen.tsx` - Surface custom exercises + upload flow
- `/mobile/src/components/premium/UpgradePrompt.tsx` - Reuse for Pro gating

#### 4.4.10 Data Export (Settings)

**Priority**: MEDIUM | **Effort**: 2-3 days | **Impact**: MEDIUM | **Status**: ☐ PLANNED

**Goal**: Provide a user-controlled export of workout history for portability/compliance.

**Experience**:

- Settings action: “Export my data” → choose CSV or JSON → email/share sheet with download link (time-limited)
- Export includes workouts, sets, templates, AI generations, and streak history; excludes PII beyond profile basics
- Show export status (queued → ready) and ability to regenerate

**Implementation**:

- Server job to compile export into CSV/JSON, store in object storage with signed URL (24h expiration)
- Rate limit to one export per user per 24h; log audit trail for compliance
- Client polling or web socket to update export status; uses share sheet for delivery if on device

**Files to Create/Modify**:

- `/server/src/routes/account.ts` - Data export request + status endpoints
- `/server/src/jobs/exportData.ts` - Export generator + storage upload
- `/mobile/src/screens/SettingsScreen.tsx` - Export CTA + status UI
- `/mobile/src/api/account.ts` - Export API client

---

### 🌐 Phase 5: Marketing & Growth (Post-Launch)

#### 5.1 Landing Page & App Store Presence

**Priority**: HIGH | **Effort**: 5-7 days | **Impact**: HIGH

**Goal**: Create professional landing page to drive app downloads and provide web presence.

**Landing Page Requirements**:

- [ ] Modern, mobile-responsive design
- [ ] Hero section with app screenshots (iOS + Android)
- [ ] Feature showcase (AI workouts, squad tracking, progressive overload)
- [ ] Pricing comparison (Free vs Pro)
- [ ] App Store & Google Play download badges
- [ ] Social proof section (testimonials when available)
- [ ] FAQ section addressing common questions
- [ ] Footer with privacy policy, terms of service, contact

**Technical Stack**:

- Next.js 14 (App Router) or simple static site (Vercel/Netlify)
- Tailwind CSS for styling
- Framer Motion for animations (optional)
- Analytics (Plausible or Google Analytics)

**Pages to Create**:

- [x] `/` - Home (main landing page) — built in `web/src/app/page.tsx`
- [x] `/privacy` - Privacy Policy (required for App Store) — built in `web/src/app/privacy/page.tsx`
- [x] `/terms` - Terms of Service (required for App Store) — built in `web/src/app/terms/page.tsx`
- [ ] `/support` - Support/Contact page

**Domain & Hosting**:

- [x] Register domain (push-pull.app )
- [x] Set up DNS with hosting provider
- [x] Deploy to Vercel/Netlify (free tier)
- [x] Configure SSL certificate
- [x] Set up redirect from www to root domain

**App Store Optimization**:

- [ ] Create App Store listing (iOS)
- [ ] Create Google Play Store listing (Android)
- [x] Design app icon (1024x1024)
- [ ] Create 5-6 app screenshots per platform
- [ ] Write compelling app description
- [ ] Choose keywords for ASO
- [ ] Create feature graphic for Play Store

**Files to Create** (now live under `web/`):

- [x] `web/src/app/page.tsx` - Home page
- [x] `web/src/app/privacy/page.tsx` - Privacy policy
- [x] `web/src/app/terms/page.tsx` - Terms of service
- [ ] `web/src/app/support/page.tsx` - Support page
- [ ] `web/src/components/FeatureShowcase.tsx`
- [ ] `web/src/components/PricingTable.tsx`
- [ ] `web/src/components/DownloadButtons.tsx`
- [ ] `web/public/screenshots/` - App screenshots

**Integration Points**:

- Deep links from landing page to app (if installed)
- UTM tracking for download attribution
- Email capture for pre-launch list (optional)

---

## Technical Debt & Improvements

### High Priority

- [ ] Implement proper database migrations (migrate from initDb() approach)
- [ ] Add image upload to cloud storage (Cloudinary/S3) instead of local URIs
- [ ] Add API rate limiting (express-rate-limit)
- [ ] Add input validation (Zod schemas)
- [ ] Error tracking (Sentry)

### Medium Priority

- [ ] Add unit tests for critical business logic
- [ ] Add E2E tests for payment flows
- [ ] Implement proper logging (Winston/Pino)
- [ ] Add API documentation (Swagger)
- [ ] Optimize bundle size (code splitting)

### Low Priority

- [ ] Add accessibility labels
- [ ] Support dark mode fully
- [ ] Add internationalization (i18n)
- [ ] Progressive web app version

---

## Success Metrics

### User Acquisition

- **Target**: 100 users in first month
- **Channel**: Instagram fitness community, Reddit r/fitness, word of mouth

### Conversion

- **Target**: 15% trial-to-paid conversion rate
- **Benchmark**: SaaS average is 10-25%

### Retention

- **Target**: 60% 30-day retention
- **Key**: AI workouts must deliver visible results

### Revenue

- **Target**: $500 MRR by month 3 (~100 paying users)
- **Breakeven**: ~20 paying users (covers server + API costs)

### Viral Coefficient

- **Target**: 1.5 (each user invites 1.5 others via squad links)
- **Key**: Squad invite links must be frictionless

---

## Marketing Strategy (Post-Launch)

1. **Content Marketing**

   - Blog: "How to program push/pull/legs splits"
   - YouTube: App tutorial + workout vlogs
   - TikTok: Before/after transformations using app

2. **Influencer Partnerships**

   - Reach out to micro-influencers (10-50k followers)
   - Offer lifetime Pro plan in exchange for shoutout
   - Target: Natural bodybuilders, powerlifters, calisthenics athletes

3. **Community Building**

   - Create official "Push/Pull Community" squad
   - Weekly challenges (volume PRs, consistency)
   - User spotlight on Instagram

4. **App Store Optimization**

   - Keywords: "workout tracker", "AI fitness", "gym squad"
   - Screenshots emphasizing AI + social features
   - Positive review outreach

5. **Referral Program** (Future)
   - Give 1 month free Pro for each referral who subscribes
   - Referred user gets 10% off annual plan

---

## Open Questions & Decisions Needed

1. **App Name**: Still "Push/Pull" or rebrand? (Check trademark availability)
2. **Domain**: Register push-pull.app
3. **Privacy Policy**: Need lawyer review before collecting payment info
4. **Terms of Service**: Liability for workout injuries (disclaimer)
5. **Customer Support**: Email only? In-app chat? Response time SLA?
6. **Refund Policy**: 30-day money-back guarantee?
7. **Churn Prevention**: Win-back email sequence for cancelled users?

---

## Notes

- Focus on **quality over speed** - bugs in payment flow = lost revenue
- **Dog-food the app** - use it for your own workouts to find UX issues
- **Talk to users early** - DM beta testers for feedback before building features
- **Start marketing before launch** - build Instagram/Twitter presence now
- **AI costs**: OpenAI ~$0.02-0.05 per workout generation (monitor closely)
- **Stripe fees**: 2.9% + $0.30 per transaction (factor into pricing)

---

## Version History

- **v1.0**: MVP complete - Home, Workouts, History, Squad, Profile
- **v1.1**: Target muscles, multi-step onboarding, squad invite links
- **v1.2**: AI workout generation + Recovery/Fatigue intelligence (7d vs 4w baseline, deload detection, recommendations, Recovery screen + Home widget)
- **v1.3**: Progressive overload automation (smart weight/rep suggestions, confidence scoring, user preferences)
- **v1.4** (In progress): Stripe integration + Paywall (Stripe subscriptions, PaymentSheet upgrade flow, webhook + billing portal)
- **v1.5**: Advanced analytics + Squad management enhancements (Phase 4 complete — new squad settings, reactions/comments, invite links, analytics dashboard)
- **v1.6** (Current): Retention & Feedback (smart notifications, profile/settings redesign, weekly streaks shipped; widgets, feedback board, health sync, data export pending)
- **v1.7** (Next): Marketing & Growth (landing page, App/Play listings, support flow)
