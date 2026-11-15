import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';

import {
  AuthGate,
  Button,
  Card,
  Chip,
  ChipRow,
  EmptyState,
  ErrorState,
  LoadingState,
  Section,
  Text,
  TextArea,
} from '@/components/ui';
import { verificationApi } from '@/services/endpoints';
import { queryKeys } from '@/services/query';
import { useAuthStore } from '@/store/auth';
import { formatDate } from '@/lib/format';
import { useI18n, tr } from '@/i18n';
import { COLORS, DURATION, EASE } from '@/theme';

/**
 * REVIEWER — points de contrôle d'une mission de vérification.
 *
 * VER-03 : une décision est **approbation** ou **rejet motivé**. Le motif est
 * obligatoire au rejet — un rejet sans raison n'est pas contestable, donc pas
 * auditable. Chaque décision est tracée avec son auteur.
 *
 * Le backend n'expose pas de route « une vérification par identifiant » : la
 * mission est retrouvée dans la file administrateur. C'est assumé, et signalé
 * explicitement si l'identifiant n'y figure pas.
 */

/** Points vérifiables à partir du dossier lui-même — jamais un score. */
const CHECKS = [
  { key: 'subject', get label() { return tr('ui.sujetEtNiveauDeVerificationIdentifies'); } },
  { key: 'documents', get label() { return tr('ui.pieceSJustificativeSDeposeeS'); } },
  { key: 'organization', get label() { return tr('ui.organisationRattacheeIdentifiable'); } },
  { key: 'pending', get label() { return tr('ui.demandeEncoreEnAttenteDeDecision'); } },
] as const;

