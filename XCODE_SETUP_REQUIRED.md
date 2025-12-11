# Xcode Setup Required for Live Activities

## ⚠️ Before Running `npx expo run:ios --device`

You need to make **2 quick changes** in Xcode first (5 minutes total).

---

## 🔧 Setup Steps

### Step 1: Add `NSSupportsLiveActivities` to Info.plist

**Why**: Tells iOS your app supports Live Activities.

**How**:
1. Open Xcode:
   ```bash
   cd mobile
   npx expo prebuild --platform ios
   open ios/pushpull.xcworkspace
   ```

2. In Xcode, find `pushpull/Info.plist` in the left sidebar
   - Click on it to open

3. Right-click anywhere in the property list → **"Add Row"**

4. Set the new row to:
   - **Key**: `NSSupportsLiveActivities`
   - **Type**: `Boolean`
   - **Value**: `YES` (check the checkbox)

**Visual**:
```
Info.plist
├── CFBundleDisplayName: Push/Pull
├── CFBundleIdentifier: com.pushpull.app
├── ... (other entries)
└── NSSupportsLiveActivities: YES  ← ADD THIS
```

---

### Step 2: Link ActivityKit Framework

**Why**: Provides the Live Activities API.

**How**:
1. In Xcode, click on the **pushpull** project in the left sidebar (the blue icon at the top)

2. Select the **pushpull** target (under "Targets")

3. Click the **"General"** tab at the top

4. Scroll down to **"Frameworks, Libraries, and Embedded Content"**

5. Click the **"+"** button

6. In the search box, type: **`ActivityKit`**

7. Select `ActivityKit.framework` from the list

8. Click **"Add"**

9. Make sure it shows as **"Do Not Embed"** (default)

**Visual**:
```
Frameworks, Libraries, and Embedded Content
├── React-Core.framework
├── ... (existing frameworks)
└── ActivityKit.framework  ← ADD THIS (Do Not Embed)
```

---

### Step 3: (Optional) Verify App Groups

**Why**: Already set up for widgets, but good to verify.

**How**:
1. In Xcode, select **pushpull** target

2. Click **"Signing & Capabilities"** tab

3. Verify **"App Groups"** capability exists with:
   - `group.com.pushpull.app`

**If missing**:
- Click **"+ Capability"**
- Search for **"App Groups"**
- Add it
- Enable `group.com.pushpull.app`

---

## ✅ That's It! Now Run

After making these changes:

```bash
cd mobile
npx expo run:ios --device
```

**OR** build directly in Xcode:
1. Connect your iPhone
2. Select your device from the top dropdown
3. Click the ▶️ Play button

---

## 🎯 Quick Checklist

Before running:
- ☐ Added `NSSupportsLiveActivities: YES` to Info.plist
- ☐ Added `ActivityKit.framework` to Frameworks
- ☐ Verified App Groups capability exists
- ☐ Closed and reopened Xcode (to refresh)

After running:
- ☐ App launches on device
- ☐ Start a workout
- ☐ Live Activity appears in Dynamic Island/Lock Screen

---

## 🐛 If Build Fails

### Error: "Use of undeclared type 'Activity'"

**Cause**: ActivityKit framework not linked.

**Fix**:
- Follow Step 2 above
- Clean build folder: Xcode → Product → Clean Build Folder (⇧⌘K)
- Rebuild

### Error: "Live Activities are not enabled"

**Cause**: Missing `NSSupportsLiveActivities` in Info.plist.

**Fix**:
- Follow Step 1 above
- Rebuild

### Console Warning: "Live Activities not available"

**Cause**: iOS version < 16.1

**Fix**:
- Update iPhone to iOS 16.1+
- OR test on newer device

---

## 📱 Device Requirements

**For Dynamic Island**:
- iPhone 14 Pro / Pro Max
- iPhone 15 Pro / Pro Max
- iPhone 16 Pro / Pro Max

**For Lock Screen Live Activity**:
- Any iPhone running iOS 16.1+

**Settings to Check**:
1. Go to Settings → Face ID & Passcode → (Enter passcode)
2. Scroll down to "Allow Access When Locked"
3. Ensure **"Live Activities"** is turned ON

---

## 🚀 After Setup

Once Xcode is configured, you can use **either**:

**Option 1**: Xcode (GUI)
```bash
cd mobile
npx expo prebuild --platform ios
open ios/pushpull.xcworkspace
# Then click ▶️ in Xcode
```

**Option 2**: Expo CLI (Terminal)
```bash
cd mobile
npx expo run:ios --device
```

Both will work! Choose whichever you prefer.

---

## ⏱️ Total Time: ~5 Minutes

1. Add Info.plist entry: **1 min**
2. Link ActivityKit framework: **2 min**
3. Verify App Groups: **1 min**
4. Build to device: **1 min**

Then start a workout and watch the Live Activity appear! 🎉
