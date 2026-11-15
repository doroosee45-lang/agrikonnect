import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { AuthGate, Button, EmptyState, ErrorState, Input, LoadingState } from '@/components/ui';
import {
  HorizonDonutCard,
  HorizonOverviewCard,
  HorizonQuadMetricsCard,
  HorizonShell,
  HorizonTrackListCard,
  formatHorizonTimestamp,
} from '@/design-system';
import type { HorizonTrackItem } from '@/design-system';
import { useI18n } from '@/i18n';
import { formatDate, formatNumber } from '@/lib/format';
import { aiApi, certificationApi, queryKeys, verificationApi } from '@/services';
import { useAuthStore } from '@/store/auth';

/**
 * Espace Verificateur, Agronome & Laboratoire (/reviewer/missions) — Design Horizon 100 % API reelle.
 * Conserve toutes les actions de decision : verification, revue IA escaladee (AI-10) et certification.
 */
export default function ReviewerMissions() {
  const { t } = useI18n();
  const { locale } = useI18n();
  const queryClient = useQueryClient();
  const isAuthenticated = useAuthStore((state) => state.status === 'authenticated');
  const [notes, setNotes] = useState<Record<string, string>>({});

  const verifications = useQuery({
    queryKey: queryKeys.verifications.queue({ status: 'PENDING' }),
    queryFn: () => verificationApi.adminQueue({ status: 'PENDING', limit: 50 }).then((r) => r.data),
    enabled: isAuthenticated,
    retry: false,
  });

  const escalatedAi = useQuery({
    queryKey: queryKeys.ai.list({ status: 'ESCALATED' }),
    queryFn: () => aiApi.list({ status: 'ESCALATED', limit: 50 }).then((r) => r.data ?? []),
    enabled: isAuthenticated,
    retry: false,
  });

  const certifications = useQuery({
    queryKey: queryKeys.certifications.all,
    queryFn: () => certificationApi.list({ limit: 50 }).then((r) => r.data ?? []),
    enabled: isAuthenticated,
    retry: false,
  });

  const decideVerification = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'VERIFIED' | 'REJECTED' }) =>
      verificationApi.decide(id, { status, notes: notes[id] ?? '' }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['verifications'] }),
  });

  const reviewAi = useMutation({
    mutationFn: ({ id, approved }: { id: string; approved: boolean }) =>
      aiApi.review(id, { approved, notes: notes[id] ?? '' }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['ai'] }),
  });

  const verifyCert = useMutation({
    mutationFn: (id: string) => certificationApi.verify(id, { notes: notes[id] ?? '' }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['certifications'] }),
  });

  const verifItems = verifications.data?.items ?? [];
  const aiItems = escalatedAi.data ?? [];
  const allCerts = certifications.data ?? [];
  const unverifiedCerts = allCerts.filter((c) => !c.verifiedAt);
  const verifiedCerts = allCerts.filter((c) => Boolean(c.verifiedAt));
  const totalPending = verifItems.length + aiItems.length + unverifiedCerts.length;

  const trackItems: HorizonTrackItem[] = [
    ...verifItems.slice(0, 2).map((item) => ({
      id: item.id,
      code: `VER-${item.id.slice(0, 5).toUpperCase()}`,
      subtitle: formatDate(item.createdAt, locale),
      statusLabel: t('ui.niveau_9df50', { level: item.level }),
      tone: 'amber' as const,
      leftCode: item.subjectType.slice(0, 8).toUpperCase(),
      leftLabel: t('ui.dossier'),
      rightCode: t('ui.trackCodeDecision'),
      rightLabel: t('ui.agronome'),
      progressPct: 55,
      icon: 'shield' as const,
    })),
    ...aiItems.slice(0, 2).map((item) => ({
      id: item.id,
      code: `IA-${item.id.slice(0, 5).toUpperCase()}`,
      subtitle: formatDate(item.createdAt, locale),
      statusLabel: t('ui.escaladeeAi10'),
      tone: 'red' as const,
      leftCode: item.type.slice(0, 8).toUpperCase(),
      leftLabel: t('ui.modeleIa'),
      rightCode: t('ui.trackCodeHuman'),
      rightLabel: t('ui.validation'),
      progressPct: 70,
      icon: 'alert' as const,
    })),
  ];

  return (
    <AuthGate
      isAuthenticated={isAuthenticated}
      title={t('ui.missionsDeRevueCertification')}
      description={t('ui.instructionDesDemandesDeVerificationEscalades')}
      icon="🔬"
    >
      <HorizonShell>
        {verifications.isLoading && escalatedAi.isLoading && certifications.isLoading ? (
          <LoadingState count={3} height={140} />
        ) : verifications.isError && escalatedAi.isError && certifications.isError ? (
          <ErrorState error={verifications.error} onRetry={() => void verifications.refetch()} showRequestId />
        ) : (
          <>
            <HorizonOverviewCard
              title={t('ui.vueDEnsembleDesMissionsD')}
              updatedLabel={formatHorizonTimestamp(undefined, locale)}
              items={[
                {
                  id: 'total-pending',
                  label: t('ui.missionsAInstruire'),
                  value: formatNumber(totalPending, locale),
                  subtitle: t('ui.totalCumuleDes3FilesDe'),
                  badgeText: totalPending > 0 ? t('ui.enAttente') : t('ui.aJour'),
                  badgeSubtext: 'expertise',
                  tone: totalPending > 0 ? 'amber' : 'green',
                  icon: 'clock',
                },
                {
                  id: 'verif',
                  label: t('ui.dossiersDeVerification'),
                  value: formatNumber(verifItems.length, locale),
                  subtitle: t('ui.exploitationsParcellesOrganisations'),
                  badgeText: 'VER-05',
                  badgeSubtext: t('ui.criteres_1fded'),
                  tone: 'blue',
                  icon: 'shield',
                },
                {
                  id: 'ai',
                  label: t('ui.analysesIaEscaladees'),
                  value: formatNumber(aiItems.length, locale),
                  subtitle: t('ui.revueHumaineObligatoireAvantDecision'),
                  badgeText: 'AI-10',
                  badgeSubtext: 'garde-fou',
                  tone: aiItems.length > 0 ? 'red' : 'green',
                  icon: 'alert',
                },
                {
                  id: 'certs',
                  label: t('ui.certificatsAAttester'),
                  value: formatNumber(unverifiedCerts.length, locale),
                  subtitle: t('ui.dejaAttesteS', { length: formatNumber(verifiedCerts.length, locale) }),
                  badgeText: t('ui.laboTiers'),
                  badgeSubtext: t('ui.conformite_25c18'),
                  tone: 'green',
                  icon: 'check',
                },
              ]}
            />

            <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
              <HorizonTrackListCard
                title={t('ui.filesPrioritairesEnCours')}
                items={trackItems}
                emptyMessage={t('ui.aucunDossierEnAttenteDInstruction')}
              />

              <HorizonQuadMetricsCard
                title={t('ui.chargeDInstruction')}
                cells={[
                  {
                    id: 'r-v',
                    value: formatNumber(verifItems.length, locale),
                    label: t('ui.verificationsTerrain'),
                    bars: [35, 58, 70, verifItems.length > 0 ? 86 : 18],
                    tone: 'blue',
                  },
                  {
                    id: 'r-ai',
                    value: formatNumber(aiItems.length, locale),
                    label: t('ui.escaladesIa'),
                    bars: [28, 48, 62, aiItems.length > 0 ? 84 : 18],
                    tone: 'red',
                  },
                  {
                    id: 'r-c',
                    value: formatNumber(unverifiedCerts.length, locale),
                    label: t('ui.certificatsOuverts'),
                    bars: [30, 52, 66, unverifiedCerts.length > 0 ? 80 : 18],
                    tone: 'amber',
                  },
                  {
                    id: 'r-ok',
                    value: formatNumber(verifiedCerts.length, locale),
                    label: t('ui.certificatsAttestes'),
                    bars: [44, 68, 82, verifiedCerts.length > 0 ? 92 : 18],
                    tone: 'green',
                  },
                ]}
              />

              <HorizonDonutCard
                title={t('ui.repartitionDesMissions')}
                totalValue={formatNumber(totalPending, locale)}
                totalLabel={t('ui.aTraiter')}
                segments={[
                  { label: t('ui.verifications'), value: verifItems.length, tone: 'blue' },
                  { label: t('ui.escaladesIa'), value: aiItems.length, tone: 'red' },
                  { label: t('ui.certificatsAVerifier'), value: unverifiedCerts.length, tone: 'amber' },
                  { label: t('ui.certificatsValides'), value: verifiedCerts.length, tone: 'green' },
                ]}
              />
            </div>

            {/* 1. File de decision : Verifications */}
            <section className="rounded-carte border border-bordure bg-surface p-5 shadow-2xs">
              <h3 className="mb-3 text-[15.5px] font-bold text-texte" style={{ margin: '0 0 12px 0' }}>{t('ui.demandesDeVerificationEnAttente', { length: verifItems.length })}</h3>
              {verifItems.length === 0 ? (
                <EmptyState
                  icon="✓"
                  title={t('ui.aucuneVerificationEnAttente')}
                  description={t('ui.tousLesDossiersSoumisOntEte')}
                />
              ) : (
                <div className="flex flex-col gap-3">
                  {verifItems.map((item) => (
                    <div
                      key={item.id}
                      className="flex flex-col gap-3 rounded-2xl border border-bordure bg-fond/50 p-4"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                        <span className="font-bold text-texte">{t('ui.niveau_23b4f', { subjectType: item.subjectType, subjectId: item.subjectId, level: item.level })}</span>
                        <span className="text-texte-doux">{t('ui.soumiseLe', { createdAt: formatDate(item.createdAt, locale) })}</span>
                      </div>
                      <Input
                        label={t('ui.observationsDAudit')}
                        value={notes[item.id] ?? ''}
                        onChange={(e) => setNotes((cur) => ({ ...cur, [item.id]: e.target.value }))}
                      />
                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          label={t('ui.validerLeDossier')}
                          onClick={() => decideVerification.mutate({ id: item.id, status: 'VERIFIED' })}
                        />
                        <Button
                          size="sm"
                          variant="outline"
                          label={t('ui.rejeter')}
                          onClick={() => decideVerification.mutate({ id: item.id, status: 'REJECTED' })}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* 2. File de decision : Analyses IA escaladees (AI-10) */}
            <section className="rounded-carte border border-bordure bg-surface p-5 shadow-2xs">
              <h3 className="mb-3 text-[15.5px] font-bold text-texte" style={{ margin: '0 0 12px 0' }}>{t('ui.analysesIaEscaladeesValidationHumaineAi', { length: aiItems.length })}</h3>
              {aiItems.length === 0 ? (
                <EmptyState
                  icon="🤖"
                  title={t('ui.aucuneEscaladeIaOuverte')}
                  description={t('ui.lesAnalysesDemandantUneValidationAgronomique')}
                />
              ) : (
                <div className="flex flex-col gap-3">
                  {aiItems.map((analysis) => (
                    <div
                      key={analysis.id}
                      className="flex flex-col gap-3 rounded-2xl border border-bordure bg-fond/50 p-4"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                        <span className="font-bold text-texte">{t('ui.modele_f476b', { type: analysis.type, model: analysis.model })}</span>
                        <span className="text-texte-doux">{formatDate(analysis.createdAt, locale)}</span>
                      </div>
                      <Input
                        label={t('ui.avisDeLExpert')}
                        value={notes[analysis.id] ?? ''}
                        onChange={(e) => setNotes((cur) => ({ ...cur, [analysis.id]: e.target.value }))}
                      />
                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          label={t('ui.approuverLAnalyse')}
                          onClick={() => reviewAi.mutate({ id: analysis.id, approved: true })}
                        />
                        <Button
                          size="sm"
                          variant="outline"
                          label={t('ui.ecarter')}
                          onClick={() => reviewAi.mutate({ id: analysis.id, approved: false })}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* 3. File de decision : Certifications laboratoire / tiers */}
            <section className="rounded-carte border border-bordure bg-surface p-5 shadow-2xs">
              <h3 className="mb-3 text-[15.5px] font-bold text-texte" style={{ margin: '0 0 12px 0' }}>{t('ui.certificationsAAttester', { length: unverifiedCerts.length })}</h3>
              {unverifiedCerts.length === 0 ? (
                <EmptyState
                  icon="📜"
                  title={t('ui.aucunCertificatEnAttente')}
                  description={t('ui.toutesLesCertificationsDeposeesOntEte')}
                />
              ) : (
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  {unverifiedCerts.map((cert) => (
                    <div
                      key={cert.id}
                      className="flex items-center justify-between gap-3 rounded-2xl border border-bordure bg-fond/50 p-4"
                    >
                      <div>
                        <div className="text-sm font-bold text-texte">
                          {cert.reference ? `${cert.type} · ${cert.reference}` : cert.type}
                        </div>
                        <div className="text-xs text-texte-doux">{cert.issuer}</div>
                      </div>
                      <Button size="sm" label={t('ui.attester')} onClick={() => verifyCert.mutate(cert.id)} />
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </HorizonShell>
    </AuthGate>
  );
}
