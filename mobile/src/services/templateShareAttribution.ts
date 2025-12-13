import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'templateShareCode:v1';

export const loadTemplateShareCode = async () => {
  try {
    const value = await AsyncStorage.getItem(STORAGE_KEY);
    if (!value) return null;
    const normalized = value.toLowerCase().trim();
    if (!/^[0-9a-z]{8}$/.test(normalized)) return null;
    return normalized;
  } catch {
    return null;
  }
};

export const saveTemplateShareCode = async (shareCode: string) => {
  const normalized = shareCode.toLowerCase().trim();
  if (!/^[0-9a-z]{8}$/.test(normalized)) return;
  try {
    await AsyncStorage.setItem(STORAGE_KEY, normalized);
  } catch {
    // ignore
  }
};

export const clearTemplateShareCode = async () => {
  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
};

