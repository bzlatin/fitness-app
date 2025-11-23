# Push/Pull Fitness App - Feature Roadmap

> Last Updated: 2025-11-22
> Status: MVP Complete - Moving to Growth & Monetization Phase

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

### Pro Tier: $4.99/month or $47.99/year

- ✅ Unlimited workout templates
- ✅ AI workout generation (unlimited)
- ✅ Fatigue & recovery intelligence
- ✅ Progressive overload automation
- ✅ Advanced muscle group analytics
- ✅ Priority support
- ✅ 7-day free trial

**Competitive Positioning**: Priced at $47.99/year vs Fitbod's $60/year (~20% cheaper)

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

### 🎯 Phase 1: Core Experience & Foundation (Weeks 1-2)

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

- [ ] Design multi-step wizard UI with progress indicator
- [ ] Create OnboardingStep components for each screen
- [ ] Add `onboarding_data` JSONB column to users table
- [ ] Create PATCH `/api/users/me/onboarding` endpoint
- [ ] Update OnboardingScreen to multi-step flow
- [ ] Store structured JSON in database
- [ ] Add ability to re-take onboarding from settings

**Files to Create/Modify**:

- `/mobile/src/screens/OnboardingScreen.tsx` (refactor)
- `/mobile/src/components/onboarding/` (new directory)
  - `WelcomeStep.tsx`
  - `GoalsStep.tsx`
  - `ExperienceStep.tsx`
  - `EquipmentStep.tsx`
  - `ScheduleStep.tsx`
  - `LimitationsStep.tsx`
  - `TrainingSplitStep.tsx`
- `/server/src/routes/users.ts` (add onboarding endpoint)
- `/server/db.ts` (migration)

---

#### 1.3 Squad Invite Links (Viral Growth Feature)

**Priority**: HIGH | **Effort**: 3-4 days | **Impact**: HIGH

**Problem**: Inviting by handle is high-friction. Users want to share a link to group chats.

**Implementation**:

- [ ] Generate unique invite code for each squad (nanoid)
- [ ] Create `squad_invite_links` table with expiration support
- [ ] Add "Share Invite Link" button to squad screen
- [ ] Create deep link handler for `app://squad/join/{code}`
- [ ] Build SquadJoinScreen that shows squad preview before joining
- [ ] Implement join via link endpoint (validates code, adds member)
- [ ] Track invite attribution (who invited whom)

**Database Schema**:

```sql
CREATE TABLE squad_invite_links (
  id TEXT PRIMARY KEY DEFAULT nanoid(),
  squad_id TEXT REFERENCES squads(id) ON DELETE CASCADE,
  created_by TEXT REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  max_uses INTEGER,
  use_count INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE
);
```

**Technical Details**:

- Use Expo deep linking for `app://` URLs
- Share via React Native Share API
- Link format: `https://pushpullapp.com/squad/join/{code}` (redirects to deep link)
- Validate link hasn't expired or exceeded max uses
- Show squad name, member count, and sample members before joining

**Files to Create/Modify**:

- `/server/src/routes/squads.ts` (add invite endpoints)
- `/mobile/src/screens/SquadJoinScreen.tsx` (new)
- `/mobile/src/screens/SquadScreen.tsx` (add share button)
- `/mobile/src/navigation/linking.ts` (deep link config)
- `/server/src/db.ts` (migration)

**API Endpoints**:

- `POST /api/squads/:id/invite-links` - Create invite link
- `GET /api/squads/join/:code` - Get squad preview
- `POST /api/squads/join/:code` - Join squad via link
- `DELETE /api/squads/invite-links/:id` - Revoke link

---

### 🤖 Phase 2: AI & Premium Features (Weeks 3-6)

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

- [ ] Create fatigue calculation service
- [ ] Add weekly volume aggregation query (by muscle group)
- [ ] Build RecoveryDashboard component showing fatigue scores
- [ ] Add "What should I train today?" recommendation feature
- [ ] Integrate fatigue data into AI workout generation
- [ ] Show recovery status on HomeScreen
- [ ] Add deload week detection (total volume <50% baseline)

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

#### 2.3 Progressive Overload Automation

**Priority**: MEDIUM | **Effort**: 4-5 days | **Impact**: MEDIUM

