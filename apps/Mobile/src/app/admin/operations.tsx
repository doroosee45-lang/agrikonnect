import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { AppHeader } from '@/components/app/AppHeader';
import { AuthGate, Button, Card, Chip, EmptyState, ErrorState, FilterChip, Input, LoadingState, Screen, Section, Text } from '@/components/ui';
import { formatDate } from '@/lib/format';
import { adminApi } from '@/services/api/endpoints';
import { queryKeys } from '@/services/query';
import { useAuthStore } from '@/store/auth';
import { COLORS } from '@/theme/colors';
import { SPACING } from '@/theme/space';

type Dict = Record<string, unknown>;

const asDict = (value: unknown): Dict => (value && typeof value === 'object' ? (value as Dict) : {});
const asArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);
const asText = (value: unknown, repli = '—'): string => {
  if (typeof value === 'string' && value.length > 0) return value;
  if (typeof value === 'number') return String(value);
  return repli;
};

const ENTITES: Record<string, string> = {
  listing: 'Annonces (marché)',
  review: 'Avis clients',
  verification: 'Demandes de vérification',
};

const DECISIONS: Array<{ cle: 'approve' | 'reject' | 'suspend'; libelle: string; variante: 'primary' | 'outline' | 'danger' }> = [
  { cle: 'approve', libelle: 'Approuver', variante: 'primary' },
  { cle: 'reject', libelle: 'Refuser', variante: 'danger' },
  { cle: 'suspend', libelle: 'Suspendre', variante: 'outline' },
];

const messageErreur = (error: unknown): string => {
  const dict = asDict(error);
  return typeof dict.message === 'string' && dict.message ? dict.message : 'Erreur inattendue';
};

/**
 * M4 U-M4-2 — modération unifiée des flux métier : liste filtrable, décision
 * motivée (approuver/refuser/suspendre) déléguée aux services existants
 * (RG-M4-1), notification de l'acteur concerné (RG-M4-2).
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

  return (
    <Screen background={COLORS.naturalWhite}>
      <AppHeader title="Opérations" subtitle="Modération unifiée des flux métier : listes, décisions motivées, notifications (U-M4-2)." />
      <Section bare contentStyle={styles.section}>
        <AuthGate isAuthenticated={isAuthenticated} title="Opérations" icon="folder-open-outline">
          {file.isLoading ? (
            <LoadingState count={3} height={110} />
          ) : file.isError ? (
            <ErrorState error={file.error} onRetry={() => void file.refetch()} />
          ) : (
            <View style={styles.list}>
              <Text preset="caption" color={COLORS.slateGray}>
                Chaque décision est motivée puis déléguée au service métier concerné (RG-M4-1 : aucune
                écriture directe) ; l'acteur concerné reçoit une notification et l'action est auditée (RG-M4-2).
                La suspension n'est pas applicable aux demandes de vérification.
              </Text>

              <Text preset="caption" color={COLORS.slateGray}>Flux à modérer</Text>
              <View style={styles.chips}>
                {Object.entries(ENTITES).map(([cle, libelle]) => (
                  <FilterChip
                    key={cle}
                    label={libelle}
                    active={entite === cle}
                    onPress={() => {
                      setEntite(cle);
                      setStatut('');
                      setAvis('');
                      setErreur('');
                    }}
                  />
                ))}
              </View>
              <Input
                label="Filtre statut"
                placeholder="Ex. : DRAFT, PENDING, PUBLISHED…"
                value={statut}
                onChangeText={setStatut}
                icon="filter-outline"
              />
              <Button label="Actualiser" variant="outline" size="sm" icon="refresh-outline" onPress={() => void file.refetch()} />

              {avis ? (
                <Card tone="white">
                  <Text preset="caption">{avis}</Text>
                </Card>
              ) : null}
              {erreur ? (
                <Card tone="white">
                  <Text preset="caption" color={COLORS.slateGray}>{erreur}</Text>
                </Card>
              ) : null}

              {lignes.length === 0 ? (
                <EmptyState title="Aucun élément" description="Aucun élément à modérer pour ce flux." icon="folder-open-outline" />
              ) : (
                lignes.map((item) => {
                  const id = asText(item.id, '');
                  return (
                    <Card key={id} tone="white">
                      <View style={styles.rowHead}>
                        <Text preset="bodySm">{asText(item.label)}</Text>
                        <Chip label={asText(item.status)} tone="neutral" size="sm" />
                      </View>
                      <Text preset="caption" color={COLORS.slateGray}>
                        {asText(item.entity)} · {formatDate(String(item.createdAt ?? ''))} · id {id}
                      </Text>
                      <Input
                        label="Motif de la décision (obligatoire)"
                        placeholder="Motif écrit — indispensable pour toute décision"
                        value={motifs[id] ?? ''}
                        onChangeText={(texte) => setMotifs({ ...motifs, [id]: texte })}
                        icon="pencil-outline"
                      />
                      <View style={styles.actions}>
                        {DECISIONS.map((meta) => (
                          <Button
                            key={meta.cle}
                            label={meta.libelle}
                            variant={meta.variante}
                            size="sm"
                            disabled={moderer.isPending || (motifs[id] ?? '').trim().length < 3}
                            onPress={() => moderer.mutate({ id, decision: meta.cle })}
                          />
                        ))}
                      </View>
                    </Card>
                  );
                })
              )}
            </View>
          )}
        </AuthGate>
      </Section>
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { paddingTop: SPACING.sm, paddingBottom: SPACING.xxl, gap: SPACING.md },
  list: { gap: SPACING.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  rowHead: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: 4 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, marginTop: SPACING.sm },
});
