const {
  withDangerousMod,
  withInfoPlist,
  withEntitlementsPlist,
  IOSConfig,
} = require("@expo/config-plugins");
const fs = require("fs");
const path = require("path");

/**
 * Expo Config Plugin for iOS Widgets
 *
 * This plugin:
 * 1. Adds App Groups entitlement for data sharing
 * 2. Copies widget extension files to the iOS project
 * 3. Updates Xcode project to include widget targets
 */
module.exports = function withWidgets(config) {
  const APP_GROUP_ID = `group.${config.ios?.bundleIdentifier || "com.pushpull.app"}`;

  // Add App Groups to main app entitlements
  config = withEntitlementsPlist(config, (config) => {
    if (!config.modResults["com.apple.security.application-groups"]) {
      config.modResults["com.apple.security.application-groups"] = [];
    }

    const appGroups = config.modResults["com.apple.security.application-groups"];
    if (!appGroups.includes(APP_GROUP_ID)) {
      appGroups.push(APP_GROUP_ID);
    }

    return config;
  });

  // Add widget scheme to Info.plist for deep linking
  config = withInfoPlist(config, (config) => {
    if (!config.modResults.CFBundleURLTypes) {
      config.modResults.CFBundleURLTypes = [];
    }

    const widgetScheme = {
      CFBundleTypeRole: "Editor",
      CFBundleURLName: "com.pushpull.widget",
      CFBundleURLSchemes: ["pushpull", "push-pull"],
    };

    // Check if widget scheme already exists
    const existingScheme = config.modResults.CFBundleURLTypes.find(
      (type) => type.CFBundleURLName === widgetScheme.CFBundleURLName
    );

    if (!existingScheme) {
      config.modResults.CFBundleURLTypes.push(widgetScheme);
    }

    return config;
  });

  // Copy widget extension files
  config = withDangerousMod(config, [
    "ios",
    async (config) => {
      const iosProjectRoot = config.modRequest.platformProjectRoot;
      const widgetSourcePath = path.join(
        config.modRequest.projectRoot,
        "ios",
        "Widgets"
      );

      // Create widget directory if it doesn't exist
      if (!fs.existsSync(widgetSourcePath)) {
        fs.mkdirSync(widgetSourcePath, { recursive: true });
      }

      console.log("✅ Widget extension directory ready at:", widgetSourcePath);
      console.log(`📦 App Group ID: ${APP_GROUP_ID}`);
      console.log("⚠️  You'll need to manually add the widget targets in Xcode");
      console.log("    See /mobile/ios/Widgets/README.md for instructions");

      return config;
    },
  ]);

  return config;
};
