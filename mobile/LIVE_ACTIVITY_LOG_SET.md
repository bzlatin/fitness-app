# Live Activity "Log Set" Button Integration

## Overview

The Live Activity now includes a "Log Set" button that allows users to log sets directly from the Lock Screen or Dynamic Island without opening the app.

## UI Improvements

### Lock Screen
- **Timer moved to left**: Now shows prominently next to the dumbbell icon
- **Log Set button**: Green button at the bottom (only shows when NOT in rest mode)
- **Better visual hierarchy**: Timer is larger and uses monospaced digits

### How It Works

1. **User taps "Log Set"** in Live Activity
2. **App Intent fires** (`LogSetIntent`)
3. **Notification posted** to `NotificationCenter`
4. **Native module catches it** (`LiveActivityModule`)
5. **Event sent to React Native** (`onLogSetFromLiveActivity`)
6. **Your code handles it** (see example below)

## Usage in WorkoutSessionScreen

Add this to your `WorkoutSessionScreen.tsx`:

```tsx
import { addLogSetListener } from '../services/liveActivity';

// Inside your component
useEffect(() => {
  // Listen for log set button from Live Activity
  const cleanup = addLogSetListener((sessionId) => {
    console.log('User tapped Log Set in Live Activity!', sessionId);

    // Handle the log set action
    // For example, if you have a handleLogSet function:
    if (sessionId === currentSessionId) {
      handleLogSet(); // Your existing log set logic
    }
  });

  return cleanup; // Clean up listener on unmount
}, [currentSessionId, handleLogSet]);
```

## Example Implementation

```tsx
const WorkoutSessionScreen = () => {
  const sessionId = route.params.sessionId;

  const handleLogSet = () => {
    // Your existing logic to log a set
    // This could be called from:
    // 1. The in-app button
    // 2. The Live Activity button (via the listener)
  };

  useEffect(() => {
    const cleanup = addLogSetListener((liveActivitySessionId) => {
      if (liveActivitySessionId === sessionId) {
        handleLogSet();
      }
    });
    return cleanup;
  }, [sessionId, handleLogSet]);

  // Rest of your component...
};
```

## Technical Details

### Files Modified
- `WorkoutLiveActivity.swift` - Added button UI and timer repositioning
- `LogSetIntent.swift` - New App Intent for handling button press
- `LiveActivityModule.swift` - Changed to `RCTEventEmitter`, added notification observer
- `liveActivity.ts` - Added `addLogSetListener` function

### Button Visibility
The "Log Set" button only shows when:
- `restEndTime` is `null` (not in rest mode)
- This prevents accidental logging during rest periods

### Platform Support
- **iOS 16.1+** required (Live Activities)
- **iOS 16.0+** required (App Intents)
- Automatically disabled on Android

## Testing

1. Build and run the app on a physical device (iOS 16.1+)
2. Start a workout
3. Lock the screen or background the app
4. Tap "Log Set" in the Live Activity
5. Check console logs for `"🔵 [LiveActivity] Log set event received"`
6. Verify your app handles the action correctly

## Notes

- The button uses `Button(intent:)` which requires iOS 16+
- The notification bridge pattern allows background execution
- Event listeners are automatically cleaned up when component unmounts
- The timer now uses rounded font and better spacing for readability
