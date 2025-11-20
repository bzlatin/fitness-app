module.exports = function (api) {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
    // Reanimated plugin must be listed last. Add other plugins above if needed.
    plugins: ["react-native-reanimated/plugin"],
  };
};
