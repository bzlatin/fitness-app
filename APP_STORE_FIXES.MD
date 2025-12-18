# App Store Rejection Fixes - Push/Pull v1.0

**Submission ID**: bf95a478-155d-47db-b0d0-9ff0f562c9ae
**Review Date**: December 17, 2025
**Status**: 🎯 IN PROGRESS

## Quick Summary

✅ **Your website already has Privacy & Terms pages!**

- `https://push-pull.app/privacy` ✅
- `https://push-pull.app/terms` ✅

### What You Need to Do:

**Code Changes** (30-45 minutes):

1. ✅ Update photo permission text in Info.plist
2. ✅ Add subscription section to Terms of Service page
3. ✅ Add legal links to UpgradeScreen

**App Store Connect** (15 minutes): 4. ✅ Reply to Apple explaining background audio feature 5. ✅ Add Privacy Policy URL to App Store Connect 6. ✅ Add Terms link to app description 7. ✅ Update description to mark Pro features

**Then**: Rebuild iOS app, upload new build, resubmit

---

## Issue 1: Privacy - Photo Library Permission String ✅

**Guideline**: 5.1.1 - Legal - Privacy - Data Collection and Storage

**Problem**: Photo library purpose string doesn't clearly explain why the app needs photo access and how it will be used.

**Current Issue**: The `NSPhotoLibraryUsageDescription` (and possibly `NSPhotoLibraryAddUsageDescription`) strings are either missing, too vague, or don't include a specific example.

### Fix Steps:

