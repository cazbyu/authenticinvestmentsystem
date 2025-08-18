module.exports = function(api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      [
        'module-resolver',
        {
          alias: {
            '@': '.',
          },
          extensions: ['.js', '.jsx', '.ts', '.tsx'],
        },
      ],
      // Make sure other plugins are listed here if you have any
    ],
  };
};