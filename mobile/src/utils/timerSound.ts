import { Audio } from 'expo-av';
import * as Haptics from 'expo-haptics';

let audioConfigured = false;

/**
 * Play a satisfying notification when the rest timer completes
 * Combines haptic feedback with audible beep (if not in silent mode)
 */
export const playTimerSound = async () => {
  try {
    // Triple-tap haptic pattern for a satisfying notification feel
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    setTimeout(async () => {
      try {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch (err) {
        // Ignore
      }
    }, 80);

    setTimeout(async () => {
      try {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } catch (err) {
        // Ignore
      }
    }, 160);

    // Play audible notification sound (plays even when ringer is off)
    try {
      if (!audioConfigured) {
        await Audio.setAudioModeAsync({
          playsInSilentModeIOS: true, // Play even when ringer is off
          staysActiveInBackground: true, // Keep playing when app is in background/lock screen
          shouldDuckAndroid: true,
        });
        audioConfigured = true;
      }

      // Play the custom timer completion sound
      const { sound } = await Audio.Sound.createAsync(
        require('../../assets/sounds/timer-complete.mp3'),
        { shouldPlay: true, volume: 0.6 }
      );

      // Auto-cleanup after playing
      setTimeout(() => {
        sound.unloadAsync().catch(() => {});
      }, 2000);
    } catch (audioError) {
      // Silent mode or audio error - haptics already played
      // This is expected in silent mode, so just log silently
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
