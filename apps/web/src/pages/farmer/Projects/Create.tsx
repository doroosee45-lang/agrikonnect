import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';

import { AuthGate, Button, Card, Input, Section, Text, TextArea } from '@/components/ui';
import { projectApi, referenceApi } from '@/services/endpoints';
import { queryKeys } from '@/services/query';
import type { ProjectCreateInput } from '@/services/types';
import { useAuthStore } from '@/store/auth';
import { COLORS, DURATION, EASE, RADIUS } from '@/theme';

/**
 * FARMER — création d'un projet de financement.
 *
 * Les montants saisis sont **déclarés** : la plateforme ne les vérifie pas, et le
 * formulaire le dit. Un investisseur qui croirait lire des montants contrôlés
 * prendrait une décision sur une donnée fausse.
 *
 * Les bornes du formulaire sont celles du serveur (titre 5–200 caractères, secteur
 * 2–80, durée 1–240 mois). Les reprendre ici évite un aller-retour inutile sur une
 * connexion 3G ; le serveur reste l'autorité.
 */

interface FormState {
  title: string;
  sector: string;
  countryCode: string;
  province: string;
  description: string;
  existingAreaHa: string;
  targetAreaHa: string;
  fundingAmount: string;
  currency: string;
  durationMonths: string;
}

const EMPTY: FormState = {
  title: '',
  sector: '',
  countryCode: 'CD',
  province: '',
  description: '',
  existingAreaHa: '',
  targetAreaHa: '',
  fundingAmount: '',
  currency: 'USD',
  durationMonths: '',
};

const numberOrUndefined = (value: string): number | undefined => {
  const trimmed = value.trim();
  if (trimmed === '') return undefined;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : undefined;
};

