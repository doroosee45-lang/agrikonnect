import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { AuthGate, Button, Card, CardBody, Chip, Input, Section, Text } from '@/components/ui';
import { adminApi } from '@/services/endpoints';
import { queryKeys } from '@/services/query';
import { useAuthStore } from '@/store/auth';
import { COLORS } from '@/theme';
import { useI18n, tr } from '@/i18n';
import { bcpLocale } from '@/lib/format';

type Dict = Record<string, unknown>;

const asDict = (value: unknown): Dict => (value && typeof value === 'object' ? (value as Dict) : {});
const asArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);
const asText = (value: unknown, repli = '—'): string => {
  if (typeof value === 'string' && value.length > 0) return value;
  if (typeof value === 'number') return String(value);
  return repli;
};

const formatDate = (value: unknown): string => {
  if (typeof value !== 'string' || !value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString(bcpLocale());
};

const ENTITES: Record<string, string> = {
  get listing() { return tr('ui.annoncesMarche'); },
  get review() { return tr('ui.avisClients'); },
  get verification() { return tr('ui.demandesDeVerification'); },
};

const DECISIONS: Record<string, { libelle: string; ton: 'success' | 'warning' | 'error' }> = {
  approve: { get libelle() { return tr('ui.approuver'); }, ton: 'success' },
  reject: { get libelle() { return tr('ui.refuser'); }, ton: 'error' },
  suspend: { get libelle() { return tr('ui.suspendre'); }, ton: 'warning' },
};

const messageErreur = (error: unknown): string => {
  const dict = asDict(error);
  return typeof dict.message === 'string' && dict.message ? dict.message : tr('ui.erreurInattendue');
};

/**
 * M4 U-M4-2 — modération unifiée des flux métier : liste filtrable, décision
 * motivée (approuver/refuser/suspendre) déléguée aux services existants
 * (RG-M4-1), notification de l'acteur concerné (RG-M4-2), export de la vue.
 */
export default function AdminOperations() {
  const { t } = useI18n();
  const isAuthenticated = useAuthStore((state) => state.status === 'authenticated');
  const queryClient = useQueryClient();
  const [entite, setEntite] = useState('listing');
  const [statut, setStatut] = useState('');
  const [motifs, setMotifs] = useState<Record<string, string>>({});
  const [avis, setAvis] = useState('');
  const [erreur, setErreur] = useState('');

  const filtres = { limit: 50, ...(statut ? { status: statut } : {}) };
  const file = useQuery({
    queryKey: queryKeys.admin.operations(entite, filtres),
    queryFn: () => adminApi.operationsList(entite, filtres).then((result) => result.data),
    enabled: isAuthenticated,
    retry: false,
    refetchInterval: 30000,
  });

  const moderer = useMutation({
    mutationFn: ({ id, decision }: { id: string; decision: 'approve' | 'reject' | 'suspend' }) =>
      adminApi.moderateOperation(entite, id, { decision, reason: motifs[id]?.trim() ?? '' }),
    onSuccess: (result, variables) => {
      setErreur('');
      const sortie = asDict(result.data);
      const apres = asDict(sortie.after);
      setAvis(
        t('ui.decisionRecorded', { decision: variables.decision, status: asText(apres.status), notified: sortie.notified === true ? t('ui.notifiedYes') : t('ui.notifiedNoUnknownOwner') }),
      );
      setMotifs((actuels) => {
        const copie = { ...actuels };
        delete copie[variables.id];
        return copie;
      });
      void queryClient.invalidateQueries({ queryKey: queryKeys.admin.operations(entite, filtres) });
    },
    onError: (error) => setErreur(messageErreur(error)),
  });

  const lignes = asArray(file.data).map(asDict);

  const exporterCsv = () => {
    const entetes = ['id', 'entity', 'label', 'status', 'createdAt'];
    const lignesCsv = lignes.map((item) =>
      entetes.map((cle) => {
        const valeur = cle === 'label' || cle === 'status' ? asText(item[cle], '') : String(item[cle] ?? '');
        return valeur.includes(',') || valeur.includes('"') ? `"${valeur.split('"').join('""')}"` : valeur;
      }).join(','),
    );
    const contenu = [entetes.join(','), ...lignesCsv].join(String.fromCharCode(10));
    const blob = new Blob([contenu], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const lien = document.createElement('a');
    lien.href = url;
    lien.download = `operations-${entite}.csv`;
    lien.click();
    URL.revokeObjectURL(url);
    setAvis(t('ui.exportDeLaVueGenereOperations', { entite }));
  };

  return (
    <Section>
      <AuthGate
        isAuthenticated={isAuthenticated}
        title={t('ui.operations_8d02b')}
        description={t('ui.moderationUnifieeDesFluxMetierListes')}
        icon="🗂️"
      >
        <Text preset="h1" style={{ marginBottom: 8 }}>{t('ui.operationsModerationUnifiee')}</Text>
        <Text preset="bodyMd" color={COLORS.slateGray} style={{ marginBottom: 24 }}>{t('ui.operationsIntro')}</Text>

        <Card style={{ marginBottom: 16 }}>
          <CardBody>
            <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}>
              <label style={{ display: 'grid', gap: 6 }}>
                <Text preset="caption" color={COLORS.slateGray}>{t('ui.fluxAModerer')}</Text>
                <select
                  value={entite}
                  onChange={(event) => {
                    setEntite(event.target.value);
                    setStatut('');
                    setAvis('');
                    setErreur('');
                  }}
                  style={{
                    padding: '10px 12px',
                    borderRadius: 10,
                    border: `1px solid ${COLORS.lightBorder}`,
                    background: COLORS.surface,
                    color: COLORS.textPrimary,
                    fontSize: 14,
                  }}
                >
                  {Object.entries(ENTITES).map(([cle, libelle]) => (
                    <option key={cle} value={cle}>
                      {libelle}
                    </option>
                  ))}
                </select>
              </label>
              <Input
                label={t('ui.filtreStatut')}
                placeholder={t('ui.exDraftPendingPublished')}
                value={statut}
                onChange={(event) => setStatut(event.target.value)}
              />
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
              <Button label={t('ui.actualiser')} variant="outline" size="sm" icon="⟳" onClick={() => void file.refetch()} />
              <Button label={t('ui.exporterLaVueCsv')} variant="outline" size="sm" onClick={exporterCsv} />
            </div>
          </CardBody>
        </Card>

        {avis ? (
          <Card style={{ marginBottom: 12 }}>
            <CardBody>
              <Text preset="bodySm">{avis}</Text>
            </CardBody>
          </Card>
        ) : null}
        {erreur ? (
          <Card style={{ marginBottom: 12 }}>
            <CardBody>
              <Text preset="bodySm">{erreur}</Text>
            </CardBody>
          </Card>
        ) : null}

        <div style={{ display: 'grid', gap: 12 }}>
          {file.isLoading ? (
            <Text preset="bodyMd" color={COLORS.slateGray}>{t('common.loading')}</Text>
          ) : lignes.length === 0 ? (
            <Text preset="bodyMd" color={COLORS.slateGray}>{t('ui.aucunElementAModererPourCe')}</Text>
          ) : (
            lignes.map((item) => {
              const id = asText(item.id, '');
              return (
                <Card key={id}>
                  <CardBody>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                      <Text preset="h3">{asText(item.label)}</Text>
                      <Chip label={asText(item.status)} tone="neutral" />
                      <Text preset="caption" color={COLORS.slateGray}>
                        {asText(item.entity)} · {formatDate(item.createdAt)} · id {id}
                      </Text>
                    </div>
                    <Input
                      label={t('ui.motifDeLaDecisionObligatoire')}
                      placeholder={t('ui.motifEcritIndispensablePourTouteDecision')}
                      value={motifs[id] ?? ''}
                      onChange={(event) => setMotifs({ ...motifs, [id]: event.target.value })}
                    />
                    <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                      {Object.entries(DECISIONS).map(([decision, meta]) => (
                        <Button
                          key={decision}
                          label={meta.libelle}
                          variant={decision === 'approve' ? 'primary' : decision === 'reject' ? 'danger' : 'outline'}
                          size="sm"
                          disabled={moderer.isPending || (motifs[id] ?? '').trim().length < 3}
                          onClick={() => moderer.mutate({ id, decision: decision as 'approve' | 'reject' | 'suspend' })}
                        />
                      ))}
                    </div>
                  </CardBody>
                </Card>
              );
            })
          )}
        </div>
      </AuthGate>
    </Section>
  );
}
