import { ConfigContext, ExpoConfig } from "expo/config";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const process: any;

const callbackScheme = process.env.EXPO_PUBLIC_AUTH0_CALLBACK_SCHEME || "push-pull";
const iosBundleId = process.env.EXPO_PUBLIC_IOS_BUNDLE_ID || "com.pushpull.app";

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: config.name ?? "push-pull",
  slug: config.slug ?? "push-pull",
  scheme: callbackScheme,
  ios: {
    ...config.ios,
    bundleIdentifier: iosBundleId,
    supportsTablet: true,
    buildNumber: config.ios?.buildNumber ?? "1.0.0",
    storeKitConfiguration: "./ios/StoreKit/Configuration.storekit",
    infoPlist: {
      ...config.ios?.infoPlist,
      ITSAppUsesNonExemptEncryption: false,
    },
  },
  plugins: [...(config.plugins ?? []), "react-native-iap"],
});
