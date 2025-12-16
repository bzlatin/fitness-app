# Beta Testing Feedback - Bug Fixes & Features

**Status**: 🎯 IN PROGRESS
**Priority**: HIGH (User-reported issues blocking good experience)
**Target Completion**: Week of 2024-12-16

---

## Overview

This document tracks bug fixes and small features identified during beta testing. These items are critical for improving user experience and conversion before wider launch.

---

## 1. Up Next Workout Intelligence (HIGH PRIORITY) ✅ COMPLETE

**Status**: ✅ Implemented on 2024-12-16
**Effort**: Medium (2-3 hours)
**Impact**: High - Affects daily user flow

### Problem

The "Up Next" section on HomeScreen doesn't intelligently recommend the next workout based on:

- User's training split (Push/Pull/Legs, Upper/Lower, etc.)
- Recent workout history
- Current position in split rotation

Currently shows a generic placeholder instead of smart recommendations.

### Solution Design

#### For Pro Users:

1. **Analyze recent workout history** to determine split position

   - Parse last 3-7 workouts from `workout_sessions` joined with `workout_templates`
   - Identify split type from template metadata
   - Determine what was trained recently (e.g., "Push on Monday, Legs on Wednesday")

2. **Recommend next workout** in rotation

   - If split is Push/Pull/Legs and last workout was "Push" → Recommend "Pull"
   - If split is Upper/Lower and last workout was "Upper" → Recommend "Lower"
   - Handle rest days and deload weeks

3. **Smart workout matching**:

   - **First**: Look for matching custom template (e.g., user has "Pull Day A" template)
   - **Second**: Offer AI generation ("Generate Pull Workout with AI")
   - **Third**: Fallback to manual template creation

4. **UI Components**:
   ```
   ┌─────────────────────────────────┐
   │ 🎯 Up Next: Pull Day            │
   │                                  │
   │ Based on your PPL split, you're  │
   │ due for a pull workout.          │
   │                                  │
   │ [Start "Pull Day A"] (if exists) │
   │ [Generate with AI]               │
   │ [Choose Custom Template]         │
   └─────────────────────────────────┘
   ```

#### For Free Users:

1. **Same analysis** of split position (identical backend logic)

2. **Simplified recommendations** without AI:

   ```
   ┌─────────────────────────────────┐
   │ 🎯 Up Next: Pull Day            │
   │                                  │
   │ Based on your PPL split, you're  │
   │ due for a pull workout.          │
   │                                  │
   │ [Start "Pull Day A"] (if exists) │
   │ [Choose from Templates] ────────┤
   │                                  │
   │ 💎 Pro: Generate with AI         │
   │    [Upgrade to unlock]           │
   └─────────────────────────────────┘
   ```

3. **Subtle Pro upsell**:
   - Show "Generate with AI" button in disabled state with Pro badge
   - Clicking opens PaywallComparisonModal
   - Emphasize convenience vs manual template selection

### Technical Implementation

**Backend Changes**:

- New endpoint: `GET /api/analytics/next-workout-recommendation`
  - Query last 7 days of workouts
  - Analyze split type (from onboarding data or template tags)
  - Determine next workout type in rotation
  - Return: `{ recommendedType: 'pull', confidence: 0.95, reason: 'Last trained: Push (Dec 14), Legs (Dec 15)' }`

**Frontend Changes**:

- Update `HomeScreen.tsx` to call recommendation API
- Replace placeholder "Up Next" section with intelligent widget
- Add loading skeleton while fetching recommendation
- Handle edge cases:
  - No workout history → Recommend first workout in split
  - Multiple rest days → Check if deload week
  - Split not detected → Prompt user to set split in settings

**Files Created/Modified**:

- `/server/src/services/upNextIntelligence.ts` - NEW: Intelligence service with split analysis and template matching
- `/server/src/routes/analytics.ts` - Added `GET /api/analytics/up-next` endpoint
- `/server/src/middleware/planLimits.ts` - Added `attachProStatus` middleware
- `/mobile/src/api/analytics.ts` - Added `fetchUpNextRecommendation` function
- `/mobile/src/types/analytics.ts` - Added `UpNextRecommendation` and `UpNextTemplate` types
- `/mobile/src/hooks/useUpNextRecommendation.ts` - NEW: React Query hook for Up Next data
- `/mobile/src/components/workout/UpNextCard.tsx` - NEW: Smart recommendation UI component
- `/mobile/src/screens/HomeScreen.tsx` - Updated to use `UpNextCard` with intelligence

**Implementation Notes**:

- Uses existing `recommendSmartNextWorkout` service for split rotation logic
- Template matching scores templates by split type and muscle group overlap
- Recovery/fatigue status from existing fatigue service
- Pro users see "Generate with AI" button, Free users see upsell with PRO badge
- Reasoning text explains why this split was recommended

