const { getDefaultConfig } = require('expo/metro-config');

/**
 * Configuration Metro.
 *
 * Sans ce fichier, Expo démarre Metro avec une configuration vide : le
 * transformeur n'est jamais instancié et le bundle échoue dès
 * `expo-router/entry.js` (« Cannot read properties of undefined
 * (reading 'transformFile') »). `getDefaultConfig` apporte le résolveur
 * d'Expo (extensions `.web`/`.native`, assets, Babel) et les `watchFolders`
 * nécessaires au alias `@/*` déclaré dans `tsconfig.json`.
 */
const config = getDefaultConfig(__dirname);

module.exports = config;
