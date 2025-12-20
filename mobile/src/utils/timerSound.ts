import { Audio, InterruptionModeAndroid, InterruptionModeIOS } from 'expo-av';
import * as Haptics from 'expo-haptics';
import { NativeModules, Platform } from 'react-native';

let restoreAudioModeTimeout: ReturnType<typeof setTimeout> | null = null;

const baseAudioMode: Audio.AudioMode = {
  allowsRecordingIOS: false,
  interruptionModeIOS: InterruptionModeIOS.MixWithOthers,
  playsInSilentModeIOS: false,
  staysActiveInBackground: false,
  interruptionModeAndroid: InterruptionModeAndroid.DuckOthers,
  shouldDuckAndroid: true,
  playThroughEarpieceAndroid: false,
};

const timerAudioMode: Partial<Audio.AudioMode> = {
  playsInSilentModeIOS: true, // Play even when ringer is off
  staysActiveInBackground: true, // Keep playing when app is in background/lock screen
  shouldDuckAndroid: true, // Lower other audio volume on Android
  interruptionModeIOS: InterruptionModeIOS.DuckOthers, // Lower music volume when chime plays
};

const restoreAudioMode = async () => {
  try {
    await Audio.setAudioModeAsync(baseAudioMode);
  } catch {
    // ignore
  }
};
const { LiveActivityModule } = NativeModules as {
  LiveActivityModule?: {
    scheduleTimerCompleteSound?: (
      sessionId: string,
      timestampMs: number
    ) => Promise<boolean>;
    cancelScheduledTimerSound?: () => void;
    playTimerCompleteSoundNow?: () => Promise<boolean>;
  };
};

export const scheduleRestTimerFinishSound = async (
  sessionId: string,
  endsAtMs: number
): Promise<boolean> => {
  if (Platform.OS !== 'ios') return false;
  if (!LiveActivityModule?.scheduleTimerCompleteSound) return false;

  try {
    const scheduled = await LiveActivityModule.scheduleTimerCompleteSound(
      sessionId,
      endsAtMs
    );
    return Boolean(scheduled);
  } catch (error) {
    return false;
  }
};

export const cancelScheduledRestTimerFinishSound = async () => {
  if (Platform.OS !== 'ios') return;
  if (!LiveActivityModule?.cancelScheduledTimerSound) return;

  try {
    LiveActivityModule.cancelScheduledTimerSound();
  } catch {
    // ignore
  }
};

export const playTimerHaptics = async () => {
  try {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    setTimeout(async () => {
      try {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch {
        // ignore
      }
    }, 80);

    setTimeout(async () => {
      try {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } catch {
        // ignore
      }
    }, 160);
  } catch {
    // ignore
  }
};

/**
 * Play a satisfying notification when the rest timer completes
 * Combines haptic feedback with audible beep (if not in silent mode)
 */
export const playTimerSound = async () => {
  try {
    await playTimerHaptics();

    // Play audible notification sound (plays even when ringer is off)
    try {
      if (Platform.OS === 'ios' && LiveActivityModule?.playTimerCompleteSoundNow) {
        const played = await LiveActivityModule.playTimerCompleteSoundNow();
        if (played) {
          return;
        }
      }

      await Audio.setAudioModeAsync(timerAudioMode);

      // Play the custom timer completion sound
      const { sound } = await Audio.Sound.createAsync(
        require('../../assets/sounds/timer-complete.mp3'),
        { shouldPlay: true, volume: 0.6 }
      );

      if (restoreAudioModeTimeout) {
        clearTimeout(restoreAudioModeTimeout);
        restoreAudioModeTimeout = null;
      }

      sound.setOnPlaybackStatusUpdate((status) => {
        if (!status.isLoaded) return;
        if (!status.didJustFinish) return;
        sound.setOnPlaybackStatusUpdate(null);
        sound.unloadAsync().catch(() => {});
        void restoreAudioMode();
      });

      // Fallback cleanup in case playback status doesn't fire
      restoreAudioModeTimeout = setTimeout(() => {
        sound.unloadAsync().catch(() => {});
        void restoreAudioMode();
      }, 2500);
    } catch (audioError) {
      // Silent mode or audio error - haptics already played
      // This is expected in silent mode, so just log silently
      void restoreAudioMode();
    }
  } catch (error) {
    console.error('Error playing timer notification:', error);
  }
};

/**
 * Unload sounds (cleanup function)
 */
export const unloadTimerSound = async () => {
  // Sounds auto-cleanup with timeout
};
