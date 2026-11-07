import { useState } from 'react';
import { Pressable, Share, StyleSheet, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';

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

const SEVERITE_TONE: Record<string, 'error' | 'warning' | 'info'> = {
  haute: 'error',
  moyenne: 'warning',
  info: 'info',
};

/** M6 U-M6-1 — journal d'audit : recherche avancée, détail avant/après, export. */
export default function AdminAudit() {
  const isAuthenticated = useAuthStore((state) => state.status === 'authenticated');

  const [brouillon, setBrouillon] = useState({ action: '', actor: '', resource: '', from: '', to: '', severity: '' });
  const [filtres, setFiltres] = useState({ action: '', actor: '', resource: '', from: '', to: '', severity: '' });
  const [ouvert, setOuvert] = useState<string | null>(null);
  const [avis, setAvis] = useState('');
  const [erreur, setErreur] = useState('');

  const requete = {
    limit: 100,
    ...(filtres.action.trim() ? { action: filtres.action.trim() } : {}),
    ...(filtres.actor.trim() ? { actor: filtres.actor.trim() } : {}),
    ...(filtres.resource.trim() ? { resource: filtres.resource.trim() } : {}),
    ...(filtres.from ? { from: filtres.from } : {}),
    ...(filtres.to ? { to: filtres.to } : {}),
    ...(filtres.severity ? { severity: filtres.severity } : {}),
  };

  const journal = useQuery({
    queryKey: queryKeys.admin.audit(requete),
    queryFn: () => adminApi.audit(requete).then((result) => ({ lignes: result.data, meta: result.meta })),
    enabled: isAuthenticated,
    retry: false,
  });

  const lignes = asArray(journal.data ? journal.data.lignes : undefined).map(asDict);
  const meta = asDict(journal.data ? journal.data.meta : undefined);

  const exporter = async (format: 'csv' | 'json') => {
    setAvis('');
    setErreur('');
    try {
      const sortie = await adminApi.auditExport({ ...requete, format });
      await Share.share({ message: sortie.content });
      setAvis(`Export généré : ${sortie.filename}`);
    } catch (caught) {
      const dict = asDict(caught);
      setErreur(typeof dict.message === 'string' && dict.message ? dict.message : 'Export impossible');
    }
  };

  return (
    <Screen background={COLORS.naturalWhite}>
      <AppHeader title="Journal d'audit" subtitle="Actions sensibles — recherche avancée, détail avant/après, export (U-M6-1)." />
      <Section bare contentStyle={styles.section}>
        <AuthGate isAuthenticated={isAuthenticated} title="Journal d'audit" icon="time-outline">
          <View style={styles.list}>
            <Text preset="caption" color={COLORS.slateGray}>
              Recherche par acteur, action, ressource, date et gravité. Le journal est en insertion seule (RG-S2) :
              aucune entrée n'est modifiable ni supprimable ; les exports sont eux-mêmes journalisés (admin.audit.export).
            </Text>
            <Input
              label="Action"
              placeholder="Ex. : auth.login"
              value={brouillon.action}
              onChangeText={(texte) => setBrouillon({ ...brouillon, action: texte })}
              icon="flash-outline"
            />
            <Input
              label="Acteur"
              placeholder="E-mail, nom ou identifiant"
              value={brouillon.actor}
              onChangeText={(texte) => setBrouillon({ ...brouillon, actor: texte })}
              icon="person-outline"
            />
            <Input
              label="Ressource"
              placeholder="Ex. : profile"
              value={brouillon.resource}
              onChangeText={(texte) => setBrouillon({ ...brouillon, resource: texte })}
              icon="cube-outline"
            />
            <Input
              label="Du"
              placeholder="AAAA-MM-JJ"
              value={brouillon.from}
              onChangeText={(texte) => setBrouillon({ ...brouillon, from: texte })}
              icon="calendar-outline"
            />
            <Input
              label="Au"
              placeholder="AAAA-MM-JJ"
              value={brouillon.to}
              onChangeText={(texte) => setBrouillon({ ...brouillon, to: texte })}
              icon="calendar-outline"
            />
            <Text preset="caption" color={COLORS.slateGray}>Gravité</Text>
            <View style={styles.chips}>
              {['', 'haute', 'moyenne', 'info'].map((valeur) => (
                <FilterChip
                  key={valeur || 'toutes'}
                  label={valeur || 'Toutes'}
                  active={brouillon.severity === valeur}
                  onPress={() => setBrouillon({ ...brouillon, severity: valeur })}
                />
              ))}
            </View>
            <View style={styles.actions}>
              <Button label="Rechercher" size="sm" onPress={() => setFiltres({ ...brouillon })} />
              <Button
                label="Réinitialiser"
                variant="outline"
                size="sm"
                onPress={() => {
                  const vide = { action: '', actor: '', resource: '', from: '', to: '', severity: '' };
                  setBrouillon(vide);
                  setFiltres(vide);
                }}
              />
            </View>
            <View style={styles.actions}>
              <Button label="Exporter CSV" variant="outline" size="sm" onPress={() => void exporter('csv')} />
              <Button label="Exporter JSON" variant="outline" size="sm" onPress={() => void exporter('json')} />
            </View>

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

            <Text preset="caption" color={COLORS.slateGray}>
              page {typeof meta.page === 'number' ? meta.page : '—'} · {lignes.length} entrées affichées · total{' '}
              {typeof meta.total === 'number' ? meta.total : '—'}
            </Text>

            {journal.isLoading ? (
              <LoadingState count={3} height={80} />
            ) : journal.isError ? (
              <ErrorState error={journal.error} onRetry={() => void journal.refetch()} />
            ) : lignes.length === 0 ? (
              <EmptyState title="Journal vide" description="Aucune entrée d'audit pour ces critères." icon="time-outline" />
            ) : (
              lignes.map((ligne, index) => {
                const cle = asText(ligne.id, `entree-${String(index)}`);
                const acteur = asDict(ligne.actor);
                const nomActeur = [acteur.firstName, acteur.lastName].filter(Boolean).join(' ');
                return (
                  <Card key={cle} tone="white">
                    <View style={styles.rowHead}>
                      <Chip
                        label={asText(ligne.severity, 'info')}
                        tone={SEVERITE_TONE[asText(ligne.severity, 'info')] ?? 'info'}
                        size="sm"
                      />
                      <Text preset="bodySm">{asText(ligne.action)}</Text>
                    </View>
                    <Text preset="caption" color={COLORS.slateGray}>
                      {asText(ligne.resource)} · {formatDate(String(ligne.createdAt ?? ''))} · {nomActeur || asText(ligne.actorId)}
                    </Text>
                    <Pressable onPress={() => setOuvert(ouvert === cle ? null : cle)}>
                      <Text preset="caption" color={COLORS.forestGreen}>
                        {ouvert === cle ? 'Masquer' : 'Détail'}
                      </Text>
                    </Pressable>
                    {ouvert === cle ? (
                      <View style={styles.detail}>
                        <Text preset="caption" color={COLORS.slateGray}>
                          Identifiant : {cle} · Ressource : {asText(ligne.resource)} ({asText(ligne.resourceId)}) ·
                          Adresse IP : {asText(ligne.ip)} · Agent : {asText(ligne.userAgent)}
                        </Text>
                        <Text preset="caption" color={COLORS.slateGray}>Avant</Text>
                        <Text preset="caption">
                          {ligne.oldValue === null || ligne.oldValue === undefined ? '—' : JSON.stringify(ligne.oldValue, null, 2)}
                        </Text>
                        <Text preset="caption" color={COLORS.slateGray}>Après</Text>
                        <Text preset="caption">
                          {ligne.newValue === null || ligne.newValue === undefined ? '—' : JSON.stringify(ligne.newValue, null, 2)}
                        </Text>
                      </View>
                    ) : null}
                  </Card>
                );
              })
            )}
          </View>
        </AuthGate>
      </Section>
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { paddingTop: SPACING.sm, paddingBottom: SPACING.xxl, gap: SPACING.md },
  list: { gap: SPACING.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  rowHead: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: 4 },
  detail: { gap: 4, marginTop: SPACING.sm },
});