**Testing Scenarios**:

- [x] User with PPL split, last trained Push → Recommends Pull
- [x] User with Upper/Lower split, last trained Upper → Recommends Lower
- [x] User with no history → Recommends first workout in split
- [x] User with matching custom template → Shows "Start [Template Name]"
- [x] Pro user without matching template → Shows "Generate with AI"
- [x] Free user → Shows template chooser + Pro upsell
- [x] User with rest day in split → Recommends rest or next workout

---

## 2. AI Exercise Selection Issues (HIGH PRIORITY)

**Status**: ✅ FIXED
**Effort**: Low (30 mins)
**Impact**: High - Trust issue with AI accuracy

### Problem A: AI Ignores Exercise Exclusions

User opted out of deadlifts during onboarding, but AI generated deadlift anyway.

**Root Cause**:

- Onboarding stores excluded exercises in `users.onboarding_data` JSONB column
- AI generation prompt doesn't include exclusion list
- OpenAIProvider doesn't read user preferences

**Fix**:

1. Update `POST /api/ai/generate-workout` to read `onboarding_data.excluded_exercises`
2. Pass exclusions to prompt: `"IMPORTANT: Do not include these exercises: [deadlift, squat, etc.]"`
3. Add validation layer: If AI response includes excluded exercise, regenerate or filter out

**Files to Modify**:

- `/server/src/routes/ai.ts` - Read onboarding_data before generation
- `/server/src/services/ai/workoutPrompts.ts` - Add exclusion clause to prompt
- `/server/src/services/ai/OpenAIProvider.ts` - Add post-generation validation

### Problem B: Wrong Exercise Image After Swap

User swapped "Bent Over Barbell Row" → "Bent Over Two Dumbbell Row" via AI, but image didn't update.

**Root Cause**:

- Exercise swap creates new `workout_template_exercises` row
- Image URL references old `exercise_id`
- Frontend caches exercise metadata

**Fix**:

1. When swapping exercise, ensure `exercise_id` is updated correctly
2. Clear React Query cache for template detail after swap
3. Verify `exercises.json` has correct image URL for "Bent Over Two Dumbbell Row"

**Files to Modify**:

- `/server/src/routes/ai.ts` - Ensure swap updates exercise_id
- `/mobile/src/api/templates.ts` - Invalidate cache after swap
- `/server/src/data/exercises.json` - Audit image URLs for dumbbell row variants

**Testing**:

- [ ] Generate workout with deadlifts excluded → No deadlifts appear
- [ ] Swap barbell row → dumbbell row → Correct image loads
- [ ] Regenerate workout multiple times → Exclusions respected every time
      _(Pending manual verification)_

---

## 3. Comment Management & Profile Navigation (MEDIUM PRIORITY) ✅ COMPLETE

**Status**: ✅ Implemented on 2024-12-17  
**Effort**: Medium (1-2 hours)  
**Impact**: Medium - Social feature improvement

### Problem A: Cannot Delete Comments on Your Workouts

- **Fix**: Workout owners now see a trash icon on the right of each comment; authors keep delete rights. Deletes are soft (mark `deleted_at`) and allowed for either the comment author or the workout owner.
- **API**: Added `DELETE /api/social/comments/:commentId` with auth/ownership checks; comments list filters out deleted entries; notifications exclude deleted reactions.
- **Files**: `server/src/routes/social.ts`, `server/src/jobs/notifications.ts`, `server/sql/migrations/009_workout_reactions_deleted_at.sql`, `mobile/src/components/social/WorkoutReactions.tsx`, `mobile/src/screens/SquadScreen.tsx`.
- **Testing**: [ ] Delete as author; [ ] Delete as workout owner; [ ] Verify comment disappears without breaking reactions.

### Problem B: Cannot View User Profiles from Comments

- **Fix**: Comment avatars/usernames are tappable; long-press offers “View Profile” (and “Delete” if permitted). Navigating to a profile now closes and reopens the comments modal cleanly.
- **Files**: `mobile/src/components/social/WorkoutReactions.tsx`.
- **Testing**: [ ] Tap avatar/name to open profile; [ ] Long-press menu shows “View Profile”; [ ] Return and reopen comments without glitch.

### UX Polish

- **Pull-to-refresh**: Added pull-to-refresh on the feed list to reload comments/reactions alongside squad/general feed data.
- **Files**: `mobile/src/screens/SquadScreen.tsx`.

---

## 3. Notification Permission Prompt (MEDIUM PRIORITY) - ✅ COMPLETE

**Status**: 🐛 BUG
**Effort**: Low (20 mins)
**Impact**: Medium - Affects retention (push notifications)

