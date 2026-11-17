import { Tabs } from 'expo-router';

import { FarmerTabBar, type TabBarProps } from '@/components/farmer/FarmerTabBar';
import { COLORS } from '@/theme/colors';

/**
 * Espace producteur : cinq onglets.
 * Les onglets suivent l'ordre de travail réel — pilotage, exploitations,
 * parcelles, productions, sols.
 *
 * Ce navigateur ne contient QUE ces cinq écrans. Dans Expo Router 58, un écran
 * non déclaré (ou déclaré avec `href: null`) dans des onglets est aussitôt
 * redirigé vers le premier onglet : les formulaires et écrans de détail vivent
 * donc dans la pile parente (`farmer/_layout.tsx`).
 */
export default function FarmerTabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <FarmerTabBar {...(props as unknown as TabBarProps)} />}
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: COLORS.naturalWhite },
      }}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="farms" />
      <Tabs.Screen name="plots" />
      <Tabs.Screen name="productions" />
      <Tabs.Screen name="soil" />
    </Tabs>
  );
}
