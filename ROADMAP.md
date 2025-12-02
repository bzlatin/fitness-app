# Push/Pull Fitness App - Feature Roadmap

> Last Updated: 2025-11-24
> Status: Phase 1 & 2 complete — Phase 3 (Monetization) 🎯 In progress

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
- Link format: `https://pushpullapp.com/squad/join/{code}` (redirects to deep link)
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

### 💰 Phase 3: Monetization (Weeks 7-9)

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

- [ ] Create Apple Developer account ($99/year)
- [ ] Register app in App Store Connect
- [ ] Create two subscription products in App Store Connect
- [x] Set up StoreKit Configuration file for local testing
- [x] Add iOS bundle identifier to `app.config.ts`
- [ ] Configure Apple Team ID in Expo build settings

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
- [ ] Handle App Store notification types:
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
- [ ] Handle subscription groups in App Store Connect
- [ ] Configure introductory offers (7-day free trial)
- [ ] Add subscription terms URL (required for App Store)
- [ ] Add privacy policy URL (required for App Store)
- [x] Implement "Manage Subscription" deep link to iOS Settings
- [ ] Test with Sandbox users in App Store Connect
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

- [ ] `IOS_IAP_SETUP.md` - Setup guide for App Store Connect
- [ ] Update README with iOS testing instructions
- [ ] Document subscription platform switching (if user moves from Android to iOS)

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
- [ ] Apply template limit check in WorkoutTemplateBuilderScreen before save

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

- [ ] Handle 403 errors from analytics endpoints gracefully (show upgrade prompt instead of crash)
- [ ] Handle 403 errors from template save endpoint (show upgrade prompt)
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

### 📊 Phase 4: Analytics & Retention (Weeks 10-12)

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

#### 4.2 Squad Management Enhancements

**Priority**: LOW | **Effort**: 3-4 days | **Impact**: MEDIUM

**Features**:

- [ ] Remove member (admin only)
- [ ] Add co-admin role
- [ ] Squad settings page (rename, change visibility)
- [ ] Leave squad option
- [ ] Block/report user
- [ ] Squad member search

**Database Changes**:

```sql
ALTER TABLE squad_members ADD COLUMN role TEXT DEFAULT 'member';
-- roles: 'owner', 'admin', 'member'
```

**Files to Modify**:

- `/server/src/routes/squads.ts` (add admin endpoints)
- `/mobile/src/screens/SquadScreen.tsx` (add management UI)
- `/mobile/src/screens/SquadSettingsScreen.tsx` (new)

---

#### 4.3 Workout Reactions & Comments

**Priority**: LOW | **Effort**: 4-5 days | **Impact**: LOW

**Goal**: Allow users to react/comment on workout shares in squad feed.

**Database Schema**:

```sql
CREATE TABLE workout_reactions (
  id TEXT PRIMARY KEY DEFAULT nanoid(),
  share_id TEXT REFERENCES workout_shares(id) ON DELETE CASCADE,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  reaction_type TEXT NOT NULL, -- 'fire', 'muscle', 'clap', 'pr'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(share_id, user_id, reaction_type)
);

CREATE TABLE workout_comments (
  id TEXT PRIMARY KEY DEFAULT nanoid(),
  share_id TEXT REFERENCES workout_shares(id) ON DELETE CASCADE,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  comment_text TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Implementation**:

- [ ] Add reactions to feed items
- [ ] Add comment section to workout shares
- [ ] Push notifications for reactions (future)

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

- `/` - Home (main landing page)
- `/privacy` - Privacy Policy (required for App Store)
- `/terms` - Terms of Service (required for App Store)
- `/support` - Support/Contact page

**Domain & Hosting**:

- [ ] Register domain (pushpullapp.com or similar)
- [ ] Set up DNS with hosting provider
- [ ] Deploy to Vercel/Netlify (free tier)
- [ ] Configure SSL certificate
- [ ] Set up redirect from www to root domain

**App Store Optimization**:

- [ ] Create App Store listing (iOS)
- [ ] Create Google Play Store listing (Android)
- [ ] Design app icon (1024x1024)
- [ ] Create 5-6 app screenshots per platform
- [ ] Write compelling app description
- [ ] Choose keywords for ASO
- [ ] Create feature graphic for Play Store

**Files to Create** (new repo or `/landing` directory):

- `/landing/src/app/page.tsx` - Home page
- `/landing/src/app/privacy/page.tsx` - Privacy policy
- `/landing/src/app/terms/page.tsx` - Terms of service
- `/landing/src/app/support/page.tsx` - Support page
- `/landing/src/components/FeatureShowcase.tsx`
- `/landing/src/components/PricingTable.tsx`
- `/landing/src/components/DownloadButtons.tsx`
- `/landing/public/screenshots/` - App screenshots

**Integration Points**:

- Deep links from landing page to app (if installed)
- UTM tracking for download attribution
- Email capture for pre-launch list (optional)

---

## Technical Debt & Improvements

### High Priority

- [ ] Implement proper database migrations (migrate from initDb() approach)
- [ ] Move exercise JSON to database (currently in-memory)
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
2. **Domain**: Register pushpullapp.com or similar
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
- **v1.3** (Current): Progressive overload automation (smart weight/rep suggestions, confidence scoring, user preferences)
- **v1.4** (In progress): Stripe integration + Paywall (Stripe subscriptions, PaymentSheet upgrade flow, webhook + billing portal)
- **v2.0** (Target: Week 12): Advanced analytics + Squad enhancements
