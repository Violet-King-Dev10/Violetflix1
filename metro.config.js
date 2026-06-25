const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Speed optimizations
config.cacheVersion = 'violetflixtv-v1';
config.cacheStores = [];

// Only bundle what's needed for web
config.resolver.platforms = ['web', 'ios', 'android', 'native'];
config.resolver.sourceExts = ['web.tsx', 'web.ts', 'web.js', 'tsx', 'ts', 'jsx', 'js', 'json', 'mjs', 'cjs'];
config.resolver.assetExts = [
  ...config.resolver.assetExts.filter(ext => ext !== 'svg'),
  'svg', 'png', 'jpg', 'jpeg', 'gif', 'webp', 'ttf', 'otf', 'woff', 'woff2',
];

// Stub heavy native-only modules so Metro doesn't try to bundle them
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const stubs = {
    'react-native-webview': path.resolve(__dirname, 'stubs/webview.web.js'),
    '@react-native-community/netinfo': path.resolve(__dirname, 'stubs/netinfo.web.js'),
  };
  if (platform === 'web' && stubs[moduleName]) {
    return { filePath: stubs[moduleName], type: 'sourceFile' };
  }
  return context.resolveRequest(context, moduleName, platform);
};

// Exclude native-only transformer overhead
config.transformer = {
  ...config.transformer,
  minifierPath: 'metro-minify-terser',
  minifierConfig: {
    compress: { drop_console: false, passes: 1 },
    mangle: true,
  },
};

module.exports = config;