- [x] Open `mobile/ios/pushpull/Info.plist`
- [x] Locate or add `NSPhotoLibraryUsageDescription` key
- [x] Locate or add `NSPhotoLibraryAddUsageDescription` key (not needed: app doesn't save photos to library)
- [x] Update to clear, specific purpose strings

**Recommended Purpose Strings**:

```xml
<key>NSPhotoLibraryUsageDescription</key>
<string>Push/Pull needs access to your photo library to let you add a profile picture to your account. For example, you can choose a photo from your library to personalize your fitness profile and share with your squad members.</string>

<key>NSPhotoLibraryAddUsageDescription</key>
<string>Push/Pull would like to save workout progress photos to your photo library. For example, you can save screenshots of your workout summaries or progress charts to track your fitness journey.</string>
```

**Key Requirements**:

- ✅ Clearly explain WHY you need access
- ✅ Include a SPECIFIC example ("For example, you can...")
- ✅ Avoid vague language ("App would like to access...")

**Files to Modify**:

- `mobile/ios/pushpull/Info.plist`

**Testing**:

1. Rebuild iOS app
2. Trigger photo library access (profile picture upload)
3. Verify new permission dialog shows updated text
4. Screenshot the permission dialog for App Store response

---

## Issue 2: Background Audio Mode Not Used ✅

**Guideline**: 2.5.4 - Performance - Software Requirements

**Problem**: App declares `audio` background mode in `UIBackgroundModes` but doesn't have any features that require persistent audio playback.

**Current Issue**: The Info.plist includes background audio capability, but Push/Pull is a fitness tracker, not a music/audio app.

### Fix Steps:

✅ **KEEP the `audio` background mode** - Your app legitimately uses background audio for rest timer notifications.

- [x] **Reply to Apple in App Store Connect** explaining the feature (Resolution Center / App Review Notes)
- [x] Do NOT modify Info.plist (audio mode is required)

**Reply Template for Apple**:

```
Regarding Guideline 2.5.4 (Background Audio):

Push/Pull uses the 'audio' background mode for a legitimate workout feature: rest timer audio notifications.

How to locate this feature:
1. Launch the app and log in
2. Go to "My Workouts" tab
3. Select any workout template (or create one with any exercise)
4. Tap "Start Workout" button
5. Complete one set by entering reps/weight
6. A rest timer will automatically start (default 90 seconds)
7. Lock your device or switch to another app
8. When the rest timer completes, you will hear an audio notification (timer-complete.mp3) even with the device locked

This feature is essential for workout tracking, as users keep their phones locked during rest periods to prevent accidental touches. The audio notification alerts them when it's time to start the next set.

The background audio is configured in timerSound.ts with:
- staysActiveInBackground: true
- playsInSilentModeIOS: true

This allows the rest timer to function properly during active workout sessions when users have their device locked.
```

**Files to Modify**:

- None (no code changes needed)

**Action Required**:
✅ Reply to Apple's review message in App Store Connect with the explanation above

**Testing** (for your own verification before replying):

1. Start a workout on physical iOS device
2. Complete a set to trigger rest timer
3. Lock device or switch to another app
4. Verify audio notification plays when timer completes
5. Record screen video if Apple requests demonstration

---

## Issue 3: Missing Subscription Legal Links ✅

**Guideline**: 3.1.2 - Business - Payments - Subscriptions

**Problem**: App metadata missing:

1. Terms of Use (EULA) link
2. Privacy Policy link in App Store Connect

**Current Issue**: Auto-renewable subscriptions require functional links to legal documents in both the app binary AND App Store Connect.

### Fix Steps:

✅ **You already have Privacy Policy and Terms pages!**

- Privacy: `https://push-pull.app/privacy` ✅
- Terms: `https://push-pull.app/terms` ✅

✅ **Terms page includes subscription-specific language**

#### A. Add Subscription Terms to Terms of Service

Your Terms of Service page needs a section covering:

- [x] Subscription duration (monthly/annual)
- [x] Auto-renewal terms
- [x] Cancellation policy
- [x] Refund policy
- [x] Price changes
- [x] Payment processing (Apple App Store)

See code changes below for the exact section to add.

#### B. Update App Store Connect Metadata

- [x] Log in to [App Store Connect](https://appstoreconnect.apple.com)
- [x] Navigate to: Apps → Push Pull → App Information
- [x] Find "Privacy Policy URL" field
- [x] Enter: `https://push-pull.app/privacy`
- [x] Scroll to "App Description" section
- [x] Add to description: "Terms of Use: https://push-pull.app/terms"

#### C. Add Links to App Binary (In-App)

The app must display these links within the subscription purchase flow.

- [x] Open `mobile/src/screens/UpgradeScreen.tsx`
- [x] Add Terms of Use link (clickable)
- [x] Add Privacy Policy link (clickable)
- [x] Ensure links are visible BEFORE user purchases subscription

**Example Implementation**:

```typescript
// In UpgradeScreen.tsx, add at bottom of subscription cards:

<View className="flex-row justify-center mt-4 mb-2">
  <TouchableOpacity onPress={() => Linking.openURL('https://pushpullapp.com/terms')}>
    <Text className="text-xs text-gray-400 underline">Terms of Use</Text>
  </TouchableOpacity>
  <Text className="text-xs text-gray-400 mx-2">•</Text>
  <TouchableOpacity onPress={() => Linking.openURL('https://pushpullapp.com/privacy')}>
    <Text className="text-xs text-gray-400 underline">Privacy Policy</Text>
  </TouchableOpacity>
</View>

<Text className="text-xs text-gray-400 text-center mt-2">
  Subscriptions auto-renew unless canceled at least 24 hours before the end of the current period.
</Text>
```

**Files to Modify**:

- `web/src/app/terms/page.tsx` (add subscription section)
- `mobile/src/screens/UpgradeScreen.tsx` (add legal links)
- App Store Connect metadata (web interface)

✅ **External Pages Already Exist**:

- Privacy Policy: `https://push-pull.app/privacy` ✅
- Terms of Service: `https://push-pull.app/terms` ✅ (includes subscription section)

**Testing**:

1. Verify links open in browser from app
2. Verify links are publicly accessible (no login required)
3. Test on iOS device before resubmission

---

## Issue 4: Misleading Metadata - Paid Features Not Marked ✅

**Guideline**: 2.3.2 - Performance - Accurate Metadata

**Problem**: App description references "tracker" and other features but doesn't clearly indicate which features require a Pro subscription.

**Current Issue**: Users might think all tracking features are free, but some (like fatigue tracking, AI generation, unlimited templates) require Pro.

### Fix Steps:

- [x] Log in to [App Store Connect](https://appstoreconnect.apple.com)
- [x] Navigate to: Apps → Push Pull → Version 1.0 → App Information
- [x] Edit the "Description" field
- [x] Clearly label which features are free vs. Pro

**Recommended Description Structure**:

```
Push/Pull is a social-first fitness tracking app that combines intelligent workout programming with community motivation.

FREE FEATURES:
✓ Track unlimited workouts with 800+ exercises
✓ Create up to 3 custom workout templates
✓ Log sets, reps, and weight with progressive overload tracking
✓ Join squads and share workouts with friends
✓ Follow other lifters and see their progress
✓ View workout history and calendar

PRO FEATURES (Subscription Required):
⭐ Unlimited custom workout templates
⭐ AI-powered workout generation with GPT-4
⭐ Advanced fatigue and recovery tracking
⭐ Personalized progression suggestions
⭐ Muscle group distribution analytics

SUBSCRIPTION PRICING:
• Monthly: $4.99/month
• Annual: $49.99/year (Save 17%)

Subscriptions automatically renew unless canceled at least 24 hours before the end of the current period. Manage your subscription in Account Settings.

Terms of Use: https://pushpullapp.com/terms
Privacy Policy: https://pushpullapp.com/privacy
```

**Key Requirements**:

- ✅ Separate FREE vs. PRO features clearly
- ✅ Use labels like "(Subscription Required)" or "(Pro only)"
- ✅ Include subscription pricing in description
- ✅ Mention auto-renewal terms
- ✅ Include links to Terms & Privacy Policy

**Files to Modify**:

- App Store Connect metadata (web interface only, no code changes)

**Testing**:

1. Preview updated description in App Store Connect
2. Ensure all claims are accurate
3. Verify no feature is misleadingly advertised as free

---

## Additional Recommendations (Not Required, But Best Practice)

### A. Add Subscription Info Screen in App

- [ ] Create `SubscriptionInfoScreen.tsx` with:
  - Subscription duration (monthly/annual)
  - Pricing
  - Auto-renewal terms
  - Cancellation instructions
  - Links to Terms & Privacy Policy
- [ ] Link from ProfileScreen settings

### B. Add EULA/Privacy Policy to Repo

- [ ] Create `legal/TERMS_OF_USE.md`
- [ ] Create `legal/PRIVACY_POLICY.md`
- [ ] Host on GitHub Pages or external site
- [ ] Add links to app footer

### C. Update Screenshots (If Needed)

- [ ] Review App Store screenshots
- [ ] Ensure no misleading claims about features
- [ ] Add small text "(Pro)" on screenshots showing paid features

---

## Issue 4: HealthKit UI Disclosure ✅

**Guideline**: 2.5.1 - Performance - Software Requirements

**Problem**: The app uses HealthKit but the in-app UI didn’t clearly call out what HealthKit is used for.

### Fix Steps (Code)

- [x] Update Settings UI copy to explicitly mention **Apple Health (HealthKit)** and clarify read/write behavior.
- [x] Add a short “How HealthKit is used” explainer in Settings.
- [x] Add a visible Apple Health (HealthKit) status card on the post‑workout screen so reviewers can see the integration even if they don’t find Settings.
- [x] Update `NSHealthShareUsageDescription` / `NSHealthUpdateUsageDescription` strings to match the actual behavior (read + write).

**Files Modified**:

- `mobile/src/screens/SettingsScreen.tsx`
- `mobile/src/screens/PostWorkoutShareScreen.tsx`
- `mobile/app.config.ts`
- `mobile/ios/pushpull/Info.plist`

### Reviewer Notes (Suggested)

Paste this into App Store Connect → App Review Notes:

```
HealthKit Disclosure (Guideline 2.5.1):

Push/Pull integrates with Apple Health using HealthKit.

Where to find it in the UI:
1) Settings → "Apple Health (HealthKit)" section (includes a "How HealthKit is used" explainer)
2) After finishing a workout → Post-workout screen shows "Apple Health (HealthKit)" status

HealthKit usage:
- Read (optional): Apple Health workouts, active calories, heart rate
- Write (optional): completed workouts logged in Push/Pull
```

---

## Submission Checklist (Before Resubmitting)

- [x] ✅ Updated photo library permission strings in Info.plist
- [x] ✅ Removed background audio mode (or justified it to Apple)
- [x] ✅ Created and hosted Privacy Policy at public URL
- [x] ✅ Created and hosted Terms of Use at public URL
- [x] ✅ Added Privacy Policy URL to App Store Connect
- [x] ✅ Added Terms of Use link to App Store Connect description
- [x] ✅ Added legal links to UpgradeScreen in app binary
- [x] ✅ Updated App Store description to clearly mark Pro features
- [ ] ✅ Tested all links open correctly from iOS device
- [ ] ✅ Rebuilt and archived new iOS build
- [ ] ✅ Uploaded new build to App Store Connect
- [ ] ✅ Submitted for review with reply to Apple (if needed)

---

## Estimated Timeline

- **Issue 1 (Photo Permissions)**: 10 minutes
- **Issue 2 (Background Audio)**: 5 minutes
- **Issue 3 (Legal Links)**: 2-4 hours (if creating EULA/Privacy Policy from scratch)
- **Issue 4 (Metadata Update)**: 30 minutes

**Total**: ~3-5 hours (mostly legal document creation)

**Fast Track Option**: Use legal document templates and Apple's standard EULA to reduce time to ~1 hour.

---

## Reply to Apple (Template)

When resubmitting, reply to the App Store review message:

```
Hello,

Thank you for the feedback. We've addressed all issues:

1. Photo Library Permission: Updated NSPhotoLibraryUsageDescription with clear explanation and specific example of profile picture usage.

2. Background Audio: Removed 'audio' from UIBackgroundModes as the app does not require persistent audio playback.

3. Subscription Legal Links:
   - Added Privacy Policy URL to App Store Connect: [YOUR_URL]
   - Added Terms of Use link to app description: [YOUR_URL]
   - Added functional links to both documents in the app's subscription screen (UpgradeScreen.tsx)

4. Metadata Accuracy: Updated app description to clearly distinguish free features from Pro subscription features, with explicit "(Subscription Required)" labels.

All changes are included in build version 1.0 (build [NEW_BUILD_NUMBER]).

Please let us know if you need any clarification.

Thank you,
[Your Name]
```

---

## Notes

- All code changes require rebuilding the iOS app and creating a new archive
- Legal documents (Privacy Policy, Terms of Use) must be hosted externally and publicly accessible
- After fixing, expect 24-48 hour review turnaround from Apple
- Consider using [App Privacy Policy Generator](https://app-privacy-policy-generator.nisrulz.com/) for quick legal docs
