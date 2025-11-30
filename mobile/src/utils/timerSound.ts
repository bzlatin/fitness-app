import { Audio } from 'expo-audio';
import * as Haptics from 'expo-haptics';

/**
 * Play a satisfying notification when the rest timer completes
 * Combines haptic feedback with a brief sound (respects silent mode)
 */
export const playTimerSound = async () => {
  try {
    // Always provide haptic feedback (works even in silent mode)
    // Use impactAsync instead of notificationAsync for better compatibility
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    // Quick second vibration for notification feel
    setTimeout(async () => {
      try {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch (err) {
        // Ignore errors on second haptic
      }
    }, 100);

    // Play a simple beep sound using expo-audio (respects silent mode)
    // Create audio player with a short beep
    const sound = await Audio.Sound.createAsync(
      // Use a built-in system sound or generate a simple tone
      { uri: 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=' },
      { shouldPlay: true, volume: 0.5 },
      null,
      false // Don't play in silent mode
    );

    // Auto-cleanup after playing
    if (sound.sound) {
      setTimeout(() => {
        sound.sound.unloadAsync().catch(() => {});
      }, 1000);
    }
  } catch (error) {
    console.error('Error playing timer notification:', error);
    // Fallback to just haptics if sound fails
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    } catch (hapticError) {
      console.error('Error with haptic feedback:', hapticError);
    }
  }
};

/**
 * Unload sounds (cleanup function - may not be needed with new implementation)
 */
export const unloadTimerSound = async () => {
  // No-op with new implementation since we auto-cleanup
};
