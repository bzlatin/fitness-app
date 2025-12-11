# Quick Set Logger Widget - Integration Guide

## Overview

The Quick Set Logger widget allows users to see their current workout progress and log sets directly from the iOS home screen. This guide explains how to integrate the widget sync functionality into the `WorkoutSessionScreen`.

## Architecture

### Data Flow

1. **React Native App** → Syncs active session data via `syncActiveSessionToWidget()`
2. **Native Bridge** → `WidgetSyncModule.swift` writes to App Group UserDefaults
3. **Widget** → `QuickSetLoggerWidget.swift` reads from App Group UserDefaults
4. **User Interaction** → Widget taps deep link to app (`pushpull://workout/log-set`)

### Files Created/Modified

**New Files:**
- `/mobile/ios/Widgets/QuickSetLoggerWidget.swift` - Widget UI and timeline provider
- `/mobile/WIDGET_INTEGRATION_GUIDE.md` - This file

**Modified Files:**
- `/mobile/src/services/widgetSync.ts` - Added active session sync functionality
- `/mobile/ios/pushpull/WidgetSyncModule.swift` - Added active session data keys
- `/mobile/ios/Widgets/WidgetsBundle.swift` - Registered QuickSetLoggerWidget
- `/mobile/App.tsx` - Added `workout/log-set` deep link route

## Integration Steps

### 1. Import the Sync Function

In `WorkoutSessionScreen.tsx`, import the sync function:

```typescript
import { syncActiveSessionToWidget } from "../services/widgetSync";
```

### 2. Sync When Session Starts

When the workout session loads, sync the initial state:

```typescript
// Inside the useQuery success callback or useEffect after session data loads
useEffect(() => {
  if (sessionData && sessionData.sets.length > 0) {
    // Find the first exercise group
    const exerciseGroups = groupSetsByExercise(sessionData.sets, restLookup, sessionRestTimes);

    if (exerciseGroups.length > 0) {
      const firstExercise = exerciseGroups[0];
      const firstSet = firstExercise.sets[0];

      // Sync to widget
      void syncActiveSessionToWidget({
        sessionId: sessionData.id,
        exerciseName: firstExercise.name,
        currentSet: 1,
        totalSets: firstExercise.sets.length,
        targetReps: firstSet.targetReps,
        targetWeight: firstSet.targetWeight,
        startedAt: sessionData.startedAt,
      });
    }
  }
}, [sessionData]);
```

### 3. Sync When User Logs a Set

After a user logs a set (updates reps/weight), sync the widget:

```typescript
const handleLogSet = (setId: string, reps: number, weight: number) => {
  // ... existing set logging logic ...

  // Find which exercise and set number this is
  const exerciseGroups = groupSetsByExercise(sets, restLookup, sessionRestTimes);
  const exerciseGroup = exerciseGroups.find(group =>
    group.sets.some(s => s.id === setId)
  );

  if (exerciseGroup) {
    const setIndex = exerciseGroup.sets.findIndex(s => s.id === setId);
    const nextSet = exerciseGroup.sets[setIndex + 1];

    // Sync the next set (or current if this was the last set)
    void syncActiveSessionToWidget({
      sessionId: sessionId,
      exerciseName: exerciseGroup.name,
      currentSet: Math.min(setIndex + 2, exerciseGroup.sets.length),
      totalSets: exerciseGroup.sets.length,
      lastReps: reps,
      lastWeight: weight,
      targetReps: nextSet?.targetReps,
      targetWeight: nextSet?.targetWeight,
      startedAt: startTime!,
    });
  }
};
```

### 4. Sync When User Changes Exercises

When the user moves to a different exercise (e.g., via drag-and-drop reorder or tapping a different exercise card):

```typescript
const handleExerciseChange = (exerciseKey: string) => {
  setActiveExerciseKey(exerciseKey);

  const exerciseGroups = groupSetsByExercise(sets, restLookup, sessionRestTimes);
  const targetExercise = exerciseGroups.find(g => g.key === exerciseKey);

  if (targetExercise) {
    // Find the next unlogged set in this exercise
    const nextUnloggedSet = targetExercise.sets.find(s => !loggedSetIds.has(s.id));
    const setIndex = nextUnloggedSet
      ? targetExercise.sets.indexOf(nextUnloggedSet) + 1
      : targetExercise.sets.length;

    void syncActiveSessionToWidget({
      sessionId: sessionId,
      exerciseName: targetExercise.name,
      currentSet: setIndex,
      totalSets: targetExercise.sets.length,
      targetReps: nextUnloggedSet?.targetReps,
      targetWeight: nextUnloggedSet?.targetWeight,
      startedAt: startTime!,
    });
  }
};
```

### 5. Clear Widget When Session Ends

When the user completes or cancels the workout, clear the widget:

```typescript
const handleCompleteWorkout = async () => {
  // ... existing completion logic ...

  // Clear the widget
  await syncActiveSessionToWidget(null);

  // Navigate away
  navigation.goBack();
};

const handleCancelWorkout = async () => {
  // ... existing cancel logic ...

  // Clear the widget
  await syncActiveSessionToWidget(null);

  // Navigate away
  navigation.goBack();
};
```

### 6. Handle Deep Link from Widget

