import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert, Linking, Platform } from 'react-native';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const process: any;

const LOGGED_WORKOUT_COUNT_KEY = 'rating_prompt:logged_workout_count';
const HAS_PROMPTED_KEY = 'rating_prompt:has_prompted';

const getAndroidStoreUrl = () => {
  const pkg =
    process.env.EXPO_PUBLIC_ANDROID_PACKAGE ||
    process.env.EXPO_PUBLIC_ANDROID_APPLICATION_ID ||
    'com.pushpull.app';
  return `market://details?id=${pkg}`;
};

const getIosStoreUrl = () => {
  const appId =
    process.env.EXPO_PUBLIC_IOS_APP_STORE_ID ||
    process.env.EXPO_PUBLIC_APP_STORE_ID ||
    process.env.EXPO_PUBLIC_APPLE_APP_ID;
  if (!appId) return null;
  return `itms-apps://apps.apple.com/app/id${appId}?action=write-review`;
};

const tryOpenUrl = async (url: string) => {
  const supported = await Linking.canOpenURL(url);
  if (supported) {
    await Linking.openURL(url);
    return;
  }

  if (url.startsWith('market://')) {
    const pkgMatch = url.match(/id=([^&]+)/);
    const pkg = pkgMatch?.[1];
    if (pkg) {
      await Linking.openURL(`https://play.google.com/store/apps/details?id=${pkg}`);
    }
  }
};

export const maybePromptForRatingAfterLoggedWorkout = async (params?: {
  threshold?: number;
}) => {
  const threshold = params?.threshold ?? 3;
  if (threshold <= 0) return;
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') return;

  const [rawCount, hasPrompted] = await Promise.all([
    AsyncStorage.getItem(LOGGED_WORKOUT_COUNT_KEY),
    AsyncStorage.getItem(HAS_PROMPTED_KEY),
  ]);

  const current = rawCount ? Number.parseInt(rawCount, 10) : 0;
  const next = Number.isFinite(current) ? current + 1 : 1;

  await AsyncStorage.setItem(LOGGED_WORKOUT_COUNT_KEY, String(next));

  if (hasPrompted === '1') return;
  if (next < threshold) return;

  const storeUrl = Platform.OS === 'ios' ? getIosStoreUrl() : getAndroidStoreUrl();
  if (!storeUrl) return;

  await AsyncStorage.setItem(HAS_PROMPTED_KEY, '1');

  Alert.alert(
    'Enjoying Push/Pull?',
    'If the app is helping you stay consistent, a quick rating helps a ton.',
    [
      { text: 'Not now', style: 'cancel' },
      {
        text: 'Rate the app',
        onPress: () => {
          void tryOpenUrl(storeUrl);
        },
      },
    ]
  );
};
