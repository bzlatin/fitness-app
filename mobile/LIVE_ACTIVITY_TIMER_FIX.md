# Live Activity Rest Timer Fix

## Issue
The rest timer in the Live Activity was counting up (negative) after expiring instead of disappearing and showing the "Log Set" button.

## Root Cause
1. SwiftUI's `Text(date, style: .timer)` continues counting in negative when the date is in the past
2. The Live Activity wasn't checking if the timer had expired before displaying it
3. React Native wasn't clearing the `restEndTime` in the Live Activity when the timer completed

## Solution

### 1. Fixed Timer Display Logic (Swift)
**File**: `ios/Widgets/WorkoutLiveActivity.swift`

Added expiration check before showing the timer:
```swift
if let restEndTime = context.state.restEndTime, restEndTime > Date() {
    // Show timer only if it's still in the future
} else {
    // Show target reps/weight OR Log Set button
}
```

### 2. Fixed Button Visibility Logic (Swift)
**File**: `ios/Widgets/WorkoutLiveActivity.swift`

Button now shows when:
- No rest timer exists, OR
- Rest timer has expired

```swift
let restActive = context.state.restEndTime.map { $0 > Date() } ?? false
if !restActive {
    // Show "Log Set" button
}
```

### 3. Clear Timer on Expiration (React Native)
**File**: `mobile/src/screens/WorkoutSessionScreen.tsx`

When the rest timer expires in React Native, we now explicitly clear it in the Live Activity:
```tsx
if (remaining <= 0) {
    // ... existing code ...

    // Clear Live Activity rest timer so "Log Set" button appears
    void updateWorkoutLiveActivity({
        restDuration: null as any,
    });
}
```

### 4. Handle Explicit Timer Clearing (Swift)
**File**: `ios/pushpull/LiveActivityModule.swift`

Updated `updateWorkoutActivity` to detect when `restDuration` is explicitly being cleared:
```swift
let shouldClearRestTimer = params.allKeys.contains { ($0 as? String) == "restDuration" }

if shouldClearRestTimer {
    if let duration = restDuration, duration > 0 {
        restEndTime = Date().addingTimeInterval(TimeInterval(duration))
    } else {
        restEndTime = nil // Clear the timer
    }
} else {
    restEndTime = currentState.restEndTime // Keep existing
}
```

## Behavior After Fix

### During Rest Timer
- Timer displays: "Rest" + countdown (e.g., "1:30")
- Button: Hidden
- Last set info: Hidden

### After Timer Expires
- Timer: Disappears
- Target reps/weight: Shows again
- Last set info: Shows again
- Button: "Log Set" appears (green, full width)

### No Rest Timer
- Timer: Not shown
- Target reps/weight: Shows
- Last set info: Shows (if available)
- Button: "Log Set" appears

## Testing
1. Start a workout
2. Log a set with auto-rest enabled
3. Lock screen and observe Live Activity
4. Wait for timer to expire
5. Verify:
   - Timer stops at 0:00 and disappears
   - "Log Set" button appears
   - Target info returns
   - No negative countdown

## Files Modified
- [WorkoutLiveActivity.swift](ios/Widgets/WorkoutLiveActivity.swift) - Timer visibility + button logic
- [LiveActivityModule.swift](ios/pushpull/LiveActivityModule.swift) - Clear timer handling
- [WorkoutSessionScreen.tsx](src/screens/WorkoutSessionScreen.tsx) - Send clear command on expiration
