import { AuthGate, Section, Text } from '@/components/ui';
import { AccountSettingsPanel } from '@/components/settings/AccountSettingsPanel';
import { useAuthStore } from '@/store/auth';

export default function InvestmentSettings() {
  const isAuthenticated = useAuthStore((state) => state.status === 'authenticated');
  return (
    <Section>
      <AuthGate isAuthenticated={isAuthenticated} title="Paramètres investisseur" icon="⚙️">
        <div style={{ maxWidth: 720 }}>
          <Text preset="h1" style={{ marginBottom: 24 }}>Paramètres investisseur</Text>
          <AccountSettingsPanel profileRoute="/investment/profile" />
        </div>
      </AuthGate>
    </Section>
  );
}
