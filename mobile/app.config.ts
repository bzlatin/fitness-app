import { ConfigContext, ExpoConfig } from "expo/config";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const process: any;

const callbackScheme =
  process.env.EXPO_PUBLIC_AUTH0_CALLBACK_SCHEME || "push-pull";
const iosBundleId = process.env.EXPO_PUBLIC_IOS_BUNDLE_ID || "com.pushpull.app";
const androidPackage =
  process.env.EXPO_PUBLIC_ANDROID_PACKAGE || "com.pushpull.app";
const appleTeamId =
  process.env.EXPO_APPLE_TEAM_ID ??
  process.env.EXPO_APPLE_DEVELOPER_TEAM_ID ??
  process.env.EXPO_PUBLIC_APPLE_TEAM_ID ??
  null;

export default ({ config }: ConfigContext): ExpoConfig => {
  const iosConfig: ExpoConfig["ios"] & {
    storeKitConfiguration?: string;
    teamId?: string;
  } = {
    ...config.ios,
    bundleIdentifier: iosBundleId,
    teamId: appleTeamId ?? undefined,
    supportsTablet: true,
    buildNumber: config.ios?.buildNumber ?? "1.0.0",
    storeKitConfiguration: "./ios/StoreKit/Configuration.storekit",
    infoPlist: {
      ...config.ios?.infoPlist,
      ITSAppUsesNonExemptEncryption: false,
      ReactNativeReleaseLevel: "canary",
      NSHealthShareUsageDescription:
        "Allow Push/Pull to read your Apple Health workouts, calories, and heart rate to keep your streak accurate.",
      NSHealthUpdateUsageDescription:
        "Push/Pull writes workout metadata to your history so you can track progress alongside Apple Health.",
    },
    entitlements: {
      ...(config.ios?.entitlements ?? {}),
      "com.apple.developer.healthkit": true,
      "com.apple.developer.healthkit.background-delivery": true,
    },
    associatedDomains: ["applinks:push-pull.app"],
  };

  return {
    ...config,
    name: config.name ?? "push-pull",
    slug: config.slug ?? "push-pull",
    scheme: callbackScheme,
    icon: "./assets/icon.png",
    splash: {
      image: "./assets/icon.png",
      resizeMode: "contain",
      backgroundColor: "#050816",
    },
    backgroundColor: "#050816",
    ios: iosConfig,
    android: {
      ...config.android,
      package: androidPackage,
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#050816",
      },
      intentFilters: [
        ...(config.android?.intentFilters ?? []),
        {
          action: "VIEW",
          autoVerify: true,
          data: [
            {
              scheme: "https",
              host: "push-pull.app",
              pathPrefix: "/workout",
            },
            {
              scheme: "https",
              host: "push-pull.app",
              pathPrefix: "/squad",
            },
          ],
          category: ["BROWSABLE", "DEFAULT"],
        },
      ],
    },
    extra: {
      ...config.extra,
      eas: {
        // Required by EAS for project linking
        projectId: "f1c3583d-410a-4715-b4ce-6fc6386ba345",
      },
    },
    plugins: [
      ...(config.plugins ?? []),
      "react-native-iap",
      "./plugins/withWidgets",
    ],
  };
};
