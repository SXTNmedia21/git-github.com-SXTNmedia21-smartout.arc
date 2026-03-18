/**
 * Babel configuration for Smartout mobile app.
 * Adds module-resolver for @/ path alias and reanimated plugin (must be last).
 */
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
    plugins: [
      [
        "module-resolver",
        {
          alias: {
            "@": "./src",
          },
        },
      ],
      "react-native-reanimated/plugin",
    ],
  };
};
