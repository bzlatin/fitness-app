# Quick Set Logger Widget - Testing Steps

## 🎯 Quick Testing Checklist

Follow these exact steps to verify the widget is working correctly.

## Prerequisites
- [ ] iOS device or simulator (iOS 14.0+)
- [ ] App built with widget extension included
- [ ] Xcode or EAS build completed

---

## Test 1: Add Widget to Home Screen ✅

**Steps:**
1. Long-press on iOS home screen
2. Tap "+" button in top-left
3. Scroll to find "Push/Pull" app
4. Tap on it
5. Select "Quick Set Logger" widget
6. Choose **Medium** size (easier to see all details)
7. Tap "Add Widget"
8. Position it somewhere visible

**Expected Result:**
- Widget shows "No Active Workout" message
- Displays instruction text: "Start a workout to use Quick Set Logger"

**✅ Pass / ❌ Fail**: _______

---

## Test 2: Start Workout & Check Initial Sync ✅

**Steps:**
1. Open Push/Pull app
2. Go to "My Workouts" tab
3. Select any template with **4+ exercises** and **3+ sets per exercise**
4. Tap "Start Workout"
5. Wait for workout to load (~1-2 seconds)
6. **Exit app** (press home button or swipe up - DO NOT force quit)
7. Go to home screen
8. Look at the Quick Set Logger widget

**Expected Result:**
Widget should display:
- ✅ Green "Active Workout" badge with dumbbell icon
- ✅ First exercise name (e.g., "Bench Press")
- ✅ "Set 1/X" indicator (where X is total sets for that exercise)
- ✅ Target reps (e.g., "8 reps")
- ✅ Target weight (e.g., "185 lbs")
- ✅ "Log Set" button

**Console Logs to Check:**
```
✅ Active session synced to widget: [Exercise Name]
✅ Widget data synced successfully via native module
📱 Widget refresh triggered
```

**✅ Pass / ❌ Fail**: _______

**Screenshot:** (Take screenshot of widget showing first exercise)

---

## Test 3: Log First Set & Verify Update ✅

**Steps:**
1. Open app again (tap icon or use app switcher)
2. You should be on WorkoutSessionScreen
3. For the first set, enter:
   - Reps: 8
   - Weight: 185
4. Tap checkmark to log the set
5. **Wait 5 seconds** (allow sync to complete)
6. **Exit app again**
7. Check widget on home screen

**Expected Result:**
Widget should now display:
- ✅ Same exercise name
- ✅ "Set 2/X" indicator (advanced to next set)
- ✅ "Last set: 8 reps @ 185 lbs" (shows what you just logged)
- ✅ Target for Set 2 displayed

**Console Logs:**
```
✅ Active session synced to widget: [Exercise Name]
```

**✅ Pass / ❌ Fail**: _______

---

## Test 4: Change Exercise Manually ✅

**Steps:**
1. Open app
2. Scroll down in the exercise list
3. Find a **different exercise** (e.g., second or third in the list)
4. **Tap on it** to expand that exercise card
5. **Exit app**
6. Check widget

**Expected Result:**
Widget should display:
- ✅ **New exercise name** (the one you just tapped)
- ✅ "Set 1/X" for that exercise (or current progress if you logged sets)
- ✅ Target reps/weight for that exercise

**✅ Pass / ❌ Fail**: _______

---

## Test 5: Complete All Sets in Exercise (Auto-Advance) ✅

**Steps:**
1. Open app
2. Return to the **first exercise**
3. Log all remaining sets (tap checkmark for each set)
4. After the last set of Exercise 1, the app should auto-advance to Exercise 2
5. **Exit app**
6. Check widget

**Expected Result:**
Widget should display:
- ✅ **Second exercise name** (auto-advanced)
- ✅ "Set 1/X" for the new exercise
- ✅ Last set from Exercise 1 might still be shown
- ✅ Target for first set of Exercise 2

**✅ Pass / ❌ Fail**: _______

---

## Test 6: Complete Workout & Verify Clear ✅

**Steps:**
1. Open app
2. Tap "Finish Workout" button (don't log all sets if you don't want to)
3. Go through the share/summary screen
4. Navigate away from the post-workout screen
5. Check widget on home screen

**Expected Result:**
Widget should display:
- ✅ "No Active Workout" state
- ✅ No exercise name shown
- ✅ Instruction text visible
- ✅ No stale data from previous workout

**Console Logs:**
```
✅ Active session cleared from widget
```

**✅ Pass / ❌ Fail**: _______

---

## Test 7: Widget Deep Link (Tap Widget) ✅

**Steps:**
1. Start a new workout
2. Exit app
3. Verify widget shows active workout
4. **Tap the "Log Set" button** on the widget
5. Observe what happens

**Expected Result:**
- ✅ App opens
- ✅ Navigates directly to WorkoutSessionScreen
- ✅ Shows the active workout
- ✅ Ready to log the current set

**✅ Pass / ❌ Fail**: _______

---

## Test 8: Navigate Away Without Finishing ✅

