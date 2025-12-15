import AsyncStorage from "@react-native-async-storage/async-storage";

const SHOW_WARMUP_SETS_KEY = "push-pull.show-warmup-sets";

export const getStoredShowWarmupSets = async () => {
  try {
    const raw = await AsyncStorage.getItem(SHOW_WARMUP_SETS_KEY);
    if (raw === null) return true;
    return raw === "1";
  } catch {
    return true;
  }
};

export const setStoredShowWarmupSets = async (value: boolean) => {
  try {
    await AsyncStorage.setItem(SHOW_WARMUP_SETS_KEY, value ? "1" : "0");
  } catch {
    // ignore
  }
};