export default function ReviewerChecklist() {
  const { t } = useI18n();
  const { id } = useParams<{ id: string }>();
  const { locale } = useI18n();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isAuthenticated = useAuthStore((state) => state.status === 'authenticated');
  const [reason, setReason] = useState('');
  const [failure, setFailure] = useState<string | null>(null);

  /** `status` omis volontairement : la file doit aussi montrer les dossiers déjà traités. */
  const queue = useQuery({
    queryKey: queryKeys.verifications.queue({ limit: 200, all: true }),
    queryFn: () => verificationApi.adminQueue({ limit: 200, status: '' }).then((result) => result.data.items),
    enabled: isAuthenticated,
    retry: false,
  });

  const mission = (queue.data ?? []).find((item) => item.id === id);

  const decide = useMutation({
    mutationFn: (status: 'APPROVED' | 'REJECTED') =>
      verificationApi.decide(id!, { status, reason: reason.trim() || undefined }).then((result) => result.data),
    onSuccess: () => {
      setFailure(null);
      void queryClient.invalidateQueries({ queryKey: queryKeys.verifications.queue({ limit: 200, all: true }) });
      navigate('/reviewer/missions');
    },
    onError: (error) => {
      setFailure(error instanceof Error ? error.message : t('ui.decisionImpossible'));
    },
  });

  const checks = mission
    ? CHECKS.map((check) => ({
        ...check,
        done:
          check.key === 'subject'
            ? Boolean(mission.subjectType && mission.level)
            : check.key === 'documents'
              ? (mission.documents?.length ?? 0) > 0
              : check.key === 'organization'
                ? Boolean(mission.organizationId)
                : mission.status === 'PENDING',
      }))
    : [];

  const decided = mission ? mission.status !== 'PENDING' : false;

  return (
    <Section>
      <AuthGate isAuthenticated={isAuthenticated} title={t('ui.checklist')} description={t('ui.pointsDeControleDeLaMission')} icon="✅">
        <div style={{ marginBottom: 24 }}>
          <a href={`/reviewer/missions/${id}`} style={{ fontSize: 13, color: COLORS.slateGray, textDecoration: 'none' }}>{t('ui.retourALaMission')}</a>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: DURATION.slow / 1000, ease: EASE.out }}
          style={{ maxWidth: 720 }}
        >
          <Text preset="h1" style={{ marginBottom: 32 }}>{t('ui.checklistDeVerification')}</Text>

          {queue.isLoading ? (
            <LoadingState count={3} height={90} />
          ) : queue.isError ? (
            <ErrorState error={queue.error} onRetry={() => void queue.refetch()} showRequestId />
          ) : !mission ? (
            <EmptyState
              title={t('ui.missionIntrouvable')}
              description={t('ui.aucuneDemandeDeVerificationNeCorrespond')}
              icon="🛡️"
            />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <Card tone="white">
                <Text preset="h3" style={{ marginBottom: 12 }}>{t('ui.dossier')}</Text>
                <Text preset="bodyMd" style={{ fontWeight: 600, marginBottom: 4 }}>{t('ui.niveau', { subjectType: mission.subjectType, level: mission.level })}</Text>
                <Text preset="caption" color={COLORS.slateGray}>{t('ui.organisationDeposeeLe', { organizationId: mission.organizationId, createdAt: formatDate(mission.createdAt, locale) })}</Text>
                <div style={{ marginTop: 12 }}>
                  <ChipRow>
                    <Chip
                      label={mission.status}
                      tone={
                        mission.status === 'APPROVED'
                          ? 'success'
                          : mission.status === 'REJECTED'
                            ? 'error'
                            : 'warning'
                      }
                      size="sm"
                    />
                    {mission.reviewedAt ? (
                      <Chip label={t('ui.traiteeLe_0db96', { reviewedAt: formatDate(mission.reviewedAt, locale) })} tone="neutral" size="sm" />
                    ) : null}
                  </ChipRow>
                </div>
              </Card>

              <Card tone="white">
                <Text preset="h3" style={{ marginBottom: 16 }}>{t('ui.pointsDeControle')}</Text>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {checks.map((check) => (
                    <div
                      key={check.key}
                      style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}
                    >
                      <Text preset="bodySm" color={check.done ? COLORS.textPrimary : COLORS.slateGray}>
                        {check.label}
                      </Text>
                      <Chip label={check.done ? 'ok' : t('ui.aVerifier_231b9')} tone={check.done ? 'success' : 'warning'} size="sm" />
                    </div>
                  ))}
                </div>
                <Text preset="caption" color={COLORS.slateGray} style={{ marginTop: 16, lineHeight: 1.7 }}>{t('ui.cesPointsDecriventLEtatDu')}</Text>
              </Card>

              <Card tone="white">
                <Text preset="h3" style={{ marginBottom: 12 }}>{t('ui.piecesDeposees')}</Text>
                {!mission.documents || mission.documents.length === 0 ? (
                  <Text preset="caption" color={COLORS.slateGray}>{t('ui.aucunePieceJointeACetteDemande')}</Text>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {mission.documents.map((document, index) => (
                      <Text key={document.id ?? index} preset="caption" color={COLORS.textPrimary}>
                        {JSON.stringify(document)}
                      </Text>
                    ))}
                  </div>
                )}
              </Card>

              {decided ? (
                <Card tone="pale">
                  <Text preset="caption" color={COLORS.textPrimary} style={{ lineHeight: 1.7 }}>{t('ui.cetteDemandeADejaEteTraitee', { status: mission.status })}</Text>
                </Card>
              ) : (
                <Card tone="white">
                  <Text preset="h3" style={{ marginBottom: 12 }}>{t('ui.decision')}</Text>
                  <TextArea
                    label={t('ui.motif')}
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                    placeholder={t('ui.obligatoirePourUnRejetCeQui')}
                    rows={4}
                  />
                  <div style={{ display: 'flex', gap: 12, marginTop: 16, flexWrap: 'wrap' }}>
                    <Button
                      variant="primary"
                      label={t('ui.approuver')}
                      loading={decide.isPending && decide.variables === 'APPROVED'}
                      onClick={() => decide.mutate('APPROVED')}
                    />
                    <Button
                      variant="danger"
                      label={t('ui.rejeter')}
                      loading={decide.isPending && decide.variables === 'REJECTED'}
                      onClick={() => decide.mutate('REJECTED')}
                    />
                  </div>
                  {failure ? (
                    <Text preset="caption" color={COLORS.error} style={{ marginTop: 12 }}>
                      {failure}
                    </Text>
                  ) : null}
                  <Text preset="caption" color={COLORS.slateGray} style={{ marginTop: 12, lineHeight: 1.7 }}>{t('ui.touteDecisionEstTraceeAvecSon')}</Text>
                </Card>
              )}
            </div>
          )}
        </motion.div>
      </AuthGate>
    </Section>
  );
}
