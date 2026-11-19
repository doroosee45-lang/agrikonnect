import { AuthGate, Section, Text } from '@/components/ui';
import { AccountSettingsPanel } from '@/components/settings/AccountSettingsPanel';
import { useAuthStore } from '@/store/auth';

export default function FarmerSettings() {
  const isAuthenticated = useAuthStore((state) => state.status === 'authenticated');
  return (
    <Section>
      <AuthGate isAuthenticated={isAuthenticated} title="Paramètres" icon="⚙️">
        <div style={{ maxWidth: 720 }}>
          <Text preset="h1" style={{ marginBottom: 24 }}>Paramètres du compte producteur</Text>
          <AccountSettingsPanel profileRoute="/farmer/profile" />
        </div>
      </AuthGate>
    </Section>
  );
}
