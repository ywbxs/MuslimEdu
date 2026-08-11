const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * Only used when Metro is run against this repo directly (local/Codespace
 * development). The CI workflows scaffold their own project and use the
 * template's copy of this file - see index.js for the full note.
 *
 * @type {import('metro-config').MetroConfig}
 */
const config = {};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
