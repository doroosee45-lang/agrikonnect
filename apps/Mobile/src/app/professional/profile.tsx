import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useMutation } from '@tanstack/react-query';
import { router } from 'expo-router';

import { AppHeader } from '@/components/app/AppHeader';
import { AuthGate, Button, Card, ErrorState, Input, Screen, Text, TextArea } from '@/components/ui';
import { authApi } from '@/services/api/endpoints';
import { useAuthStore } from '@/store/auth';
import { useI18n } from '@/i18n';
import { COLORS } from '@/theme/colors';
import { SPACING } from '@/theme/space';

const csv = (value: string) => value.split(',').map((item) => item.trim()).filter(Boolean);

export default function ProfessionalProfile() {
  const { t } = useI18n();
  const user = useAuthStore((state) => state.user);
  const refreshProfile = useAuthStore((state) => state.refreshProfile);
  const isAuthenticated = useAuthStore((state) => state.status === 'authenticated');
  const professional = user?.professionalProfile ?? {};
  const [firstName, setFirstName] = useState(user?.firstName ?? '');
  const [lastName, setLastName] = useState(user?.lastName ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl ?? '');
  const [jobTitle, setJobTitle] = useState(professional.jobTitle ?? '');
  const [activityDomain, setActivityDomain] = useState(professional.activityDomain ?? '');
  const [expertise, setExpertise] = useState(professional.expertise ?? '');
  const [yearsExperience, setYearsExperience] = useState(String(professional.yearsExperience ?? ''));
  const [biography, setBiography] = useState(professional.biography ?? '');
  const [services, setServices] = useState((professional.services ?? []).join(', '));
  const [specialties, setSpecialties] = useState((professional.specialties ?? []).join(', '));
  const [zones, setZones] = useState((professional.interventionZones ?? []).join(', '));
  const [certifications, setCertifications] = useState((professional.certifications ?? []).join(', '));
  const [portfolioUrl, setPortfolioUrl] = useState(professional.portfolioUrl ?? '');

  const save = useMutation({
    mutationFn: () =>
      authApi.updateMe({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        ...(phone.trim() ? { phone: phone.trim() } : {}),
        avatarUrl: avatarUrl.trim() || null,
        professionalProfile: {
          ...professional,
          jobTitle: jobTitle.trim(),
          activityDomain: activityDomain.trim(),
          expertise: expertise.trim(),
          ...(yearsExperience.trim() ? { yearsExperience: Number(yearsExperience) } : {}),
          biography: biography.trim(),
          services: csv(services),
          specialties: csv(specialties),
          interventionZones: csv(zones),
          certifications: csv(certifications),
          portfolioUrl: portfolioUrl.trim(),
        },
      }),
    onSuccess: () => void refreshProfile(),
  });

  return (
    <Screen background={COLORS.naturalWhite}>
      <AppHeader title="Profil professionnel" subtitle="Identité, fonction, expertise et expérience" />
      <View style={styles.content}>
        <AuthGate isAuthenticated={isAuthenticated} title="Profil professionnel" icon="briefcase-outline">
          <Card tone="white" style={styles.card}>
            <Text preset="h3">Identité personnelle</Text>
            <Text preset="bodySm">{t('ui.email_946f4', { value: user?.email ?? '—' })}</Text>
            <Input label="Prénom" value={firstName} onChangeText={setFirstName} />
            <Input label="Nom" value={lastName} onChangeText={setLastName} />
            <Input label="Téléphone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
            <Input label="URL de la photo de profil" value={avatarUrl} onChangeText={setAvatarUrl} autoCapitalize="none" />
            <Input label="Profession" value={jobTitle} onChangeText={setJobTitle} />
            <Input label="Domaine d’activité" value={activityDomain} onChangeText={setActivityDomain} />
            <Input label="Expertise" value={expertise} onChangeText={setExpertise} />
            <Input label="Années d’expérience" value={yearsExperience} onChangeText={setYearsExperience} keyboardType="number-pad" />
            <Input label="Spécialités (virgules)" value={specialties} onChangeText={setSpecialties} />
            <Input label="Services proposés (virgules)" value={services} onChangeText={setServices} />
            <Input label="Zones d’intervention (virgules)" value={zones} onChangeText={setZones} />
            <Input label="Certifications (virgules)" value={certifications} onChangeText={setCertifications} />
            <Input label="Portfolio professionnel" value={portfolioUrl} onChangeText={setPortfolioUrl} autoCapitalize="none" />
            <TextArea label="Biographie professionnelle" value={biography} onChangeText={setBiography} />
            {save.error ? <ErrorState error={save.error} /> : null}
            <Button label="Enregistrer mon profil" loading={save.isPending} onPress={() => save.mutate()} />
            <Button label="Paramètres" variant="outline" onPress={() => router.push('/professional/settings')} />
          </Card>
        </AuthGate>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: SPACING.lg, paddingTop: SPACING.sm, paddingBottom: SPACING.xxl },
  card: { gap: SPACING.md },
});
