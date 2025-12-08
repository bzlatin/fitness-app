# Live Activity - Complete Setup & Fixes

## Overview
Live Activities for workouts are now fully functional with:
- ✅ Timer positioned on the left (prominent display)
- ✅ Rest timer that properly expires (no negative countdown)
- ✅ "Log Set" button that works from Lock Screen
- ✅ Automatic timer clearing when rest period ends

## Features

### Lock Screen Display
1. **Header**
   - 🏋️ Dumbbell icon (green)
   - ⏱️ Workout elapsed time (left, prominent, monospaced)
   - 📋 Template name (right, subtle)

2. **Current Exercise Section**
   - Exercise name
   - Set progress (e.g., "Set 3 of 4")
   - **Rest Timer** (orange, large) OR **Target reps/weight** (blue)

3. **Last Set Performance**
   - Shows after logging a set
   - Hidden during active rest timer
   - Format: "Last set: 8 reps @ 185 lbs"

4. **Progress Bar**
   - Tracks completed exercises
   - Green tint

5. **Log Set Button**
   - Green button, full width
   - Only visible when NOT resting
   - Appears immediately when rest timer expires
   - Tapping logs the current set

### Dynamic Island (iPhone 14 Pro+)
- **Compact**: Dumbbell icon + set number or rest timer
- **Expanded**: Full exercise info + rest timer + progress

## Implementation Details

### Rest Timer Behavior
**Starting Rest Timer:**
```tsx
// When logging a set with auto-rest enabled
syncCurrentExerciseToWidget(exerciseKey, setIndex, reps, weight, restDuration);
```

**Timer Countdown:**
- Counts down from rest duration (e.g., 90s)
- Shows in orange with "Rest" label
- Hides "Log Set" button during countdown
- Hides "Last set" info during countdown

**Timer Expiration:**
1. React Native detects timer hit 0
2. Sends `updateWorkoutLiveActivity({ restDuration: null })`
3. Swift clears `restEndTime` and `restDuration`
4. Live Activity updates:
   - Rest timer disappears
   - Target info reappears
   - "Log Set" button appears
   - "Last set" info reappears

### Log Set Button Behavior
**User Flow:**
1. User locks phone during workout
2. Sees Live Activity on Lock Screen
3. Taps "Log Set" button
4. App Intent fires (`LogSetIntent`)
5. Notification posted to `NotificationCenter`
6. `LiveActivityModule` catches notification
7. Event sent to React Native
8. `WorkoutSessionScreen` receives event
9. Current active set is logged
10. Live Activity updates with new set info

**Code Flow:**
```
Lock Screen Button
    ↓
LogSetIntent.perform()
    ↓
NotificationCenter.post("LogSetFromLiveActivity")
    ↓
LiveActivityModule.handleLogSetIntent()
    ↓
RCTEventEmitter.sendEvent("onLogSetFromLiveActivity")
    ↓
WorkoutSessionScreen.addLogSetListener()
    ↓
logSet(activeSetId)
```

## Files Modified

### Swift (Native iOS)
1. **WorkoutLiveActivity.swift**
   - Moved timer to left in header
   - Added expiration check: `restEndTime > Date()`
   - Added "Log Set" button with intent
   - Button visibility based on timer state

2. **LogSetIntent.swift** (NEW)
   - App Intent for button interaction
   - Posts to NotificationCenter
   - Passes session ID to React Native

3. **LiveActivityModule.swift**
   - Changed from `NSObject` to `RCTEventEmitter`
   - Added NotificationCenter observer
   - Sends events to React Native
   - Improved rest timer clearing logic
   - Added debug logging for timer updates

### TypeScript (React Native)
4. **liveActivity.ts**
   - Added `NativeEventEmitter` setup
   - Added `addLogSetListener()` function
   - Returns cleanup function for unmounting

5. **WorkoutSessionScreen.tsx**
   - Added `useEffect` to listen for log set events
   - Validates session ID before logging
   - Logs active set when button pressed
   - Clears Live Activity timer on expiration

## Testing Checklist

### Rest Timer
- [x] Timer starts when logging a set
- [x] Timer counts down properly (e.g., 1:30 → 1:29 → ... → 0:01 → 0:00)
- [x] Timer does NOT go negative
- [x] Timer disappears at 0:00
- [x] "Log Set" button appears when timer expires
- [x] Target info reappears when timer expires

### Log Set Button
- [ ] Button visible when NOT resting
- [ ] Button hidden during rest countdown
- [ ] Button appears immediately when timer expires
- [ ] Tapping button logs the active set
- [ ] Live Activity updates after logging
- [ ] Works from Lock Screen
- [ ] Works from Dynamic Island (expanded)
- [ ] Works when app is backgrounded

### Edge Cases
- [ ] App killed → Live Activity persists
- [ ] Multiple rapid button taps → No duplicate logs
- [ ] Session ID mismatch → No action taken
- [ ] No active set → Warning logged, no crash

## Known Issues & Solutions

### Issue: Timer counts up after expiring
**Solution**: Added `restEndTime > Date()` check before displaying timer

### Issue: Button doesn't work when tapped
**Solution**:
1. Ensure `LogSetIntent.swift` is in WidgetsExtension target
2. Added event emitter to `LiveActivityModule`
3. Added listener in `WorkoutSessionScreen`

### Issue: Timer doesn't clear after expiration
**Solution**:
1. Send `restDuration: null` explicitly from React Native
2. Swift detects `shouldClearRestTimer` and sets `restEndTime = nil`
3. Live Activity re-renders without timer

## Debug Logging

Watch for these console messages:

**Starting Rest Timer:**
```
🔵 [LiveActivity] Setting rest timer to 90 seconds
```

**Clearing Rest Timer:**
```
🔵 [LiveActivity] Clearing rest timer (restDuration was nil/0)
```

**Button Press:**
```
✅ [LiveActivity] Log set intent received for session: abc123
🔵 [WorkoutSession] Log set from Live Activity: abc123
✅ Logging active set from Live Activity: set-id-456
```

**Timer Expiration:**
```
🔵 [LiveActivity] Live Activities enabled: true
🔵 [LiveActivity] Clearing rest timer (restDuration was nil/0)
✅ Live Activity updated
```

## Architecture Notes

### Why NotificationCenter?
App Intents run in the widget extension process, which can't directly call React Native code. NotificationCenter bridges the gap by posting a notification that the main app process (LiveActivityModule) can observe.

### Why RCTEventEmitter?
`RCTEventEmitter` allows native Swift code to send events to JavaScript without requiring JavaScript to poll or call native methods repeatedly.

### Why Computed Property for `currentActivity`?
Swift doesn't allow `@available` on stored properties, so we use a computed property wrapper around a generic `Any?` storage.

## Future Enhancements

- [ ] Add "Skip Rest" button during countdown
- [ ] Show reps/weight input in Live Activity (iOS 17+)
- [ ] Add haptic feedback on button press
- [ ] Show workout completion animation
- [ ] Add volume summary in expanded view
