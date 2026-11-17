import { Stack } from 'expo-router';

import { COLORS } from '@/theme/colors';

/**
 * Espace producteur : une PILE qui contient
 * - le groupe `(tabs)` : les cinq onglets (accueil, exploitations, parcelles,
 *   productions, sols) ;
 * - tous les autres écrans (création, détail, alertes, lots, commandes,
 *   réglages…), empilés au-dessus des onglets avec retour arrière.
 *
 * Avant, tout était dans le navigateur à onglets : Expo Router 58 y redirige
 * vers le premier onglet tout écran non déclaré, si bien que « Nouvelle
 * exploitation », « Nouvelle parcelle » et une quarantaine d'écrans étaient
 * inaccessibles. Les adresses ne changent pas : `(tabs)` n'apparaît pas dans l'URL.
 */
export default function FarmerLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: COLORS.naturalWhite },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="(tabs)" />
    </Stack>
  );
}
