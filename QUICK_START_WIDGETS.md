# iOS Widgets - Quick Start Guide

**Goal**: Get Push/Pull widgets running on your iOS device in 30 minutes.

---

## Prerequisites (5 minutes)

Install these if you haven't already:

```bash
# Install EAS CLI globally
npm install -g eas-cli

# Log in to EAS
eas login

# Verify you're in the right directory
cd /Users/ben/coding_projects/fitness-app/mobile
```

**Check you have:**
- ✅ Xcode 15+ installed
- ✅ Apple Developer account
- ✅ iOS device or simulator (iOS 16.0+)

---

## Step 1: Build the App (10-15 minutes)

Run the EAS build command:

```bash
eas build --platform ios --profile development --local
```

**What this does:**
- Generates iOS project with widget support
- Adds App Groups entitlements
- Creates a development build

**Wait time:** ~10-15 minutes

**Output:** `build-XXXXX.ipa` file in mobile directory

---

## Step 2: Xcode Setup (5-10 minutes)

### 2.1 Open Xcode

```bash
cd ios
open pushpull.xcworkspace
```

### 2.2 Add Widget Target

1. **File → New → Target**
2. Select **Widget Extension**
3. Name: `PushPullWidgets`
4. Language: **Swift**
5. **UNCHECK** "Include Configuration Intent"
6. Click **Finish**, then **Activate**

### 2.3 Add Widget Files

1. Right-click `PushPullWidgets` folder in Xcode
2. **Add Files to "pushpull"...**
3. Navigate to `/Users/ben/coding_projects/fitness-app/mobile/ios/Widgets`
4. Select all `.swift` files
5. **Check only** `PushPullWidgets` target
6. Click **Add**

### 2.4 Configure App Groups

**For Widget Target:**
1. Select `PushPullWidgets` target
2. **Signing & Capabilities** tab
3. **+ Capability** → **App Groups**
4. Enable: `group.com.pushpull.app`

**For Main App:**
1. Select `pushpull` target
2. **Signing & Capabilities** tab
3. **+ Capability** → **App Groups** (if not already added)
4. Enable: `group.com.pushpull.app`

---

## Step 3: Build and Run (5 minutes)

### 3.1 Build Widget

1. Select **PushPullWidgets** scheme (top-left in Xcode)
2. Select your device/simulator
3. Press **⌘ + R** (or click Run)

**Expected:** iOS simulator opens with widget preview gallery

### 3.2 Build Main App

1. Select **pushpull** scheme
2. Press **⌘ + R**

**Expected:** App opens, you can log in

---

## Step 4: Add Widget to Home Screen (2 minutes)

1. **Long-press** on home screen
2. Tap **+** button (top-left)
3. Search for "Push" or scroll to find **Push/Pull**
4. Select widget size:
   - **Small**: Weekly Goal Ring
   - **Medium**: Goal + Stats or Quick Actions
5. Tap **Add Widget**
6. Tap **Done**

---

## Step 5: Test It Works (3 minutes)

### Test 1: Widget Shows Your Data
- Widget should show your weekly goal (e.g., "2 of 4")
- If placeholder data, wait ~30 seconds for API fetch

### Test 2: Complete a Workout
1. Open app
2. Complete a workout session
3. Return to home screen
4. Widget updates within ~30 minutes (or remove/re-add to force refresh)

### Test 3: Deep Links
1. Add Quick Actions widget
2. Tap **Start Workout** button
3. **Expected:** App opens to Home tab

---

## Troubleshooting

### Widget Not Showing Up?

**Check:**
- App Groups enabled on both targets?
- Bundle IDs correct? (Main: `com.pushpull.app`, Widget: `com.pushpull.app.widgets`)
- Widget files added to widget target only?

**Fix:**
1. Clean build folder: **Product → Clean Build Folder**
2. Rebuild widget target

---

### Widget Shows Placeholder?

**Check:**
- Is backend server running? `cd ../server && npm run dev`
- Can you hit the API?
  ```bash
  curl http://localhost:3000/api/engagement/widget-data \
    -H "Authorization: Bearer YOUR_TOKEN"
  ```

**Fix:**
1. Check Xcode console for errors
2. Verify auth token is synced (see `/mobile/src/services/widgetSync.ts`)

---

### Deep Links Not Working?

**Check:**
- URL schemes in Info.plist: `pushpull`, `push-pull`
- App.tsx has widget routes?

**Fix:**
1. Verify linking config in `App.tsx`
2. Rebuild main app

---

## Full Documentation

Need more details?

- **Setup Guide**: `/mobile/ios/Widgets/README.md`
- **Testing Guide**: `/mobile/ios/Widgets/TESTING_GUIDE.md`
- **Build Commands**: `/mobile/EAS_BUILD_COMMANDS.md`
- **Implementation Summary**: `/WIDGETS_IMPLEMENTATION_SUMMARY.md`

---

## What You Should See

### Weekly Goal Widget (Small)
```
┌────────────────┐
│  WEEKLY GOAL   │
│                │
│    ┌──────┐    │
│    │ 2/4  │    │  ← Your progress
│    └──────┘    │
│                │
│  2 more to go  │
└────────────────┘
```

### Quick Actions Widget (Medium)
```
┌──────────────────────────────┐
│  QUICK ACTIONS   🔥 5        │
│  Good morning!               │
│                              │
│  [Start Workout] [Quick Log] │
└──────────────────────────────┘
```

---

## Success Checklist

- [ ] EAS build completed successfully
- [ ] Widget targets added in Xcode
- [ ] App Groups configured on both targets
- [ ] Widget appears in widget gallery
- [ ] Widget shows your actual data (not placeholder)
- [ ] Tapping widget opens app
- [ ] Widget updates after completing workout

---

## Total Time: ~30 minutes

- Build: 10-15 min
- Xcode setup: 5-10 min
- Testing: 5 min

---

**Need help?** Check the full guides in `/mobile/ios/Widgets/` directory.

**Ready to ship?** See `/WIDGETS_IMPLEMENTATION_SUMMARY.md` for rollout plan.
