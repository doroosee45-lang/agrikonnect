import { Stack } from 'expo-router';

import { COLORS } from '@/theme/colors';

/** Pile d'authentification : présentation modale, en-têtes masqués. */
export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: COLORS.naturalWhite },
        animation: 'slide_from_bottom',
      }}
    />
  );
}
