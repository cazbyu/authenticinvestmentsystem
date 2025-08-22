module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],   // ✅ new preset
    plugins: [],                      // 👈 remove "expo-router/babel"
  };
};
