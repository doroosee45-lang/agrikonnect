import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';

import { AuthGate, Button, Card, Chip, ErrorState, Input, LoadingState, Section, Text } from '@/components/ui';
import { authApi, investApi } from '@/services/endpoints';
import { RequestError } from '@/services/types';
import { useAuthStore } from '@/store/auth';
import { COLORS } from '@/theme';

const csv = (value: string) => value.split(',').map((item) => item.trim()).filter(Boolean);

export default function InvestmentProfile() {
  const isAuthenticated = useAuthStore((state) => state.status === 'authenticated');
  const me = useAuthStore((state) => state.user);
  const refreshProfile = useAuthStore((state) => state.refreshProfile);
  const query = useQuery({
    queryKey: ['investors', 'me'],
    queryFn: () => investApi.profile().then((result) => result.data),
    enabled: isAuthenticated,
    retry: false,
  });
  const investor = query.data?.profile;
  const [firstName, setFirstName] = useState(me?.firstName ?? '');
  const [lastName, setLastName] = useState(me?.lastName ?? '');
  const [phone, setPhone] = useState(me?.phone ?? '');
  const [displayName, setDisplayName] = useState('');
  const [sectors, setSectors] = useState('');
  const [countries, setCountries] = useState('');
  const [ticketMin, setTicketMin] = useState('');
  const [ticketMax, setTicketMax] = useState('');
  const [currency, setCurrency] = useState('USD');

  useEffect(() => {
    if (!investor) return;
    setDisplayName(investor.displayName);
    setSectors(investor.sectors.join(', '));
    setCountries(investor.countries.join(', '));
    setTicketMin(investor.ticketMin?.toString() ?? '');
    setTicketMax(investor.ticketMax?.toString() ?? '');
    setCurrency(investor.currency);
  }, [investor]);

  const save = useMutation({
    mutationFn: async () => {
      await authApi.updateMe({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        ...(phone.trim() ? { phone: phone.trim() } : {}),
      });
      return investApi.updateProfile({
        displayName: displayName.trim() || `${firstName.trim()} ${lastName.trim()}`,
        sectors: csv(sectors),
        countries: csv(countries).map((country) => country.toUpperCase()),
        ...(ticketMin.trim() ? { ticketMin: Number(ticketMin) } : {}),
        ...(ticketMax.trim() ? { ticketMax: Number(ticketMax) } : {}),
        currency: currency.trim().toUpperCase(),
        preferences: investor?.preferences ?? {},
      });
    },
    onSuccess: () => {
      void refreshProfile();
      void query.refetch();
    },
  });
  const missingProfile = query.error instanceof RequestError && query.error.status === 404;
  const access = query.data?.access;

  return (
    <Section>
      <AuthGate isAuthenticated={isAuthenticated} title="Profil investisseur" icon="💼">
        <div style={{ maxWidth: 720 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 24 }}>
            <div>
              <Text preset="h1">Profil investisseur</Text>
              <Text preset="bodyMd" color={COLORS.slateGray}>Identité personnelle, stratégie d’investissement et accès Data Room.</Text>
            </div>
            <Link to="/investment/settings"><Button label="Paramètres" variant="outline" /></Link>
          </div>

          {query.isLoading ? <LoadingState count={2} height={120} /> : (
            <form onSubmit={(event) => { event.preventDefault(); save.mutate(); }} style={{ display: 'grid', gap: 16 }}>
              <Card tone="white">
                <Text preset="h3" style={{ marginBottom: 16 }}>Identité personnelle</Text>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
                  <Chip label={me?.emailVerified ? 'E-mail vérifié' : 'E-mail non vérifié'} tone={me?.emailVerified ? 'success' : 'warning'} size="sm" />
                  <Chip label={access?.verified ? 'Profil vérifié' : 'Vérification requise'} tone={access?.verified ? 'success' : 'warning'} size="sm" />
                </div>
                <div style={grid}>
                  <Input label="Prénom" value={firstName} onChange={(event) => setFirstName(event.target.value)} required />
                  <Input label="Nom" value={lastName} onChange={(event) => setLastName(event.target.value)} required />
                  <Input label="Téléphone" value={phone} onChange={(event) => setPhone(event.target.value)} />
                  <Input label="Nom d’affichage" value={displayName} onChange={(event) => setDisplayName(event.target.value)} required />
                </div>
              </Card>

              <Card tone="white">
                <Text preset="h3" style={{ marginBottom: 16 }}>Préférences d’investissement</Text>
                <div style={grid}>
                  <Input label="Secteurs d’intérêt, séparés par des virgules" value={sectors} onChange={(event) => setSectors(event.target.value)} />
                  <Input label="Pays ISO, séparés par des virgules" value={countries} onChange={(event) => setCountries(event.target.value)} />
                  <Input label="Ticket minimum" type="number" min={0} value={ticketMin} onChange={(event) => setTicketMin(event.target.value)} />
                  <Input label="Ticket maximum" type="number" min={0} value={ticketMax} onChange={(event) => setTicketMax(event.target.value)} />
                  <Input label="Devise préférée" value={currency} onChange={(event) => setCurrency(event.target.value)} maxLength={3} />
                </div>
                <Text preset="caption" color={COLORS.slateGray} style={{ marginTop: 12 }}>
                  Ce profil individuel reste distinct d’une société ou organisation d’investissement.
                </Text>
              </Card>

              <Card tone="white">
                <Text preset="h3" style={{ marginBottom: 8 }}>Accès à la Data Room</Text>
                <Text preset="bodySm">
                  {access?.dataRoomAccess
                    ? 'Accès autorisé : profil vérifié et authentification multifacteur active.'
                    : 'Accès fermé : la vérification administrative et la MFA sont requises.'}
                </Text>
                {!access?.mfaEnabled ? <Link to="/auth/mfa"><Button label="Configurer la 2FA" variant="outline" size="sm" /></Link> : null}
              </Card>

              {query.isError && !missingProfile ? <ErrorState error={query.error} onRetry={() => void query.refetch()} /> : null}
              {missingProfile ? <Text preset="caption" color={COLORS.warning}>Aucun profil investisseur : l’enregistrement ci-dessous le créera.</Text> : null}
              {save.error ? <ErrorState error={save.error} showRequestId /> : null}
              <Button label="Enregistrer mon profil" type="submit" loading={save.isPending} />
            </form>
          )}
        </div>
      </AuthGate>
    </Section>
  );
}

const grid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 } as const;
