import { AppHeader } from '@/components/app/AppHeader';
import { PersonalSettings } from '@/components/settings/PersonalSettings';
import { AuthGate, Screen } from '@/components/ui';
import { useAuthStore } from '@/store/auth';
import { COLORS } from '@/theme/colors';

export default function ProfessionalSettings() {
  const isAuthenticated = useAuthStore((state) => state.status === 'authenticated');
  return (
    <Screen background={COLORS.naturalWhite}>
      <AppHeader title="Paramètres professionnels" subtitle="Compte, sécurité et confidentialité" />
      <AuthGate isAuthenticated={isAuthenticated} title="Paramètres professionnels" icon="settings-outline">
        <PersonalSettings profileRoute="/professional/profile" />
      </AuthGate>
    </Screen>
  );
}
