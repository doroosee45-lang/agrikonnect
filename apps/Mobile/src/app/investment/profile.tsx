import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useMutation, useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';

import { AppHeader } from '@/components/app/AppHeader';
import { AuthGate, Button, Card, Chip, ErrorState, Input, Screen, Text } from '@/components/ui';
import { authApi, investApi } from '@/services/api/endpoints';
import { RequestError } from '@/services/api/types';
import { useAuthStore } from '@/store/auth';
import { COLORS } from '@/theme/colors';
import { SPACING } from '@/theme/space';
import { useI18n } from '@/i18n';

const csv = (value: string) => value.split(',').map((item) => item.trim()).filter(Boolean);

export default function InvestmentProfile() {
  const { t } = useI18n();
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
    setTicketMin(investor.ticketMin == null ? '' : String(investor.ticketMin));
    setTicketMax(investor.ticketMax == null ? '' : String(investor.ticketMax));
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
    <Screen background={COLORS.naturalWhite}>
      <AppHeader title={t('ui.monProfilInvestisseur')} subtitle="Identité personnelle, stratégie et accès Data Room" />
      <View style={styles.content}>
        <AuthGate isAuthenticated={isAuthenticated} title={t('ui.monProfil')} icon="person-outline">
          <Card tone="white" style={styles.card}>
            <Text preset="h3">Identité de l’investisseur</Text>
            <Text preset="bodySm">{t('ui.email_946f4', { value: me?.email ?? '—' })}</Text>
            <View style={styles.chips}>
              <Chip label={me?.emailVerified ? t('ui.emailVerifie') : t('ui.emailNonVerifie')} tone={me?.emailVerified ? 'success' : 'warning'} size="sm" />
              <Chip label={access?.verified ? 'Profil vérifié' : 'Vérification requise'} tone={access?.verified ? 'success' : 'warning'} size="sm" />
            </View>
            <Input label={t('ui.prenom')} value={firstName} onChangeText={setFirstName} />
            <Input label={t('ui.nom')} value={lastName} onChangeText={setLastName} />
            <Input label={t('ui.telephone_d3b02')} value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
            <Input label="Nom d’affichage investisseur" value={displayName} onChangeText={setDisplayName} />
          </Card>

          <Card tone="white" style={styles.card}>
            <Text preset="h3">Préférences d’investissement</Text>
            <Input label="Secteurs d’intérêt (séparés par des virgules)" value={sectors} onChangeText={setSectors} />
            <Input label="Pays d’investissement (codes ISO séparés par des virgules)" value={countries} onChangeText={setCountries} autoCapitalize="characters" />
            <Input label="Ticket minimum" value={ticketMin} onChangeText={setTicketMin} keyboardType="decimal-pad" />
            <Input label="Ticket maximum" value={ticketMax} onChangeText={setTicketMax} keyboardType="decimal-pad" />
            <Input label="Devise" value={currency} onChangeText={setCurrency} autoCapitalize="characters" />
            <Text preset="caption" color={COLORS.slateGray}>
              Un investisseur individuel reste distinct de toute société qu’il représente. Les organisations sont gérées dans leur propre profil.
            </Text>
          </Card>

          <Card tone="white" style={styles.card}>
            <Text preset="h3">Accès Data Room</Text>
            <Text preset="bodySm">
              {access?.dataRoomAccess
                ? 'Accès autorisé : profil vérifié et MFA active.'
                : 'Accès fermé : vérification administrative et MFA sont requises.'}
            </Text>
            {!access?.mfaEnabled ? (
              <Button label="Configurer la MFA" variant="outline" onPress={() => router.push('/auth/mfa')} />
            ) : null}
            <Button label={t('ui.parametres_ef8f0')} variant="ghost" onPress={() => router.push('/investment/settings')} />
          </Card>

          {query.isError && !missingProfile ? <ErrorState error={query.error} onRetry={() => void query.refetch()} /> : null}
          {missingProfile ? <Text preset="caption" color={COLORS.warning}>Aucun profil investisseur enregistré : le prochain enregistrement le créera.</Text> : null}
          {save.error ? <ErrorState error={save.error} /> : null}
          <Button label={t('common.save')} loading={save.isPending} onPress={() => save.mutate()} />
        </AuthGate>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: SPACING.lg, paddingTop: SPACING.sm, paddingBottom: SPACING.xxl, gap: SPACING.md },
  card: { gap: SPACING.md },
  chips: { flexDirection: 'row', gap: SPACING.xs, flexWrap: 'wrap' },
});
