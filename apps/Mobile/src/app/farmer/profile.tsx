import { useState } from 'react';
import { StyleSheet, Switch, View } from 'react-native';
import { useMutation } from '@tanstack/react-query';

import { FarmerHeader } from '@/components/farmer/FarmerHeader';
import { AuthGate, Button, Card, Chip, ErrorState, Input, Screen, Section, Text, TextArea } from '@/components/ui';
import { authApi } from '@/services/api/endpoints';
import { useAuthStore } from '@/store/auth';
import { COLORS } from '@/theme/colors';
import { SPACING } from '@/theme/space';
import { useI18n } from '@/i18n';

const list = (value: string) => value.split(',').map((item) => item.trim()).filter(Boolean);
const joined = (value?: string[]) => (value ?? []).join(', ');

export default function FarmerProfile() {
  const { t } = useI18n();
  const isAuthenticated = useAuthStore((state) => state.status === 'authenticated');
  const me = useAuthStore((state) => state.user);
  const completeness = useAuthStore((state) => state.completeness);
  const refreshProfile = useAuthStore((state) => state.refreshProfile);
  const professional = me?.professionalProfile ?? {};
  const [firstName, setFirstName] = useState(me?.firstName ?? '');
  const [lastName, setLastName] = useState(me?.lastName ?? '');
  const [phone, setPhone] = useState(me?.phone ?? '');
  const [whatsapp, setWhatsapp] = useState(me?.whatsapp ?? '');
  const [avatarUrl, setAvatarUrl] = useState(me?.avatarUrl ?? '');
  const [jobTitle, setJobTitle] = useState(professional.jobTitle ?? '');
  const [activityDomain, setActivityDomain] = useState(professional.activityDomain ?? '');
  const [expertise, setExpertise] = useState(professional.expertise ?? '');
  const [yearsExperience, setYearsExperience] = useState(String(professional.yearsExperience ?? ''));
  const [biography, setBiography] = useState(professional.biography ?? '');
  const [services, setServices] = useState(joined(professional.services));
  const [specialties, setSpecialties] = useState(joined(professional.specialties));
  const [zones, setZones] = useState(joined(professional.interventionZones));
  const [certifications, setCertifications] = useState(joined(professional.certifications));
  const [portfolioUrl, setPortfolioUrl] = useState(professional.portfolioUrl ?? '');
  const [available, setAvailable] = useState(professional.available ?? false);
  const [publicProfile, setPublicProfile] = useState(professional.publicProfile ?? false);
  const [error, setError] = useState<unknown>(null);

  const save = useMutation({
    mutationFn: () =>
      authApi.updateMe({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        ...(phone.trim() ? { phone: phone.trim() } : {}),
        ...(whatsapp.trim() ? { whatsapp: whatsapp.trim() } : {}),
        avatarUrl: avatarUrl.trim() || null,
        professionalProfile: {
          jobTitle: jobTitle.trim(),
          activityDomain: activityDomain.trim(),
          expertise: expertise.trim(),
          ...(yearsExperience.trim() ? { yearsExperience: Number(yearsExperience) } : {}),
          biography: biography.trim(),
          services: list(services),
          specialties: list(specialties),
          interventionZones: list(zones),
          certifications: list(certifications),
          portfolioUrl: portfolioUrl.trim(),
          available,
          publicProfile,
          publicFields: ['identity', 'biography', 'services', 'certifications', 'zones', 'portfolio'],
        },
      }),
    onSuccess: () => {
      setError(null);
      void refreshProfile();
    },
    onError: setError,
  });

  return (
    <Screen background={COLORS.naturalWhite}>
      <FarmerHeader title={t('ui.monProfil')} subtitle="Identité agricole, expertise et visibilité" />
      <Section bare contentStyle={styles.section}>
        <AuthGate isAuthenticated={isAuthenticated} title={t('ui.monProfil')} icon="person-outline">
          <Card tone="white" style={styles.card}>
            <Text preset="h3">Identité personnelle</Text>
            <Text preset="bodySm">{t('ui.email_946f4', { value: me?.email ?? '—' })}</Text>
            <View style={styles.chips}>
              <Chip label={me?.emailVerified ? t('ui.emailVerifie') : t('ui.emailNonVerifie')} tone={me?.emailVerified ? 'success' : 'warning'} size="sm" />
              <Chip label={me?.phoneVerified ? t('ui.telephoneVerifie_4fdf8') : t('ui.telephoneNonVerifie')} tone={me?.phoneVerified ? 'success' : 'warning'} size="sm" />
            </View>
            <View style={styles.row2}>
              <Input label={t('ui.prenom')} value={firstName} onChangeText={setFirstName} />
              <Input label={t('ui.nom')} value={lastName} onChangeText={setLastName} />
            </View>
            <Input label={t('ui.telephone_d3b02')} value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
            <Input label={t('ui.whatsapp')} value={whatsapp} onChangeText={setWhatsapp} keyboardType="phone-pad" />
            <Input label="URL de la photo de profil" value={avatarUrl} onChangeText={setAvatarUrl} autoCapitalize="none" />
          </Card>

          <Card tone="white" style={styles.card}>
            <Text preset="h3">Profil professionnel agricole</Text>
            <Input label="Fonction" value={jobTitle} onChangeText={setJobTitle} />
            <Input label="Domaine d’activité" value={activityDomain} onChangeText={setActivityDomain} />
            <Input label="Secteur d’expertise" value={expertise} onChangeText={setExpertise} />
            <Input label="Années d’expérience" value={yearsExperience} onChangeText={setYearsExperience} keyboardType="number-pad" />
            <Input label="Spécialités (séparées par des virgules)" value={specialties} onChangeText={setSpecialties} />
            <Input label="Services proposés (séparés par des virgules)" value={services} onChangeText={setServices} />
            <Input label="Zones d’intervention (séparées par des virgules)" value={zones} onChangeText={setZones} />
            <Input label="Certifications (séparées par des virgules)" value={certifications} onChangeText={setCertifications} />
            <Input label="Portfolio professionnel" value={portfolioUrl} onChangeText={setPortfolioUrl} autoCapitalize="none" />
            <TextArea label="Biographie professionnelle" value={biography} onChangeText={setBiography} minHeight={120} />
            <View style={styles.row}>
              <Text preset="bodySm" style={styles.flex}>Disponible pour de nouvelles missions</Text>
              <Switch value={available} onValueChange={setAvailable} />
            </View>
          </Card>

          <Card tone="white" style={styles.card}>
            <Text preset="h3">Visibilité publique</Text>
            <View style={styles.row}>
              <Text preset="bodySm" style={styles.flex}>Publier ma présentation professionnelle</Text>
              <Switch value={publicProfile} onValueChange={setPublicProfile} />
            </View>
            <Text preset="caption" color={COLORS.slateGray}>
              L’e-mail, le téléphone, WhatsApp et les données de compte ne sont pas publiés.
            </Text>
            {completeness ? (
              <Text preset="caption" color={COLORS.forestGreen}>
                Profil complété à {completeness.percent} % ({completeness.done}/{completeness.total}).
              </Text>
            ) : null}
          </Card>

          {error ? <ErrorState error={error} showRequestId /> : null}
          <Button label={t('common.save')} onPress={() => save.mutate()} loading={save.isPending} />
        </AuthGate>
      </Section>
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { paddingTop: SPACING.sm, paddingBottom: SPACING.xxl, gap: SPACING.md },
  card: { gap: SPACING.md },
  chips: { flexDirection: 'row', gap: SPACING.xs, flexWrap: 'wrap' },
  row: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  row2: { gap: SPACING.sm },
  flex: { flex: 1 },
});
