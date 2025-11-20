import { ConfigContext, ExpoConfig } from "expo/config";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const process: any;

const callbackScheme = process.env.EXPO_PUBLIC_AUTH0_CALLBACK_SCHEME || "push-pull";

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: config.name ?? "push-pull",
  slug: config.slug ?? "push-pull",
  scheme: callbackScheme,
});