export default function FarmerProjectCreate() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isAuthenticated = useAuthStore((state) => state.status === 'authenticated');
  const [form, setForm] = useState<FormState>(EMPTY);
  const [failure, setFailure] = useState<string | null>(null);

  const countries = useQuery({
    queryKey: queryKeys.countries.all,
    queryFn: () => referenceApi.countries().then((result) => result.data),
    enabled: isAuthenticated,
    staleTime: 10 * 60_000,
  });

  const set = (key: keyof FormState) => (event: { target: { value: string } }) =>
    setForm((previous) => ({ ...previous, [key]: event.target.value }));

  const create = useMutation({
    mutationFn: () => {
      const payload: ProjectCreateInput = {
        title: form.title.trim(),
        sector: form.sector.trim(),
        countryCode: form.countryCode.trim().toUpperCase(),
        ...(form.province.trim() ? { province: form.province.trim() } : {}),
        ...(form.description.trim() ? { description: form.description.trim() } : {}),
        ...(numberOrUndefined(form.existingAreaHa) !== undefined
          ? { existingAreaHa: numberOrUndefined(form.existingAreaHa) }
          : {}),
        ...(numberOrUndefined(form.targetAreaHa) !== undefined
          ? { targetAreaHa: numberOrUndefined(form.targetAreaHa) }
          : {}),
        ...(numberOrUndefined(form.fundingAmount) !== undefined
          ? { fundingNeed: { amount: numberOrUndefined(form.fundingAmount)!, currency: form.currency.trim() || 'USD' } }
          : {}),
        ...(numberOrUndefined(form.durationMonths) !== undefined
          ? { durationMonths: numberOrUndefined(form.durationMonths) }
          : {}),
      };
      return projectApi.create(payload).then((result) => result.data);
    },
    onSuccess: () => {
      setFailure(null);
      void queryClient.invalidateQueries({ queryKey: queryKeys.projects.all });
      navigate('/farmer/projects');
    },
    onError: (error) => {
      setFailure(error instanceof Error ? error.message : 'Création impossible.');
    },
  });

  return (
    <Section>
      <AuthGate isAuthenticated={isAuthenticated} title="Nouveau projet" icon="💼">
        <div style={{ marginBottom: 24 }}>
          <Link to="/farmer/projects" style={{ fontSize: 13, color: COLORS.slateGray, textDecoration: 'none' }}>
            ← Retour aux projets
          </Link>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: DURATION.slow / 1000, ease: EASE.out }}
          style={{ maxWidth: 720 }}
        >
          <Text preset="h1" style={{ marginBottom: 8 }}>
            Nouveau projet
          </Text>
          <Text preset="bodyMd" color={COLORS.slateGray} style={{ marginBottom: 32 }}>
            Les montants saisis sont déclarés. Ils ne sont pas vérifiés par la plateforme.
          </Text>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <Card tone="white">
              <Text preset="h3" style={{ marginBottom: 16 }}>
                Identification
              </Text>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <Input
                  label="Titre du projet"
                  value={form.title}
                  onChange={set('title')}
                  minLength={5}
                  maxLength={200}
                  placeholder="Extension de 40 ha de maïs à Lisala"
                  required
                />
                <Input
                  label="Secteur"
                  value={form.sector}
                  onChange={set('sector')}
                  minLength={2}
                  maxLength={80}
                  placeholder="Céréales, maraîchage, élevage…"
                  required
                />
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14 }}>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: COLORS.textPrimary }}>Pays</span>
                    <select
                      value={form.countryCode}
                      onChange={set('countryCode')}
                      style={{
                        height: 44,
                        padding: '0 14px',
                        borderRadius: RADIUS.md,
                        border: `1.5px solid ${COLORS.lightBorder}`,
                        background: COLORS.pureWhite,
                        fontSize: 15,
                        color: COLORS.textPrimary,
                      }}
                    >
                      {(countries.data ?? []).map((country) => (
                        <option key={country.code} value={country.code}>
                          {country.name} ({country.code})
                        </option>
                      ))}
                      {(countries.data ?? []).length === 0 ? (
                        <option value={form.countryCode}>{form.countryCode}</option>
                      ) : null}
                    </select>
                  </label>
                  <Input
                    label="Province"
                    value={form.province}
                    onChange={set('province')}
                    maxLength={120}
                    optionalLabel="facultatif"
                    placeholder="Équateur, Bandundu…"
                  />
                </div>
                <TextArea
                  label="Description"
                  value={form.description}
                  onChange={set('description')}
                  maxLength={5000}
                  rows={5}
                  optionalLabel="facultatif"
                  placeholder="Objectif, contexte, état actuel de l'exploitation."
                />
              </div>
            </Card>

            <Card tone="white">
              <Text preset="h3" style={{ marginBottom: 16 }}>
                Surfaces et financement
              </Text>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14 }}>
                <Input
                  label="Surface existante (ha)"
                  type="number"
                  min={0}
                  step="0.01"
                  value={form.existingAreaHa}
                  onChange={set('existingAreaHa')}
                  optionalLabel="facultatif"
                />
                <Input
                  label="Surface visée (ha)"
                  type="number"
                  min={0}
                  step="0.01"
                  value={form.targetAreaHa}
                  onChange={set('targetAreaHa')}
                  optionalLabel="facultatif"
                />
                <Input
                  label="Besoin de financement"
                  type="number"
                  min={0}
                  step="0.01"
                  value={form.fundingAmount}
                  onChange={set('fundingAmount')}
                  optionalLabel="facultatif"
                />
                <Input label="Devise" value={form.currency} onChange={set('currency')} maxLength={3} />
                <Input
                  label="Durée (mois)"
                  type="number"
                  min={1}
                  max={240}
                  step={1}
                  value={form.durationMonths}
                  onChange={set('durationMonths')}
                  optionalLabel="facultatif"
                />
              </div>
              <Text preset="caption" color={COLORS.slateGray} style={{ marginTop: 16, lineHeight: 1.7 }}>
                Les montants et surfaces sont des déclarations de l'agriculteur. Ils ne sont ni audités ni
                garantis par la plateforme : toute décision d'investissement relève de l'investisseur.
              </Text>
            </Card>

            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <Button variant="primary" label="Publier le projet" loading={create.isPending} onClick={() => create.mutate()} />
              <Button variant="ghost" label="Annuler" onClick={() => navigate('/farmer/projects')} />
            </div>

            {failure ? (
              <Card tone="pale">
                <Text preset="caption" color={COLORS.error} style={{ lineHeight: 1.7 }}>
                  {failure}
                </Text>
              </Card>
            ) : null}
          </div>
        </motion.div>
      </AuthGate>
    </Section>
  );
}
