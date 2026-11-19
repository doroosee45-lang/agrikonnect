import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useMutation } from '@tanstack/react-query';

import { AuthGate, Button, Card, Chip, ErrorState, Input, Section, Text, TextArea } from '@/components/ui';
import { authApi } from '@/services/endpoints';
import { useAuthStore } from '@/store/auth';
import { COLORS, DURATION, EASE } from '@/theme';
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
  const [form, setForm] = useState({
    firstName: me?.firstName ?? '',
    lastName: me?.lastName ?? '',
    phone: me?.phone ?? '',
    whatsapp: me?.whatsapp ?? '',
    avatarUrl: me?.avatarUrl ?? '',
    jobTitle: professional.jobTitle ?? '',
    activityDomain: professional.activityDomain ?? '',
    expertise: professional.expertise ?? '',
    yearsExperience: professional.yearsExperience?.toString() ?? '',
    biography: professional.biography ?? '',
    services: joined(professional.services),
    specialties: joined(professional.specialties),
    interventionZones: joined(professional.interventionZones),
    certifications: joined(professional.certifications),
    portfolioUrl: professional.portfolioUrl ?? '',
    available: professional.available ?? false,
    publicProfile: professional.publicProfile ?? false,
  });

  const save = useMutation({
    mutationFn: () =>
      authApi.updateMe({
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        ...(form.phone.trim() ? { phone: form.phone.trim() } : {}),
        ...(form.whatsapp.trim() ? { whatsapp: form.whatsapp.trim() } : {}),
        avatarUrl: form.avatarUrl.trim() || null,
        professionalProfile: {
          jobTitle: form.jobTitle.trim(),
          activityDomain: form.activityDomain.trim(),
          expertise: form.expertise.trim(),
          ...(form.yearsExperience.trim() ? { yearsExperience: Number(form.yearsExperience) } : {}),
          biography: form.biography.trim(),
          services: list(form.services),
          specialties: list(form.specialties),
          interventionZones: list(form.interventionZones),
          certifications: list(form.certifications),
          portfolioUrl: form.portfolioUrl.trim(),
          available: form.available,
          publicProfile: form.publicProfile,
          publicFields: ['identity', 'biography', 'services', 'certifications', 'zones', 'portfolio'],
        },
      }),
    onSuccess: () => void refreshProfile(),
  });

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  return (
    <Section>
      <AuthGate isAuthenticated={isAuthenticated} title={t('ui.monProfil')} icon="👤">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: DURATION.slow / 1000, ease: EASE.out }} style={{ maxWidth: 760 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 24 }}>
            <div>
              <Text preset="h1">Mon profil producteur</Text>
              <Text preset="bodyMd" color={COLORS.slateGray}>Identité personnelle, activité agricole et présentation professionnelle.</Text>
            </div>
            <Link to="/farmer/settings"><Button label="Paramètres" variant="outline" /></Link>
          </div>

          <form onSubmit={(event) => { event.preventDefault(); save.mutate(); }} style={{ display: 'grid', gap: 16 }}>
            <Card tone="white">
              <Text preset="h3" style={{ marginBottom: 16 }}>Identité personnelle</Text>
              <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
                <Chip label={me?.emailVerified ? t('ui.emailVerifie') : t('ui.emailNonVerifie')} tone={me?.emailVerified ? 'success' : 'warning'} size="sm" />
                <Chip label={me?.phoneVerified ? t('ui.telephoneVerifie_4fdf8') : t('ui.telephoneNonVerifie')} tone={me?.phoneVerified ? 'success' : 'warning'} size="sm" />
                <Chip label={`${completeness?.percent ?? 0} % complété`} tone="neutral" size="sm" />
              </div>
              <div style={grid}>
                <Input label={t('ui.prenom')} value={form.firstName} onChange={(e) => set('firstName', e.target.value)} required />
                <Input label={t('ui.nom')} value={form.lastName} onChange={(e) => set('lastName', e.target.value)} required />
                <Input label={t('ui.telephone_d3b02')} value={form.phone} onChange={(e) => set('phone', e.target.value)} />
                <Input label={t('ui.whatsapp')} value={form.whatsapp} onChange={(e) => set('whatsapp', e.target.value)} />
                <Input label="URL de la photo de profil" value={form.avatarUrl} onChange={(e) => set('avatarUrl', e.target.value)} />
              </div>
            </Card>

            <Card tone="white">
              <Text preset="h3" style={{ marginBottom: 16 }}>Identité et activité professionnelles</Text>
              <div style={grid}>
                <Input label="Fonction" value={form.jobTitle} onChange={(e) => set('jobTitle', e.target.value)} />
                <Input label="Domaine d’activité" value={form.activityDomain} onChange={(e) => set('activityDomain', e.target.value)} />
                <Input label="Secteur d’expertise" value={form.expertise} onChange={(e) => set('expertise', e.target.value)} />
                <Input label="Années d’expérience" type="number" min={0} max={80} value={form.yearsExperience} onChange={(e) => set('yearsExperience', e.target.value)} />
                <Input label="Spécialités, séparées par des virgules" value={form.specialties} onChange={(e) => set('specialties', e.target.value)} />
                <Input label="Services proposés, séparés par des virgules" value={form.services} onChange={(e) => set('services', e.target.value)} />
                <Input label="Zones d’intervention, séparées par des virgules" value={form.interventionZones} onChange={(e) => set('interventionZones', e.target.value)} />
                <Input label="Certifications, séparées par des virgules" value={form.certifications} onChange={(e) => set('certifications', e.target.value)} />
                <Input label="Portfolio professionnel" value={form.portfolioUrl} onChange={(e) => set('portfolioUrl', e.target.value)} />
                <TextArea label="Biographie professionnelle" value={form.biography} onChange={(e) => set('biography', e.target.value)} />
              </div>
              <label style={check}><input type="checkbox" checked={form.available} onChange={(e) => set('available', e.target.checked)} />Disponible pour de nouvelles missions</label>
            </Card>

            <Card tone="white">
              <Text preset="h3" style={{ marginBottom: 12 }}>Visibilité publique</Text>
              <label style={check}><input type="checkbox" checked={form.publicProfile} onChange={(e) => set('publicProfile', e.target.checked)} />Publier ma présentation professionnelle</label>
              <Text preset="caption" color={COLORS.slateGray}>Les coordonnées privées, le téléphone, WhatsApp et les données de compte restent exclus de cette présentation.</Text>
            </Card>

            {save.error ? <ErrorState error={save.error} showRequestId /> : null}
            <Button label={t('common.save')} type="submit" loading={save.isPending} />
          </form>
        </motion.div>
      </AuthGate>
    </Section>
  );
}

const grid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 } as const;
const check = { display: 'flex', alignItems: 'center', gap: 10, marginTop: 16 } as const;
