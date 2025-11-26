import { ConfigContext, ExpoConfig } from "expo/config";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const process: any;

const callbackScheme = process.env.EXPO_PUBLIC_AUTH0_CALLBACK_SCHEME || "push-pull";
const iosBundleId = process.env.EXPO_PUBLIC_IOS_BUNDLE_ID || "com.pushpull.app";
const androidPackage = process.env.EXPO_PUBLIC_ANDROID_PACKAGE || "com.pushpull.app";

export default ({ config }: ConfigContext): ExpoConfig => {
  const iosConfig: ExpoConfig["ios"] & { storeKitConfiguration?: string } = {
    ...config.ios,
    bundleIdentifier: iosBundleId,
    supportsTablet: true,
    buildNumber: config.ios?.buildNumber ?? "1.0.0",
    storeKitConfiguration: "./ios/StoreKit/Configuration.storekit",
    infoPlist: {
      ...config.ios?.infoPlist,
      ITSAppUsesNonExemptEncryption: false,
    },
  };

  return {
    ...config,
    name: config.name ?? "push-pull",
    slug: config.slug ?? "push-pull",
    scheme: callbackScheme,
    ios: iosConfig,
    android: {
      ...config.android,
      package: androidPackage,
    },
    extra: {
      ...config.extra,
      eas: {
        // Required by EAS for project linking
        projectId: "f1c3583d-410a-4715-b4ce-6fc6386ba345",
      },
    },
    plugins: [...(config.plugins ?? []), "react-native-iap"],
  };
};
