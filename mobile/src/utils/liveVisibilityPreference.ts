import AsyncStorage from '@react-native-async-storage/async-storage';
import { Visibility } from '../types/social';

const STORAGE_KEY = 'workout:liveVisibility';

const isVisibility = (value: string): value is Visibility =>
  value === 'private' || value === 'followers' || value === 'squad';

export const getStoredLiveVisibility = async (): Promise<Visibility | null> => {
  try {
    const value = await AsyncStorage.getItem(STORAGE_KEY);
    if (!value) return null;
    return isVisibility(value) ? value : null;
  } catch {
    return null;
  }
};

export const setStoredLiveVisibility = async (
  visibility: Visibility
): Promise<void> => {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, visibility);
  } catch {
    // Ignore preference persistence failures
  }
};

