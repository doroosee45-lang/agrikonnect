import { AccountSettingsPanel } from '@/components/settings/AccountSettingsPanel';
import { AuthGate, Section, Text } from '@/components/ui';
import { useAuthStore } from '@/store/auth';

export default function ProfessionalSettings() {
  const isAuthenticated = useAuthStore((state) => state.status === 'authenticated');
  return (
    <Section>
      <AuthGate isAuthenticated={isAuthenticated} title="Paramètres professionnels" icon="⚙️">
        <div style={{ maxWidth: 720 }}>
          <Text preset="h1" style={{ marginBottom: 24 }}>Paramètres professionnels</Text>
          <AccountSettingsPanel profileRoute="/professional/profile" />
        </div>
      </AuthGate>
    </Section>
  );
}
