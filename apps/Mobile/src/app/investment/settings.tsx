import { AppHeader } from '@/components/app/AppHeader';
import { PersonalSettings } from '@/components/settings/PersonalSettings';
import { AuthGate, Screen } from '@/components/ui';
import { useAuthStore } from '@/store/auth';
import { COLORS } from '@/theme/colors';

export default function InvestmentSettings() {
  const isAuthenticated = useAuthStore((state) => state.status === 'authenticated');
  return (
    <Screen background={COLORS.naturalWhite}>
      <AppHeader title="Paramètres investisseur" subtitle="Compte, sécurité et confidentialité" />
      <AuthGate isAuthenticated={isAuthenticated} title="Paramètres investisseur" icon="settings-outline">
        <PersonalSettings profileRoute="/investment/profile" />
      </AuthGate>
    </Screen>
  );
}
