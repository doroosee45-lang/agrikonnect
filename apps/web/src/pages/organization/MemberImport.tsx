import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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
import { cooperativeApi } from '@/services/endpoints';
import { queryKeys } from '@/services/query';
import { useAuthStore } from '@/store/auth';
import { formatNumber } from '@/lib/format';
import { useI18n } from '@/i18n';
import { COLORS, DURATION, EASE } from '@/theme';

/**
 * ORGANIZATION — import en masse de membres (CSV).
 *
 * Deux temps imposés par le contrat serveur :
 * 1. **`dryRun: true`** — le fichier est analysé, rien n'est écrit. On affiche le
 *    décompte et les lignes en erreur avant de demander confirmation.
 * 2. **`dryRun: false`** — chaque ligne crée une invitation au statut `INVITED`.
 *
 * Aucun membre n'est « ajouté » : une invitation est émise, et le consentement
 * reste à donner par la personne concernée. Importer une liste ne vaut pas accord.
 */

const EXAMPLE_CSV = `email,consentscopes
producteur@example.com,profile|plots
productrice@example.com,profile`;

interface ImportSummary {
  totalLines: number;
  created: number;
  duplicates: number;
  errors: number;
  dryRun: boolean;
}

interface ImportRow {
  line: number;
  status: string;
  email?: string;
  reason?: string;
}