When the user taps the widget, the app will deep link to `pushpull://workout/log-set`. The existing deep link configuration will navigate to the Home screen, which should detect the active session and navigate to the WorkoutSessionScreen.

**Optional Enhancement:** Add logic in `HomeScreen` to detect this specific deep link and automatically navigate to the active session:

```typescript
// In HomeScreen.tsx
import { useEffect } from 'react';
import { useNavigationState, useIsFocused } from '@react-navigation/native';

const HomeScreen = () => {
  const isFocused = useIsFocused();
  const navigationState = useNavigationState(state => state);

  useEffect(() => {
    // Check if we arrived via the widget log-set deep link
    const params = navigationState?.routes?.[navigationState.index]?.params;
    if (isFocused && params?.from === 'widget-log-set' && activeSessionId) {
      // Navigate to the active session
      navigation.navigate('WorkoutSession', { sessionId: activeSessionId });
    }
  }, [isFocused, navigationState]);

  // ... rest of component
};
```

## Testing Checklist

### Manual Testing Steps

1. **Start a Workout**
   - [ ] Start a new workout from a template
   - [ ] Exit the app (don't close, just background it)
   - [ ] Go to iOS home screen
   - [ ] Add the "Quick Set Logger" widget
   - [ ] Verify the widget shows the first exercise name, set 1/X, and target reps/weight

2. **Log a Set**
   - [ ] Return to the app
   - [ ] Log reps and weight for the first set
   - [ ] Background the app again
   - [ ] Check the widget on the home screen
   - [ ] Verify it shows set 2/X and displays "Last set: X reps @ X lbs"

3. **Change Exercises**
   - [ ] Return to the app
   - [ ] Scroll to a different exercise
   - [ ] Tap on that exercise card to make it active
   - [ ] Background the app
   - [ ] Check the widget
   - [ ] Verify it shows the new exercise name and correct set count

4. **Complete Workout**
   - [ ] Return to the app
   - [ ] Complete the workout
   - [ ] Check the widget on the home screen
   - [ ] Verify it shows "No Active Workout" state

5. **Widget Tap Action**
   - [ ] Start another workout
   - [ ] Background the app
   - [ ] Tap the widget's "Log Set" button
   - [ ] Verify the app opens and navigates to the workout session

6. **No Active Session**
   - [ ] Without starting a workout, check the widget
   - [ ] Verify it shows "No Active Workout" with instructional text
   - [ ] Verify the widget doesn't crash or show stale data

### Edge Cases to Test

- [ ] App force-closed while workout is active (widget should show last synced state)
- [ ] Multiple sets logged rapidly (widget should update to latest)
- [ ] Workout paused for extended period (widget should still show correct data when resumed)
- [ ] Session started but no sets logged yet (widget should show set 1/X)
- [ ] Bodyweight exercise (no weight - widget should handle null targetWeight)
- [ ] Single-set exercise (widget should show 1/1)

## Performance Considerations

- **Widget Refresh Rate:** The widget automatically refreshes every 30 seconds when a session is active, and every 5 minutes when inactive.
- **Sync Frequency:** Only sync when meaningful state changes occur (not on every render).
- **Deep Link Handling:** Ensure the app gracefully handles the deep link even if the session has ended.

## Troubleshooting

### Widget Shows "No Active Workout" Despite Active Session

**Cause:** Widget sync module not available or sync failed silently.

**Solution:**
1. Check Console for `⚠️ WidgetSyncModule not available` warning
2. Verify App Groups capability is enabled in Xcode
3. Ensure `group.com.pushpull.app` matches in both app and widget targets
4. Rebuild the app with EAS: `eas build --platform ios --profile development --local`

### Widget Shows Stale Data

**Cause:** Widget not refreshing after sync.

**Solution:**
1. Check if `refreshWidgets()` is being called after `syncWidgetData()`
2. Verify WidgetKit is available (iOS 14.0+)
3. Try manually reloading the widget timeline in Xcode debugger

### Deep Link Doesn't Open App

**Cause:** Deep link scheme not registered or misconfigured.

**Solution:**
1. Verify `app.config.ts` includes correct URL schemes
2. Check that App.tsx linking config includes `workout/log-set` route
3. Test deep link in Safari: `pushpull://workout/log-set`
4. Rebuild the app to update URL scheme registration

### Widget Doesn't Update After Set Logged

**Cause:** `syncActiveSessionToWidget()` not called in set logging handler.

**Solution:**
1. Add logging to verify the function is being called: `console.log('Syncing to widget:', sessionData)`
2. Check that the session data is correct before syncing
3. Verify the `syncWidgetData()` call completes without error

## Next Steps

After integration, consider these enhancements:

1. **Smart Auto-Advance:** Automatically advance to the next exercise when all sets are logged
2. **Rest Timer Integration:** Show rest timer countdown in the widget
3. **Live Activities (iOS 16.1+):** Use ActivityKit for Dynamic Island integration
4. **Complications:** Create watch complications for watchOS

## Support

For issues or questions, refer to:
- `/mobile/ios/Widgets/README.md` - Widget setup instructions
- `/ROADMAP.md` - Phase 4.4.5 iOS Widgets section
- Expo Widgets documentation: https://docs.expo.dev/develop/user-interface/widgets/
