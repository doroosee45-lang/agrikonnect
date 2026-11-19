import { AppHeader } from '@/components/app/AppHeader';
import { PersonalSettings } from '@/components/settings/PersonalSettings';
import { AuthGate, Screen } from '@/components/ui';
import { getUserProfileRoute, resolveActiveContext } from '@/lib/redirects';
import { useAuthStore } from '@/store/auth';
import { COLORS } from '@/theme/colors';

export default function AccountSettings() {
  const isAuthenticated = useAuthStore((state) => state.status === 'authenticated');
  const user = useAuthStore((state) => state.user);
  const profileRoute = getUserProfileRoute(resolveActiveContext(user).roles);
  return (
    <Screen background={COLORS.naturalWhite}>
      <AppHeader title="Paramètres du compte" subtitle="Sécurité, notifications et confidentialité" />
      <AuthGate isAuthenticated={isAuthenticated} title="Paramètres du compte" icon="settings-outline">
        <PersonalSettings profileRoute={profileRoute} />
      </AuthGate>
    </Screen>
  );
}