**Goal**: Analyze performance trends and suggest weight increases when user is ready.

**Logic**:

- Track last 3 sessions for each exercise
- If user hit target reps on all sets for 2+ consecutive sessions → suggest +5-10lb increase
- If user exceeded target reps → suggest +2.5-5lb increase
- Display suggestions on template detail screen and during workout

**Implementation**:

- [ ] Create progressive overload analysis service
- [ ] Query last 3 sessions for each exercise in template
- [ ] Calculate readiness score for weight increase
- [ ] Add "Smart Progression" badge to exercises
- [ ] Show "+5 lb recommended" indicator in workout session
- [ ] Add one-tap to apply suggestion
- [ ] Track acceptance rate of suggestions (for refinement)

**Files to Create/Modify**:

- `/server/src/services/progression.ts` (new)
- `/server/src/routes/analytics.ts` (add progression endpoint)
- `/mobile/src/components/ProgressionSuggestion.tsx` (new)
- `/mobile/src/screens/WorkoutSessionScreen.tsx` (show suggestions)

**API Endpoints**:

- `GET /api/analytics/progression/:templateId` - Get progression suggestions

---

### 💰 Phase 3: Monetization (Weeks 7-9)

#### 3.1 Stripe Integration

**Priority**: CRITICAL | **Effort**: 10-12 days | **Impact**: VERY HIGH

**Goal**: Accept payments and manage subscriptions via Stripe.

**Stripe Products**:

1. **Pro Monthly**: $4.99/month (product ID: `prod_pro_monthly`)
2. **Pro Annual**: $47.99/year (product ID: `prod_pro_annual`)

**Implementation**:

- [ ] Install Stripe React Native SDK
- [ ] Create Stripe account and get API keys
- [ ] Set up Stripe products and prices in dashboard
- [ ] Create payment backend service
- [ ] Implement subscription checkout flow
- [ ] Build webhook handler for subscription events
- [ ] Update user plan status on successful payment
- [ ] Handle trial period (7 days)
- [ ] Implement subscription cancellation
- [ ] Build billing portal link
- [ ] Add subscription status to profile screen

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

- First AI generation attempt → auto-start 7-day trial (no CC required)
- Trial grants full Pro access
- After 7 days → show upgrade prompt
- If user doesn't upgrade → revert to free limits

**Implementation**:

- [ ] Create plan enforcement middleware
- [ ] Add template count limit on save (free tier)
- [ ] Show "2/3 templates" indicator on MyWorkoutsScreen
- [ ] Create UpgradePrompt component (reusable)
- [ ] Add upgrade prompts to:
  - Template builder (when at limit)
  - AI generation button
  - Recovery screen
  - Progression suggestions
- [ ] Build trial countdown component
- [ ] Add trial CTA to HomeScreen during trial period

**Files to Create/Modify**:

- `/server/src/middleware/planLimits.ts` (new)
- `/mobile/src/components/UpgradePrompt.tsx` (new)
- `/mobile/src/components/TrialBanner.tsx` (new)
- `/mobile/src/screens/MyWorkoutsScreen.tsx` (add limit indicator)
- `/server/src/routes/templates.ts` (enforce limit)

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

#### 4.1 Advanced Muscle Group Analytics

**Priority**: MEDIUM | **Effort**: 5-6 days | **Impact**: MEDIUM

**Features**:

- [ ] Weekly volume per muscle group chart (last 12 weeks)
- [ ] Push vs Pull volume balance indicator
- [ ] Most/least trained muscle groups
- [ ] Volume PR tracking per muscle group
- [ ] Muscle group frequency heatmap (calendar view)
- [ ] Export workout data to CSV

**Files to Create/Modify**:

- `/mobile/src/screens/AnalyticsScreen.tsx` (new, Pro feature)
- `/server/src/routes/analytics.ts` (expand)
- `/mobile/src/components/VolumeChart.tsx` (new)

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

- **v1.0** (Current): MVP complete - Home, Workouts, History, Squad, Profile
- **v1.1** (Target: Week 2): Target muscles + Onboarding + Invite links
- **v1.2** (Target: Week 6): AI generation + Recovery tracking
- **v1.3** (Target: Week 9): Stripe integration + Paywall
- **v2.0** (Target: Week 12): Advanced analytics + Squad enhancements
