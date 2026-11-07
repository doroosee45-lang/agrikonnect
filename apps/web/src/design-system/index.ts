/**
 * design-system AGRIKONNECT AFRICA (kit v1.0).
 *
 * Composants Tailwind/shadcn pour le NEUF uniquement ; les ecrans existants
 * gardent les styles inline + jetons. Chaque composant livre ici est adopte
 * dans au moins un ecran reel.
 */
export { ChartCard } from './components/ChartCard';
export type { ChartCardProps } from './components/ChartCard';
export { StatCard } from './components/StatCard';
export type { StatCardProps, StatTendance } from './components/StatCard';
export { cn } from './lib/utils';
export { useBreakpoint } from './hooks/useBreakpoint';
export type { Breakpoint } from './hooks/useBreakpoint';
export { Sidebar } from './components/Sidebar';
export type { SidebarGroup, SidebarItem, SidebarProps } from './components/Sidebar';
