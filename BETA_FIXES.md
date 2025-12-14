# Beta Testing Fixes & Improvements

_Status: 🎯 IN PROGRESS_
_Created: 2025-12-14_
_Priority: HIGH (User-reported issues from beta testing)_

---

## 🐛 Critical Bugs

### Profile & Media

- [x] **Block video uploads for profile pictures** ✅ COMPLETE
  - **Issue**: Users can select videos as profile pictures
  - **Fix**: Added `mediaTypes: ['images']` to ImagePicker config to only allow images
  - **Files**: [mobile/src/screens/SettingsScreen.tsx:925](mobile/src/screens/SettingsScreen.tsx#L925)
  - **Completed**: 2025-12-14

### Social Features

- [x] **Squad invite delays / UI not updating** ✅ COMPLETE

  - **Issue**: When accepting squad invite, user sees join page but doesn't actually join immediately. Takes ~1 minute to update, requires app refresh
  - **Fix**: Added immediate React Query cache invalidation after successful join
  - **Implementation**: Invalidate all squad-related queries (`squads`, `squad`, `squadFeed`, `social`) before navigation
  - **Files**: [mobile/src/screens/SquadJoinScreen.tsx:143-148](mobile/src/screens/SquadJoinScreen.tsx#L143-L148)
  - **Completed**: 2025-12-14

- [x] **Squad search keyboard not appearing** ✅ COMPLETE
  - **Issue**: No keyboard shows when trying to search for a squad
  - **Fix**: Added `autoFocus={true}` to TextInput to automatically show keyboard when modal opens
  - **Files**: [mobile/src/screens/SquadScreen.tsx:1129](mobile/src/screens/SquadScreen.tsx#L1129)
  - **Completed**: 2025-12-14

- [x] **No way to search/discover public squads** ✅ COMPLETE
  - **Issue**: Users already in a squad cannot search for or join additional public squads. Only way to join is via invite links.
  - **Fix**: Built complete squad discovery system with backend API + beautiful UI
  - **Implementation**:
    - **Backend**: Added `GET /api/social/squads/discover` endpoint with search support
    - **Backend**: Added `POST /api/social/squads/:squadId/join` endpoint for direct joining
    - **Backend**: Updated squad creation to support `isPublic` and `description` fields
    - **Frontend**: Beautiful squad discovery modal with real-time search
    - **Frontend**: Shows member count, descriptions, "Full" badges, "Joined" status
    - **UX**: Auto-focus search, instant feedback, loading states, empty states
  - **Files**:
    - [server/src/routes/social.ts:933-1028](server/src/routes/social.ts#L933-L1028) - Discovery endpoint
    - [server/src/routes/social.ts:1071-1136](server/src/routes/social.ts#L1071-L1136) - Join endpoint
    - [server/src/routes/social.ts:1030-1068](server/src/routes/social.ts#L1030-L1068) - Updated creation
    - [mobile/src/api/social.ts:54-95](mobile/src/api/social.ts#L54-L95) - API client
    - [mobile/src/screens/SquadScreen.tsx:2169-2546](mobile/src/screens/SquadScreen.tsx#L2169-L2546) - Discovery modal
    - [mobile/src/screens/SquadScreen.tsx:1733-1791](mobile/src/screens/SquadScreen.tsx#L1733-L1791) - Discovery button
  - **Completed**: 2025-12-14

### Notifications

- [ ] **Missing notification permissions prompt**

  - **Issue**: Notification permission prompt should show after plan selection but doesn't appear
  - **Expected flow**: Login → Choose plan → Request notification permissions
  - **Files**: `mobile/src/screens/OnboardingScreen.tsx` or post-onboarding flow

- [ ] **No friend request notifications**

  - **Issue**: No alerts when someone sends you a friend request
  - **Fix**: Implement both in-app notification system (badge, alert) + push notifications
  - **Implementation**:
    - **In-app**: Badge on profile tab, notification banner/alert in UI
    - **Push**: expo-notifications for remote notifications
    - **Backend**: New endpoint for unread friend requests count + notification payload
  - **Files**:
    - `mobile/src/screens/ProfileScreen.tsx`
    - `mobile/src/components/social/FriendRequestBadge.tsx` (new)
    - `mobile/src/services/notifications.ts` (new - push notification setup)
    - `server/src/routes/social.ts` (trigger notification on friend request)
  - **Priority**: MEDIUM - User engagement feature

- [ ] **No friend acceptance notifications**
  - **Issue**: No alerts when someone accepts your friend request
  - **Fix**: Add both in-app + push notification when follow request is accepted
  - **Implementation**: Similar to friend request notifications above
  - **Files**:
    - Same as above + update friend acceptance endpoint to trigger notifications
    - `server/src/routes/social.ts` (POST /api/social/follow/:userId route)
  - **Priority**: MEDIUM - User engagement feature

---

## 🎨 UI/UX Improvements

### High Priority UX Issues

- [ ] **Edit profile save button not obvious**
  - **Issue**: Users edit profile/change picture but don't see save button, exit without saving
  - **Fix 1**: Make save button more prominent (sticky header/footer, different color, larger)
  - **Fix 2**: Add "Unsaved changes" warning modal when attempting to exit
  - **Files**: `mobile/src/screens/EditProfileScreen.tsx`
  - **Priority**: HIGH - Users losing their changes

### Visual Polish

- [ ] **"Viewing squad name - tap to switch back" widget overflow**

  - **Issue**: Text too wide, extends outside widget boundaries
  - **Fix**: Truncate squad name with ellipsis, adjust layout for smaller screens
  - **Files**: Likely `mobile/src/components/home/SquadSwitchBanner.tsx` or similar

- [ ] **Update "No live squad members" state**

  - **Issue**: "Squad live" text shows even when no one is live
  - **Fix**: Either hide the section or show "No squad members working out right now"
  - **Files**: `mobile/src/components/social/SquadLiveWidget.tsx` or home screen

- [ ] **Remove "Gym buddy ready" text from user profiles**
  - **Issue**: Text is shown when viewing other users' profiles (unclear what this means)
  - **Fix**: Remove this text element
  - **Files**: `mobile/src/screens/UserProfileScreen.tsx` or `mobile/src/components/profile/ProfileHeader.tsx`

---

## ✨ Feature Enhancements

### Monetization / Conversion Optimization

- [ ] **Give free users 1 free AI workout generation**
  - **Goal**: Let users test AI feature before purchase, increase conversion
  - **Implementation**:
    - Update plan limits: Free tier gets 1 AI generation (lifetime)
    - Track AI generation count in database
    - Update paywall messaging: "You've used your free AI workout. Upgrade for unlimited!"
    - Make UI beautiful and easy to understand (onboarding tooltip?)
  - **Files**:
    - `mobile/src/utils/featureGating.ts` (update limits)
    - `server/src/middleware/planLimits.ts` (add AI generation counter)
    - `server/src/routes/ai.ts` (check count before generation)
    - Database: Add `ai_generations_used_count` to users table
  - **Priority**: MEDIUM - Conversion optimization

### Workout Builder Improvements

- [ ] **Add exercise thumbnail images on edit template page**

  - **Issue**: No visual cues for exercises, hard to identify at a glance
  - **Fix**: Add small thumbnail images next to each exercise name (images already exist in database)
  - **Files**:
    - `mobile/src/components/workout/ExerciseListItem.tsx`
    - Verify exercise data includes image URLs in database schema
  - **Priority**: MEDIUM - UX improvement

- [ ] **Allow weight input when adding exercise**

  - **Issue**: Can't pre-set default weight when adding exercise to template
  - **Fix**: Add optional weight field in "Add Exercise" form
  - **Files**: `mobile/src/components/workout/AddExerciseModal.tsx`, `mobile/src/screens/EditTemplateScreen.tsx`

- [ ] **Add "Glutes" to muscle focus options**
  - **Issue**: Missing common muscle group from selection
  - **Fix**: Add glutes to muscle group enum/options
  - **Files**:
    - `mobile/src/types/workouts.ts` (MuscleGroup enum)
    - `server/src/types/index.ts` (if defined server-side)
    - `mobile/src/components/onboarding/MuscleFocusSelector.tsx`

### AI Workout Polish

- [ ] **Remove "AI Generated" tag from workout descriptions**

  - **Issue**: Tag looks tacky, users don't like seeing "AI" branding
  - **Fix**: Remove tag, make description more natural
  - **Files**:
    - `mobile/src/screens/WorkoutTemplateDetailScreen.tsx`
    - `mobile/src/components/workout/TemplateCard.tsx`
    - `server/src/services/ai/workoutPrompts.ts` (if tag is in prompt)

- [ ] **Make AI workout descriptions more concise**
  - **Issue**: AI-generated descriptions are too verbose
  - **Fix**: Update prompt to generate 1-2 sentence descriptions (focus on key benefits)
  - **Files**: `server/src/services/ai/workoutPrompts.ts`

---

## 📊 Priority Matrix

| Priority  | Count | Items                                                                                          |
| --------- | ----- | ---------------------------------------------------------------------------------------------- |
| 🔴 HIGH   | 4     | Squad invite delays, Squad search keyboard, Edit profile save button, Notification permissions |
| 🟡 MEDIUM | 4     | Free AI workout, Friend notifications (in-app + push), Exercise thumbnails, Weight input       |
| 🟢 LOW    | 5     | UI polish items (text removals, empty states, widget overflow, AI tag removal)                 |

---

## 🚀 Suggested Implementation Order

### Phase 1: Critical Bugs (This Week)

1. ~~**Squad search keyboard not appearing**~~ ✅ COMPLETE
2. ~~**Squad invite immediate UI update**~~ ✅ COMPLETE
3. **Edit profile save button prominence** - Unsaved changes warning modal
4. ~~**Block video uploads for profile pictures**~~ ✅ COMPLETE

### Phase 2: Social & Notification Features (Next Week)

5. **Notification permissions prompt** - After onboarding flow
6. **Friend request notifications** - In-app badges + push notifications
7. **Friend acceptance notifications** - In-app + push
8. **Update "no live squad members" empty state** - Better messaging or hide section

### Phase 3: Monetization & Polish (Following Week)

9. **Free tier: 1 free AI workout generation** - Conversion optimization
10. **Add glutes to muscle focus options** - Quick enum update
11. **Remove "AI Generated" tag + concise descriptions** - Prompt engineering
12. **Exercise thumbnail images** - Use existing DB images
13. **Weight input when adding exercise** - Add optional field to form
14. **Remove "gym buddy ready" text** - UI cleanup
15. **Fix squad switching widget overflow** - Truncate with ellipsis

---

## ✅ Completed Fixes

### 2025-12-14

1. **Block video uploads for profile pictures** ✅
   - Added `mediaTypes: ['images']` to ImagePicker configuration
   - File: [SettingsScreen.tsx:925](mobile/src/screens/SettingsScreen.tsx#L925)

2. **Squad invite delays / UI not updating** ✅
   - Added immediate React Query cache invalidation for all squad-related queries after successful join
   - Users now see squad membership update instantly without needing to refresh
   - File: [SquadJoinScreen.tsx:143-148](mobile/src/screens/SquadJoinScreen.tsx#L143-L148)

3. **Squad search keyboard not appearing** ✅
   - Added `autoFocus={true}` to search TextInput
   - Keyboard now appears immediately when user opens find buddies modal
   - File: [SquadScreen.tsx:1129](mobile/src/screens/SquadScreen.tsx#L1129)

4. **Squad discovery feature** ✅
   - Built complete public squad discovery system from scratch
   - Backend: Search/browse public squads API + direct join endpoint
   - Frontend: Beautiful modal with real-time search, member counts, status badges
   - Users can now discover and join multiple squads easily
   - Files: [social.ts (backend)](server/src/routes/social.ts#L933-L1136), [SquadScreen.tsx (UI)](mobile/src/screens/SquadScreen.tsx#L2169-L2546)

---

## 📝 Notes for Implementation

### Testing Checklist (After Each Fix)

- [ ] Test on iOS (primary platform)
- [ ] Test as free user
- [ ] Test as pro user
- [ ] Test edge cases (slow network, offline, etc.)
- [ ] Verify no regressions in related features

### Implementation Notes & Context

**Squad Search Keyboard Issue:**

- Root cause: Keyboard not appearing when search input is focused
- Likely issues: Missing `autoFocus`, keyboard dismissed by ScrollView, TextInput not properly mounted
- Test: Ensure keyboard shows immediately when user taps search or screen loads

**Exercise Images:**

- Images already exist in database (confirmed)
- Need to verify schema includes image URL field
- May need to add lazy loading for performance with long exercise lists

**Notifications Architecture:**

- Using `expo-notifications` for push notification setup
- Backend needs to store push tokens and send via Expo Push Notification service
- In-app notifications can use Context + badge counters (simpler, no external dependencies)
- Both systems should work together: push for background, in-app for active sessions

**Free AI Workout Strategy:**

- Give users taste of AI quality to drive upgrades
- Track count in `users` table: `ai_generations_used` (default 0, max 1 for free)
- Show beautiful upgrade prompt after first use: "Loved your AI workout? Get unlimited generations with Pro!"
- Consider onboarding tooltip when user first sees AI button
