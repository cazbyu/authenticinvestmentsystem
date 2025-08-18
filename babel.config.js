module.exports = function(api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      [
        'module-resolver',
        {
          alias: {
            // This tells the app that "@" means the root directory
            '@': './',
          },
        },
      ],
    ],
  };
};