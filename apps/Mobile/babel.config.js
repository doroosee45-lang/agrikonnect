module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // Doit rester en dernier : le plugin worklets réécrit les fonctions `worklet`.
      'react-native-worklets/plugin',
    ],
  };
};
