const { ensureLogo } = require('./scripts/generate-logo');

// Generate logo at config time - safe for Vercel since we catch errors
try {
  ensureLogo();
} catch (e) {
  // Logo already exists or write failed - continue anyway
}

const logoPath = './assets/generated/violetflixtv-logo.png';

module.exports = ({ config }) => ({
  ...config,
  icon: logoPath,
  android: {
    ...config.android,
    adaptiveIcon: {
      ...config.android?.adaptiveIcon,
      foregroundImage: logoPath,
    },
  },
  web: {
    ...config.web,
    favicon: logoPath,
  },
  plugins: config.plugins?.map((plugin) => {
    if (Array.isArray(plugin) && plugin[0] === 'expo-splash-screen') {
      return [
        plugin[0],
        {
          ...plugin[1],
          image: logoPath,
        },
      ];
    }
    return plugin;
  }),
});
