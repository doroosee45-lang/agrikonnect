import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useMutation, useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useLocalSearchParams } from 'expo-router';

import { AppHeader } from '@/components/app/AppHeader';
import { AuthGate, Button, Card, Chip, ChipRow, ErrorState, Input, LoadingState, Screen, Text, TextArea } from '@/components/ui';
import { authApi, organizationApi } from '@/services/api/endpoints';
import { queryKeys } from '@/services/query';
import { useAuthStore } from '@/store/auth';
import { COLORS } from '@/theme/colors';
import { SPACING } from '@/theme/space';
import { useI18n } from '@/i18n';

const split = (value: string) => value.split(',').map((item) => item.trim()).filter(Boolean);

export default function OrganizationProfile() {
  const params = useLocalSearchParams<{ id?: string }>();
  const { t } = useI18n();
  const isAuthenticated = useAuthStore((state) => state.status === 'authenticated');
  const canWrite = useAuthStore((state) => state.can('organizations.write'));
  const me = useQuery({
    queryKey: queryKeys.me,
    queryFn: () => authApi.me().then((result) => result.data),
    enabled: isAuthenticated,
  });
  const organizationId = params.id ?? me.data?.activeOrganizationId ?? me.data?.user.organizations[0]?.id ?? null;
  const query = useQuery({
    queryKey: queryKeys.organizations.one(organizationId ?? ''),
    queryFn: () => organizationApi.get(organizationId!).then((result) => result.data),
    enabled: Boolean(organizationId),
  });
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [officialName, setOfficialName] = useState('');
  const [tradingName, setTradingName] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [coverUrl, setCoverUrl] = useState('');
  const [sector, setSector] = useState('');
  const [foundedAt, setFoundedAt] = useState('');
  const [headquartersAddress, setHeadquartersAddress] = useState('');
  const [legalForm, setLegalForm] = useState('');
  const [registrationNumber, setRegistrationNumber] = useState('');
  const [taxIdentifier, setTaxIdentifier] = useState('');
  const [legalRepresentative, setLegalRepresentative] = useState('');
  const [officialPhone, setOfficialPhone] = useState('');
  const [institutionalEmail, setInstitutionalEmail] = useState('');
  const [website, setWebsite] = useState('');
  const [activities, setActivities] = useState('');
  const [locations, setLocations] = useState('');
  const [partners, setPartners] = useState('');

  useEffect(() => {
    const org = query.data;
    if (!org) return;
    const details = org.profileDetails ?? {};
    setName(org.name);
    setDescription(org.description ?? '');
    setOfficialName(details.officialName ?? org.name);
    setTradingName(details.tradingName ?? '');
    setLogoUrl(details.logoUrl ?? '');
    setCoverUrl(details.coverUrl ?? '');
    setSector(details.sector ?? '');
    setFoundedAt(details.foundedAt ?? '');
    setHeadquartersAddress(details.headquartersAddress ?? '');
    setLegalForm(details.legalForm ?? '');
    setRegistrationNumber(details.registrationNumber ?? '');
    setTaxIdentifier(details.taxIdentifier ?? '');
    setLegalRepresentative(details.legalRepresentative ?? '');
    setOfficialPhone(details.officialPhone ?? '');
    setInstitutionalEmail(details.institutionalEmail ?? '');
    setWebsite(details.website ?? '');
    setActivities((details.activities ?? []).join(', '));
    setLocations((details.locations ?? []).join(', '));
    setPartners((details.partners ?? []).join(', '));
  }, [query.data]);

  const save = useMutation({
    mutationFn: () =>
      organizationApi.update(organizationId!, {
        name: name.trim(),
        description: description.trim() || undefined,
        profileDetails: {
          officialName: officialName.trim(),
          tradingName: tradingName.trim(),
          logoUrl: logoUrl.trim(),
          coverUrl: coverUrl.trim(),
          sector: sector.trim(),
          ...(foundedAt.trim() ? { foundedAt: foundedAt.trim() } : {}),
          registrationCountry: query.data?.countryCode,
          headquartersAddress: headquartersAddress.trim(),
          legalForm: legalForm.trim(),
          registrationNumber: registrationNumber.trim(),
          taxIdentifier: taxIdentifier.trim(),
          legalRepresentative: legalRepresentative.trim(),
          officialPhone: officialPhone.trim(),
          institutionalEmail: institutionalEmail.trim(),
          website: website.trim(),
          socialLinks: [],
          activities: split(activities),
          locations: split(locations),
          partners: split(partners),
        },
      }),
    onSuccess: () => void query.refetch(),
  });

  const org = query.data;
  return (
    <Screen background={COLORS.naturalWhite}>
      <AppHeader title={t('ui.profilOrganisation')} subtitle="Identité institutionnelle, administration et visibilité" />
      <View style={styles.content}>
        <AuthGate isAuthenticated={isAuthenticated} title={t('ui.profilOrganisation')} icon="business-outline">
          {query.isLoading ? (
            <LoadingState count={2} height={120} />
          ) : query.isError ? (
            <ErrorState error={query.error} onRetry={() => void query.refetch()} />
          ) : !org ? (
            <Text preset="body">{t('ui.aucuneOrganisationActive')}</Text>
          ) : (
            <View style={styles.stack}>
              <Card tone="white" style={styles.card}>
                <Text preset="h3">Identité de l’organisation</Text>
                <ChipRow>{org.roles.map((role) => <Chip key={role} label={role} tone="info" size="sm" />)}</ChipRow>
                <Text preset="caption" color={COLORS.slateGray}>{org.type} · {org.countryCode} · {org.slug ?? org.id}</Text>
                <Input label="Nom affiché" value={name} onChangeText={setName} editable={canWrite} />
                <Input label="Nom officiel" value={officialName} onChangeText={setOfficialName} editable={canWrite} />
                <Input label="Nom commercial" value={tradingName} onChangeText={setTradingName} editable={canWrite} />
                <TextArea label="Description institutionnelle" value={description} onChangeText={setDescription} editable={canWrite} />
                <Input label="URL du logo" value={logoUrl} onChangeText={setLogoUrl} editable={canWrite} />
                <Input label="URL de couverture" value={coverUrl} onChangeText={setCoverUrl} editable={canWrite} />
                <Input label="Secteur d’activité" value={sector} onChangeText={setSector} editable={canWrite} />
              </Card>

              <Card tone="white" style={styles.card}>
                <Text preset="h3">Informations juridiques et coordonnées</Text>
                <Input label="Forme juridique (si applicable)" value={legalForm} onChangeText={setLegalForm} editable={canWrite} />
                <Input label="Date de création (AAAA-MM-JJ)" value={foundedAt} onChangeText={setFoundedAt} editable={canWrite} />
                <Input label="Numéro d’immatriculation (si applicable)" value={registrationNumber} onChangeText={setRegistrationNumber} editable={canWrite} />
                <Input label="Identifiant fiscal (si applicable)" value={taxIdentifier} onChangeText={setTaxIdentifier} editable={canWrite} />
                <Input label="Représentant légal" value={legalRepresentative} onChangeText={setLegalRepresentative} editable={canWrite} />
                <Input label="Adresse du siège" value={headquartersAddress} onChangeText={setHeadquartersAddress} editable={canWrite} />
                <Input label="Téléphone officiel" value={officialPhone} onChangeText={setOfficialPhone} editable={canWrite} />
                <Input label="E-mail institutionnel" value={institutionalEmail} onChangeText={setInstitutionalEmail} editable={canWrite} />
                <Input label="Site Internet" value={website} onChangeText={setWebsite} editable={canWrite} />
              </Card>

              <Card tone="white" style={styles.card}>
                <Text preset="h3">Activités et implantation</Text>
                <Input label="Domaines d’intervention (séparés par des virgules)" value={activities} onChangeText={setActivities} editable={canWrite} />
                <Input label="Implantations (séparées par des virgules)" value={locations} onChangeText={setLocations} editable={canWrite} />
                <Input label="Partenaires (séparés par des virgules)" value={partners} onChangeText={setPartners} editable={canWrite} />
                <Button label="Gérer les membres et les rôles" variant="outline" onPress={() => router.push('/organization/members')} />
                <Button label={t('ui.parametres_ef8f0')} variant="ghost" onPress={() => router.push('/organization/settings')} />
              </Card>

              {!canWrite ? (
                <Text preset="caption" color={COLORS.slateGray}>
                  Les informations institutionnelles sont en lecture seule pour votre rôle.
                </Text>
              ) : null}
              {save.error ? <ErrorState error={save.error} /> : null}
              {canWrite ? <Button label={t('common.save')} loading={save.isPending} onPress={() => save.mutate()} /> : null}
            </View>
          )}
        </AuthGate>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: SPACING.lg, paddingTop: SPACING.sm, paddingBottom: SPACING.xxl },
  stack: { gap: SPACING.md },
  card: { gap: SPACING.md },
});
