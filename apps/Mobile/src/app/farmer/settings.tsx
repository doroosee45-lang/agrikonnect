import { FarmerHeader } from '@/components/farmer/FarmerHeader';
import { PersonalSettings } from '@/components/settings/PersonalSettings';
import { AuthGate, Screen } from '@/components/ui';
import { useI18n } from '@/i18n';
import { useAuthStore } from '@/store/auth';
import { COLORS } from '@/theme/colors';

export default function FarmerSettings() {
  const { t } = useI18n();
  const isAuthenticated = useAuthStore((state) => state.status === 'authenticated');

  return (
    <Screen background={COLORS.naturalWhite}>
      <FarmerHeader title={t('ui.parametres_ef8f0')} subtitle={t('ui.preferencesDeVotreCompte')} />
      <AuthGate isAuthenticated={isAuthenticated} title={t('ui.parametres_ef8f0')} icon="settings-outline">
        <PersonalSettings profileRoute="/farmer/profile" />
      </AuthGate>
    </Screen>
  );
}
