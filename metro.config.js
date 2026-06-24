const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Ensure web platform is fully supported
config.resolver.platforms = ['web', 'ios', 'android', 'native'];

// Fix for packages that ship TypeScript source instead of compiled JS
config.resolver.sourceExts = [
  ...config.resolver.sourceExts,
  'mjs', 'cjs'
];

// Exclude native-only modules from web bundle
config.resolver.resolverMainFields = ['react-native', 'browser', 'main'];

module.exports = config;
