module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      [
        'module-resolver',
        {
          alias: {
            '@': __dirname,
          },
          extensions: ['.js', '.jsx', '.ts', '.tsx'],
        },
      ],
      // This plugin MUST be listed last.
      'react-native-reanimated/plugin'
    ],
  };
};