### Problem

Notification permission prompt only appears when:

- User is on free plan
- User manually edits goals in settings

It SHOULD appear during onboarding for all users.

**Expected Flow**:

1. User completes onboarding (last step)
2. Before navigating to HomeScreen, show iOS permission prompt
3. Store permission status in async storage

**Root Cause**:

- Notification prompt logic is in wrong place (settings screen vs onboarding)
- Missing trigger in onboarding completion flow

**Fix**:

1. Move notification prompt to final step of onboarding
2. Add `requestNotificationPermission()` call in `OnboardingScreen.tsx` or `AuthContext.tsx`
3. Use expo-notifications: `await Notifications.requestPermissionsAsync()`

**Files to Modify**:

- `/mobile/src/components/onboarding/OnboardingScreen.tsx` - Add permission request after final step
- `/mobile/src/services/notifications.ts` - NEW: Create notification service with permission helper

**Testing**:

- [ ] Complete onboarding → iOS permission prompt appears
- [ ] Grant permission → Can receive push notifications
- [ ] Deny permission → Stored in async storage, no repeated prompts
- [ ] Works on both free and pro plans

---

## 4. Comment Management & User Profiles (MEDIUM PRIORITY) ✅ COMPLETE

**Status**: 🚀 FEATURE
**Effort**: Medium (1-2 hours)
**Impact**: Medium - Social feature improvement

### Problem A: Cannot Delete Comments on Your Workouts

Users can't moderate comments on their own workout shares.

**Solution**:

- Add "Delete" button on comments (only visible to workout owner)
- Add trash icon (🗑️) next to comment timestamp
- Confirmation dialog: "Delete this comment?"
- API: `DELETE /api/social/comments/:commentId`

### Problem B: Cannot View User Profiles from Comments

Clicking on a user's name/avatar in a comment does nothing.

**Solution**:

- Make username/avatar tappable
- Navigate to ProfileScreen with userId parameter
- Show "View Profile" option in long-press menu

**Implementation**:

**Backend**:

- Add `DELETE /api/social/comments/:commentId` endpoint
  - Verify requestor is either comment author OR workout owner
  - Soft delete (add `deleted_at` column) or hard delete

**Frontend**:

- Update `FeedScreen.tsx` comment rendering
  - Add delete button for workout owner
  - Make username/avatar touchable
  - Navigate to `ProfileScreen` with `userId` param
- Update `ProfileScreen.tsx` to accept `userId` parameter (currently shows current user only)

**Files to Create/Modify**:

- `/server/src/routes/social.ts` - Add DELETE endpoint
- `/mobile/src/api/social.ts` - Add deleteComment mutation
- `/mobile/src/screens/FeedScreen.tsx` - Add delete button + navigation
- `/mobile/src/screens/ProfileScreen.tsx` - Support viewing other users' profiles
- `/server/src/db.ts` - Add `deleted_at` column to comments table (migration)

**Database Migration**:

```sql
ALTER TABLE workout_comments ADD COLUMN deleted_at TIMESTAMP DEFAULT NULL;
CREATE INDEX idx_workout_comments_deleted_at ON workout_comments(deleted_at);
```

**Testing**:

- [ ] Workout owner can delete any comment on their workout
- [ ] Comment author can delete their own comment
- [ ] Non-owners cannot delete others' comments (403 error)
- [ ] Clicking username navigates to user's profile
- [ ] Profile screen shows user's workout history, stats, squads

---

## 5. Edit Profile Name Bug (HIGH PRIORITY) ✅ COMPLETE

**Status**: 🐛 BUG - CRITICAL
**Effort**: Low (30 mins)
**Impact**: High - Core functionality broken

### Problem

When editing profile name, only one letter changes. Name doesn't update properly.

**Example**:

- Current name: "Ben"
- Edit to: "Benjamin"
- Saves as: "Benj" (only one letter changes)

**Root Cause** (Suspected):

- Text input controlled value issue (React state not syncing)
- Backend PATCH endpoint receives truncated payload
- Optimistic update overwrites correct value with old value

**Debug Steps**:

1. Add logging to `PATCH /api/users/:id` endpoint to see received payload
2. Check React Query mutation in `ProfileScreen.tsx` - verify `onMutate` logic
3. Check TextInput `onChangeText` handler - ensure state updates correctly
4. Verify backend SQL UPDATE query syntax

**Files to Investigate**:

- `/mobile/src/screens/ProfileScreen.tsx` - Text input + mutation
- `/server/src/routes/social.ts` - User profile update endpoint
- `/mobile/src/api/social.ts` - updateProfile mutation

**Fix** (Most Likely):

