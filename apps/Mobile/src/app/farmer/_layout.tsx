import { Tabs } from 'expo-router';

import { FarmerTabBar, type TabBarProps } from '@/components/farmer/FarmerTabBar';
import { COLORS } from '@/theme/colors';

/**
 * Espace producteur : cinq onglets.
 * Les onglets suivent l'ordre de travail réel — pilotage, exploitations,
 * parcelles, productions, sols.
 */
export default function FarmerLayout() {
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
      <Tabs.Screen name="plots/[id]" options={{ href: null }} />
    </Tabs>
  );
}