**Steps:**
1. Start a workout
2. Log 1-2 sets
3. **Navigate to a different tab** (e.g., Profile or History)
4. Verify you're no longer on WorkoutSessionScreen
5. Check widget

**Expected Result:**
Widget should display:
- ✅ "No Active Workout" (widget cleared because you left the session)

**Note:** This is expected behavior - widget only shows data while WorkoutSessionScreen is active or recently active.

**✅ Pass / ❌ Fail**: _______

---

## Edge Case Tests

### Edge Case 1: Bodyweight Exercise ✅

**Steps:**
1. Start a workout with a bodyweight exercise (e.g., Push-ups, Pull-ups)
2. Exit and check widget

**Expected Result:**
- ✅ Shows reps target
- ✅ Weight shows as "0 lbs" or handles null gracefully
- ✅ No crash

**✅ Pass / ❌ Fail**: _______

---

### Edge Case 2: Single-Set Exercise ✅

**Steps:**
1. Create/use a template with an exercise that has only 1 set
2. Start workout
3. Check widget

**Expected Result:**
- ✅ Shows "Set 1/1"
- ✅ No crash when advancing past it

**✅ Pass / ❌ Fail**: _______

---

### Edge Case 3: Force Close During Workout ✅

**Steps:**
1. Start workout and log 2-3 sets
2. Exit app
3. **Force quit the app** (swipe up in app switcher)
4. Wait 10 seconds
5. Check widget

**Expected Result:**
- ✅ Widget shows last synced state (most recent exercise/set)
- ✅ Widget doesn't show "No Active Workout" immediately
- ✅ Widget data persists across app restarts

**Open app again:**
- ✅ Widget should update to current state

**✅ Pass / ❌ Fail**: _______

---

### Edge Case 4: Long Inactive Period ✅

**Steps:**
1. Start workout
2. Exit app
3. **Wait 10+ minutes** without touching app
4. Check widget

**Expected Result:**
- ✅ Widget still shows active workout (doesn't auto-expire)
- ✅ Widget refreshes when you open app again

**✅ Pass / ❌ Fail**: _______

---

### Edge Case 5: Rapid Set Logging ✅

**Steps:**
1. Start workout
2. Log 3-4 sets very quickly (within 30 seconds)
3. Check widget after each set

**Expected Result:**
- ✅ Widget updates to latest set logged
- ✅ No race conditions or stale data
- ✅ Last logged set always shows correctly

**✅ Pass / ❌ Fail**: _______

---

## 🐛 Known Issues / Troubleshooting

### Issue: Widget Shows "No Active Workout" Despite Active Session

**Check:**
1. Console for `⚠️ WidgetSyncModule not available` warning
2. App Groups capability enabled: `group.com.pushpull.app`
3. Widget extension included in build

**Fix:**
- Rebuild app with widget extension
- Remove and re-add widget to home screen

---

### Issue: Widget Shows Stale/Old Exercise

**Check:**
1. Console logs for `✅ Active session synced to widget`
2. Widget refresh triggered: `📱 Widget refresh triggered`

**Fix:**
- Wait 30 seconds (widget auto-refreshes)
- Remove and re-add widget
- Restart app

---

### Issue: Tapping Widget Doesn't Open App

**Check:**
1. Deep link configured: `pushpull://workout/log-set`
2. Test in Safari: Type `pushpull://workout/log-set` in address bar

**Fix:**
- Rebuild app to register URL scheme
- Check `app.config.ts` for scheme configuration

---

## 📊 Testing Summary

| Test Case | Pass/Fail | Notes |
|-----------|-----------|-------|
| 1. Add Widget | ⬜ | |
| 2. Initial Sync | ⬜ | |
| 3. Log Set Update | ⬜ | |
| 4. Change Exercise | ⬜ | |
| 5. Auto-Advance | ⬜ | |
| 6. Complete Workout | ⬜ | |
| 7. Deep Link | ⬜ | |
| 8. Navigate Away | ⬜ | |
| Edge 1: Bodyweight | ⬜ | |
| Edge 2: Single Set | ⬜ | |
| Edge 3: Force Close | ⬜ | |
| Edge 4: Long Inactive | ⬜ | |
| Edge 5: Rapid Logging | ⬜ | |

**Overall Pass Rate:** _____ / 13

---

## ✅ All Tests Passed?

If all tests pass, the Quick Set Logger widget is **fully functional** and ready for production! 🎉

If some tests fail, check:
1. Console logs for errors
2. Widget module availability
3. App Groups configuration
4. Rebuild app with widget extension

---

## 📸 Screenshots to Capture

For documentation/demo purposes, take screenshots of:
1. ✅ Widget showing "No Active Workout"
2. ✅ Widget showing first exercise (Set 1/4)
3. ✅ Widget showing progress (Set 3/4) with last set data
4. ✅ Widget after auto-advancing to new exercise
5. ✅ Deep link in action (app opening from widget tap)

---

**Testing completed on:** _______________

**Tested by:** _______________

**Build version:** _______________

**All critical tests passed:** ☐ Yes  ☐ No