export default function OrganizationMemberImport() {
  const { t } = useI18n();
  const { locale } = useI18n();
  const queryClient = useQueryClient();
  const isAuthenticated = useAuthStore((state) => state.status === 'authenticated');
  const [csv, setCsv] = useState('');
  const [report, setReport] = useState<{ summary: ImportSummary; results: ImportRow[] } | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  const cooperative = useQuery({
    queryKey: queryKeys.cooperatives.current,
    queryFn: () => cooperativeApi.current().then((result) => result.data),
    enabled: isAuthenticated,
    retry: false,
  });

  const cooperativeId = cooperative.data?.id;

  const run = useMutation({
    mutationFn: (dryRun: boolean) =>
      cooperativeApi.importMembers(cooperativeId!, { csv, dryRun }).then((result) => result.data),
    onSuccess: (data) => {
      setFailure(null);
      setReport(data as unknown as { summary: ImportSummary; results: ImportRow[] });
      const summary = (data as unknown as { summary: ImportSummary }).summary;
      if (!summary.dryRun) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.cooperatives.members(cooperativeId!) });
        void queryClient.invalidateQueries({ queryKey: queryKeys.cooperatives.overview(cooperativeId!) });
      }
    },
    onError: (error) => {
      setReport(null);
      setFailure(error instanceof Error ? error.message : t('ui.importImpossible'));
    },
  });

  const summary = report?.summary;

  return (
    <Section>
      <AuthGate
        isAuthenticated={isAuthenticated}
        title={t('ui.importDeMembres')}
        description={t('ui.importezUneListeDeMembresDepuis')}
        icon="📥"
      >
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: DURATION.slow / 1000, ease: EASE.out }}
          style={{ maxWidth: 760 }}
        >
          <Text preset="h1" style={{ marginBottom: 8 }}>{t('ui.importDeMembres')}</Text>
          <Text preset="bodyMd" color={COLORS.slateGray} style={{ marginBottom: 32 }}>{t('ui.chaqueLigneEmetUneInvitationLe')}</Text>

          {cooperative.isLoading ? (
            <LoadingState count={2} height={100} />
          ) : cooperative.isError ? (
            <ErrorState error={cooperative.error} onRetry={() => void cooperative.refetch()} showRequestId />
          ) : !cooperativeId ? (
            <EmptyState
              title={t('ui.aucuneCooperative')}
              description={t('ui.votreOrganisationNEstRattacheeA')}
              icon="👥"
            />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <Card tone="white">
                <Text preset="h3" style={{ marginBottom: 12 }}>{t('ui.formatAttendu')}</Text>
                <Text preset="caption" color={COLORS.slateGray} style={{ lineHeight: 1.7, marginBottom: 12 }}>{t('ui.separateurVirguleOuPointVirguleLa')}{' '}<strong>email</strong>{' '}{t('ui.ou')}{' '}<strong>phone</strong>{t('ui.estObligatoireLaColonne')}{' '}<strong>consentscopes</strong>{' '}{t('ui.estFacultativePorteesSepareesPar')}{' '}<code>|</code>{t('ui.parmi')}{' '}<code>profile</code>, <code>plots</code>, <code>productions</code>, <code>soil</code>{t('ui.aDefautSeuleLaPortee')}{' '}<code>profile</code>{' '}{t('ui.estProposee')}</Text>
                <pre
                  style={{
                    margin: 0,
                    padding: 16,
                    borderRadius: 10,
                    background: COLORS.paleGreen,
                    fontSize: 12,
                    lineHeight: 1.7,
                    fontFamily: 'monospace',
                    color: COLORS.textPrimary,
                    overflowX: 'auto',
                  }}
                >
                  {EXAMPLE_CSV}
                </pre>
              </Card>

              <Card tone="white">
                <Text preset="h3" style={{ marginBottom: 12 }}>{t('ui.contenuDuFichier')}</Text>
                <TextArea
                  label={t('ui.contenuCsv')}
                  value={csv}
                  onChange={(event) => setCsv(event.target.value)}
                  placeholder={EXAMPLE_CSV}
                  rows={6}
                />
                <div style={{ display: 'flex', gap: 12, marginTop: 16, flexWrap: 'wrap' }}>
                  <Button
                    variant="outline"
                    label={t('ui.analyserSansEcrire')}
                    loading={run.isPending && run.variables === true}
                    onClick={() => run.mutate(true)}
                  />
                  <Button
                    variant="primary"
                    label={t('ui.emettreLesInvitations')}
                    loading={run.isPending && run.variables === false}
                    onClick={() => run.mutate(false)}
                  />
                </div>
                {failure ? (
                  <Text preset="caption" color={COLORS.error} style={{ marginTop: 12 }}>
                    {failure}
                  </Text>
                ) : null}
              </Card>

              {summary ? (
                <Card tone={summary.dryRun ? 'pale' : 'white'}>
                  <ChipRow style={{ marginBottom: 16 }}>
                    <Chip
                      label={summary.dryRun ? t('ui.analyseRienNAEteEcrit') : t('ui.invitationsEmises')}
                      tone={summary.dryRun ? 'warning' : 'success'}
                      size="sm"
                    />
                  </ChipRow>
                  <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap', marginBottom: 16 }}>
                    <div>
                      <Text preset="caption" color={COLORS.slateGray}>{t('ui.lignes')}</Text>
                      <Text preset="numeric">{formatNumber(summary.totalLines, locale)}</Text>
                    </div>
                    <div>
                      <Text preset="caption" color={COLORS.slateGray}>
                        {summary.dryRun ? t('ui.aCreer') : t('ui.creees')}
                      </Text>
                      <Text preset="numeric" color={COLORS.forestGreen}>
                        {formatNumber(summary.created, locale)}
                      </Text>
                    </div>
                    <div>
                      <Text preset="caption" color={COLORS.slateGray}>{t('ui.doublons')}</Text>
                      <Text preset="numeric">{formatNumber(summary.duplicates, locale)}</Text>
                    </div>
                    <div>
                      <Text preset="caption" color={COLORS.slateGray}>{t('ui.erreurs')}</Text>
                      <Text preset="numeric" color={summary.errors > 0 ? COLORS.error : COLORS.textPrimary}>
                        {formatNumber(summary.errors, locale)}
                      </Text>
                    </div>
                  </div>

                  {report && report.results.filter((row) => row.status !== 'created').length > 0 ? (
                    <div>
                      <Text preset="h4" style={{ marginBottom: 12 }}>{t('ui.lignesNonCreees')}</Text>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {report.results
                          .filter((row) => row.status !== 'created')
                          .slice(0, 20)
                          .map((row) => (
                            <div
                              key={`${row.line}-${row.email ?? ''}`}
                              style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}
                            >
                              <Text preset="caption" color={COLORS.textPrimary}>{t('ui.ligne', { line: row.line, value: row.email ? ` · ${row.email}` : '' })}</Text>
                              <Chip
                                label={row.reason ?? row.status}
                                tone={row.status === 'duplicate' ? 'neutral' : 'error'}
                                size="sm"
                              />
                            </div>
                          ))}
                      </div>
                    </div>
                  ) : null}
                </Card>
              ) : null}
            </div>
          )}
        </motion.div>
      </AuthGate>
    </Section>
  );
}