- Issue with optimistic update in React Query
- Remove optimistic update, or fix cache update logic
- Ensure TextInput value is controlled by React state, not defaultValue

**Testing**:

- [ ] Edit name from "John" → "Jane" → Saves correctly
- [ ] Edit name with spaces "John Doe" → "Jane Smith" → Saves correctly
- [ ] Edit name with special characters → Validates input
- [ ] Edit handle (if editable) → Works correctly

---

## 6. Long Exercise Names Truncation (LOW PRIORITY) ✅ COMPLETE

**Status**: ✅ FIXED (2025-12-16)
**Effort**: Low (15 mins)
**Impact**: Low - Minor UX annoyance

### Problem

When manually adding exercises with long names, full name isn't visible.

**Example**:

- "Bent Over Two-Arm Dumbbell Row with Neutral Grip" appears as "Bent Over Two-Arm..."

**Solution**:

- Use `numberOfLines={2}` on exercise name Text component
- Add tooltip/long-press to show full name (Alert)
- OR: Increase modal width slightly

**Files to Modify**:

- `/mobile/src/components/workouts/ExercisePicker.tsx` - Exercise list item name now uses `numberOfLines={2}` + `ellipsizeMode="tail"` + long-press Alert
- `/mobile/src/components/workouts/ExerciseSwapModal.tsx` - Same treatment for manual swap list + modal header

**Testing**:

- [ ] Long exercise names wrap to 2 lines
- [ ] Very long names truncate with "..."
- [ ] Long-press shows full name
- [ ] Short names don't have extra spacing

---

## 7. Squad "This Week" Clarity (LOW PRIORITY)

**Status**: 🐛 UX ISSUE
**Effort**: Low (20 mins)
**Impact**: Low - Minor confusion

### Problem

In SquadScreen, "This Week: 8" is unclear. What does the number mean?

- 8 workouts completed by squad members?
- 8 posts in squad feed?
- User's personal workouts this week?

**Solution**:

- Add descriptive label: "This Week: 8 workouts" or "8 squad workouts"
- Add tooltip/info icon with explanation
- OR: Expand to "Squad Activity This Week: 8 workouts completed"

**Files to Modify**:

- `/mobile/src/screens/SquadScreen.tsx` - Update label text
- Verify backend query to understand what number represents

**Testing**:

- [ ] Label clearly describes what number represents
- [ ] Number updates correctly as workouts are completed

---

## Priority Order (Top to Bottom)

1. **Up Next Workout Intelligence** - Core daily UX, affects engagement
2. **AI Exercise Selection Issues** - Trust issue, affects Pro conversion
3. **Edit Profile Name Bug** - Critical functionality broken
4. **Notification Permission Prompt** - Affects retention
5. **Comment Management & User Profiles** - Social feature improvement
6. **Long Exercise Names** - Minor UX polish
7. **Squad "This Week" Clarity** - Minor UX polish

---

## Implementation Plan

### Phase 1: Critical Bugs (Day 1)

- [x] Create this tracking document
- [ ] Fix edit profile name bug (#5)
- [ ] Fix AI exercise exclusions (#2A)
- [ ] Fix notification prompt in onboarding (#3)

### Phase 2: Core Features (Day 2-3)

- [ ] Implement Up Next intelligence for Pro users (#1)
- [ ] Implement Up Next intelligence for Free users (#1)
- [ ] Fix AI exercise image swap bug (#2B)

### Phase 3: Social Features (Day 4)

- [ ] Add comment deletion (#4A)
- [ ] Add profile viewing from comments (#4B)

### Phase 4: Polish (Day 5)

- [ ] Fix long exercise names (#6)
- [ ] Clarify squad "This Week" label (#7)

---

## Testing Strategy

After each fix:

1. Manual testing on iOS simulator
2. Test on physical device (if available)
3. Test both free and pro user flows
4. Document any new edge cases discovered

Before marking complete:

- [ ] All items checked off
- [ ] ROADMAP.md updated with implementation notes
- [ ] No new bugs introduced
- [ ] User feedback incorporated

---

## Success Metrics

- **Bug Resolution Rate**: All HIGH priority bugs fixed within 2 days
- **User Satisfaction**: Beta testers report improved experience
- **Conversion Impact**: Up Next intelligence increases workout starts by 20%
- **Social Engagement**: Comment management increases feed interactions

---

## Notes

- These fixes are based on real user feedback from beta testing
- Prioritize user trust (AI accuracy, profile editing) over polish
- Up Next intelligence is key differentiator vs competitors (Fitbod, Strong)
- Social features are important for viral growth (squad invites)

---

**Last Updated**: 2024-12-16
**Owner**: Ben (Engineering + Product)
**Stakeholders**: Beta testers (10-15 users)
