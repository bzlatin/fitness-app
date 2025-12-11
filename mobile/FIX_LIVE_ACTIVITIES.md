# Fix Live Activities Provisioning Issue

## The Problem
Your provisioning profile doesn't include the `com.apple.developer.ActivityKit` entitlement that we just added.

## Solution: Update in Xcode (5 minutes)

### Step 1: Open the Project in Xcode
```bash
open /Users/ben/coding_projects/fitness-app/mobile/ios/pushpull.xcworkspace
```

### Step 2: Fix the Main App Signing

1. In Xcode, select the **pushpull** project in the left sidebar
2. Select the **pushpull** target (under TARGETS)
3. Go to the **Signing & Capabilities** tab
4. Make sure **Automatically manage signing** is checked
5. Select your Team from the dropdown
6. Click the **+ Capability** button
7. Add **"Live Activities"** capability
   - This will automatically update your provisioning profile

### Step 3: Fix the Widget Extension Signing

1. Still in the same project, select the **WidgetsExtension** target
2. Go to **Signing & Capabilities** tab
3. Make sure **Automatically manage signing** is checked
4. Select your Team
5. Click **+ Capability**
6. Add **"Live Activities"** capability

### Step 4: Clean and Build

In Xcode:
1. Product → Clean Build Folder (⇧⌘K)
2. Product → Build (⌘B)
3. If successful, run on your device (⌘R)

## Alternative: Command Line After Xcode Fix

After fixing signing in Xcode, you can also rebuild from terminal:

```bash
cd /Users/ben/coding_projects/fitness-app/mobile
npx expo run:ios --device
```

## Verify It Works

1. Start a workout session
2. Lock your phone
3. You should see the Live Activity on the lock screen showing:
   - Current exercise name
   - Set counter (e.g., "Set 1 of 4")
   - Target reps/weight
   - Workout progress bar

4. Check Dynamic Island (on iPhone 14 Pro+)
   - Should show compact dumbbell icon
   - Tap to expand and see full workout details

## Check Console Logs

Look for these messages in Xcode console or Metro logs:

```
🔵 [LiveActivity] startWorkoutLiveActivity called
🔵 [LiveActivity] Live Activities enabled: true
✅ [LiveActivity] Started: Bench Press
```

If you see:
```
⚠️ [LiveActivity] Live Activities are disabled in Settings
```

Then go to: **Settings → Push/Pull → Enable "Live Activities"**

---

## Troubleshooting

### "Provisioning profile doesn't support Live Activities"
- Make sure you clicked the + Capability button and added "Live Activities" in both targets
- The capability should show up in the Signing & Capabilities tab
- Clean build folder and try again

### "Live Activity not appearing on lock screen"
- Check iOS Settings → Push/Pull → Live Activities (should be ON)
- Make sure you're on iOS 16.1 or later
- Try restarting the app after enabling the capability

### "Module not found: LiveActivityModule"
- Make sure you rebuilt the app after adding the entitlements
- Check that the Widget extension is included in the build scheme
