import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * Configuration Expo = app.json + options natives des APPELS AUDIO.
 *
 * Désactivé par défaut : sans `EXPO_PUBLIC_NATIVE_CALLS=true` au moment du
 * build, la configuration est exactement celle d'app.json (Expo Go reste
 * utilisable). Avec le drapeau, on ajoute les plugins natifs : WebRTC/LiveKit,
 * CallKit/ConnectionService, Firebase Messaging, et les permissions requises.
 * Cela exige un build de développement EAS (pas Expo Go).
 *
 * Aucun secret ici. Les fichiers Firebase (google-services.json,
 * GoogleService-Info.plist) sont fournis au build par EAS (variables de type
 * fichier GOOGLE_SERVICES_JSON / GOOGLE_SERVICES_PLIST) et ne sont jamais
 * versionnés.
 */
export default ({ config }: ConfigContext): ExpoConfig => {
  const base = config as ExpoConfig;
  if (process.env.EXPO_PUBLIC_NATIVE_CALLS !== 'true') return base;

  const micro = 'AgriKonnect utilise le micro uniquement pendant les appels audio que vous passez ou acceptez.';
  const permissionsAndroid = [
    'android.permission.RECORD_AUDIO',
    'android.permission.MODIFY_AUDIO_SETTINGS',
    'android.permission.BLUETOOTH_CONNECT',
    'android.permission.POST_NOTIFICATIONS',
    'android.permission.USE_FULL_SCREEN_INTENT',
    'android.permission.FOREGROUND_SERVICE',
    'android.permission.FOREGROUND_SERVICE_MICROPHONE',
    'android.permission.FOREGROUND_SERVICE_PHONE_CALL',
    'android.permission.MANAGE_OWN_CALLS',
    'android.permission.READ_PHONE_STATE',
    'android.permission.CALL_PHONE',
    'android.permission.WAKE_LOCK',
  ];

  return {
    ...base,
    ios: {
      ...base.ios,
      googleServicesFile: process.env.GOOGLE_SERVICES_PLIST,
      entitlements: {
        ...(base.ios?.entitlements ?? {}),
        'aps-environment': process.env.APNS_ENVIRONMENT === 'production' ? 'production' : 'development',
      },
      infoPlist: {
        ...(base.ios?.infoPlist ?? {}),
        NSMicrophoneUsageDescription: micro,
        UIBackgroundModes: ['audio', 'voip', 'remote-notification'],
      },
    },
    android: {
      ...base.android,
      googleServicesFile: process.env.GOOGLE_SERVICES_JSON,
      permissions: Array.from(new Set([...(base.android?.permissions ?? []), ...permissionsAndroid])),
    },
    plugins: [
      ...(base.plugins ?? []),
      'expo-dev-client',
      '@livekit/react-native-expo-plugin',
      ['@config-plugins/react-native-webrtc', { microphonePermission: micro }],
      '@config-plugins/react-native-callkeep',
      '@react-native-firebase/app',
      '@react-native-firebase/messaging',
    ],
  };
};
