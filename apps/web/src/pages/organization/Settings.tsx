import { useState, useEffect } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';

import { AuthGate, Button, Card, ErrorState, Input, LoadingState, Section, Text } from '@/components/ui';
import { AccountSettingsPanel } from '@/components/settings/AccountSettingsPanel';
import { authApi, organizationApi } from '@/services/endpoints';
import { queryKeys } from '@/services/query';
import { useAuthStore } from '@/store/auth';

export default function OrganizationSettings() {
  const params = useParams();
  const isAuthenticated = useAuthStore((state) => state.status === 'authenticated');
  const canWrite = useAuthStore((state) => state.can('organizations.write'));
  const me = useQuery({
    queryKey: queryKeys.me,
    queryFn: () => authApi.me().then((result) => result.data),
    enabled: isAuthenticated,
  });
  const organizationId = params.id ?? me.data?.activeOrganizationId ?? me.data?.user.organizations[0]?.id ?? null;
  const organization = useQuery({
    queryKey: queryKeys.organizations.one(organizationId ?? ''),
    queryFn: () => organizationApi.get(organizationId!).then((result) => result.data),
    enabled: Boolean(organizationId),
  });
  const [defaultLocale, setDefaultLocale] = useState<'fr' | 'en'>('fr');
  const [publicProfile, setPublicProfile] = useState(false);
  const [memberInvitesAllowed, setMemberInvitesAllowed] = useState(false);

  useEffect(() => {
    if (!organization.data) return;
    setDefaultLocale(organization.data.settings?.defaultLocale ?? 'fr');
    setPublicProfile(organization.data.settings?.publicProfile ?? false);
    setMemberInvitesAllowed(organization.data.settings?.memberInvitesAllowed ?? false);
  }, [organization.data]);

  const save = useMutation({
    mutationFn: () =>
      organizationApi.update(organizationId!, {
        settings: { defaultLocale, publicProfile, memberInvitesAllowed },
      }),
    onSuccess: () => void organization.refetch(),
  });

  return (
    <Section>
      <AuthGate isAuthenticated={isAuthenticated} title="Paramètres de l’organisation" icon="⚙️">
        <div style={{ maxWidth: 760, display: 'grid', gap: 24 }}>
          <Text preset="h1">Paramètres de l’organisation</Text>
          {organization.isLoading ? (
            <LoadingState count={1} height={120} />
          ) : organization.isError ? (
            <ErrorState error={organization.error} onRetry={() => void organization.refetch()} />
          ) : (
            <Card tone="white">
              <Text preset="h3" style={{ marginBottom: 16 }}>Préférences collectives</Text>
              <div style={{ display: 'grid', gap: 12 }}>
                <Input
                  label="Langue par défaut"
                  value={defaultLocale}
                  onChange={(event) => setDefaultLocale(event.target.value === 'en' ? 'en' : 'fr')}
                  disabled={!canWrite}
                />
                <label style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <input type="checkbox" checked={publicProfile} disabled={!canWrite} onChange={(event) => setPublicProfile(event.target.checked)} />
                  Profil public autorisé
                </label>
                <label style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <input type="checkbox" checked={memberInvitesAllowed} disabled={!canWrite} onChange={(event) => setMemberInvitesAllowed(event.target.checked)} />
                  Invitations de membres autorisées
                </label>
                {canWrite ? (
                  <Button label="Enregistrer les paramètres de l’organisation" loading={save.isPending} onClick={() => save.mutate()} />
                ) : (
                  <Text preset="caption">Lecture seule : votre rôle ne permet pas de modifier les paramètres collectifs.</Text>
                )}
                {save.error ? <ErrorState error={save.error} /> : null}
              </div>
            </Card>
          )}
          <div>
            <Text preset="h2" style={{ marginBottom: 16 }}>Mes paramètres personnels</Text>
            <AccountSettingsPanel profileRoute="/organization/profile" />
          </div>
        </div>
      </AuthGate>
    </Section>
  );
}
