import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { AuthGate, Button, Card, CardBody, Chip, Input, Section, Text } from '@/components/ui';
import { adminApi } from '@/services/endpoints';
import { queryKeys } from '@/services/query';
import { useAuthStore } from '@/store/auth';
import { COLORS } from '@/theme';

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
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('fr-FR');
};

const ENTITES: Record<string, string> = {
  listing: 'Annonces (marché)',
  review: 'Avis clients',
  verification: 'Demandes de vérification',
};

const DECISIONS: Record<string, { libelle: string; ton: 'success' | 'warning' | 'error' }> = {
  approve: { libelle: 'Approuver', ton: 'success' },
  reject: { libelle: 'Refuser', ton: 'error' },
  suspend: { libelle: 'Suspendre', ton: 'warning' },
};

const messageErreur = (error: unknown): string => {
  const dict = asDict(error);
  return typeof dict.message === 'string' && dict.message ? dict.message : 'Erreur inattendue';
};

/**
 * M4 U-M4-2 — modération unifiée des flux métier : liste filtrable, décision
 * motivée (approuver/refuser/suspendre) déléguée aux services existants
 * (RG-M4-1), notification de l'acteur concerné (RG-M4-2), export de la vue.
 */
export default function AdminOperations() {
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
        `Décision « ${variables.decision} » enregistrée — statut : ${asText(apres.status)} · acteur notifié : ${sortie.notified === true ? 'oui' : 'non (propriétaire inconnu)'}.`,
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
    setAvis(`Export de la vue généré : operations-${entite}.csv`);
  };

  return (
    <Section>
      <AuthGate
        isAuthenticated={isAuthenticated}
        title="Opérations"
        description="Modération unifiée des flux métier : listes, décisions motivées, notifications (U-M4-2)."
        icon="🗂️"
      >
        <Text preset="h1" style={{ marginBottom: 8 }}>
          Opérations — modération unifiée
        </Text>
        <Text preset="bodyMd" color={COLORS.slateGray} style={{ marginBottom: 24 }}>
          Chaque décision est **motivée** puis déléguée au service métier concerné (RG-M4-1 : aucune
          écriture directe) ; l'acteur concerné reçoit une notification et l'action est auditée (RG-M4-2).
          La suspension n'est pas applicable aux demandes de vérification.
        </Text>

        <Card style={{ marginBottom: 16 }}>
          <CardBody>
            <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}>
              <label style={{ display: 'grid', gap: 6 }}>
                <Text preset="caption" color={COLORS.slateGray}>
                  Flux à modérer
                </Text>
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
                label="Filtre statut"
                placeholder="Ex. : DRAFT, PENDING, PUBLISHED…"
                value={statut}
                onChange={(event) => setStatut(event.target.value)}
              />
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
              <Button label="Actualiser" variant="outline" size="sm" icon="⟳" onClick={() => void file.refetch()} />
              <Button label="Exporter la vue (CSV)" variant="outline" size="sm" onClick={exporterCsv} />
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
            <Text preset="bodyMd" color={COLORS.slateGray}>
              Chargement…
            </Text>
          ) : lignes.length === 0 ? (
            <Text preset="bodyMd" color={COLORS.slateGray}>
              Aucun élément à modérer pour ce flux.
            </Text>
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
                      label="Motif de la décision (obligatoire)"
                      placeholder="Motif écrit — indispensable pour toute décision"
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
