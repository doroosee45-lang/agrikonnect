import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';

import { Button, Card, ErrorState, LoadingState, Text } from '@/components/ui';
import { useI18n } from '@/i18n';
import { COLORS } from '@/theme/colors';

import { callsApi } from './callsApi';
import { useCalls } from './useCalls';

/**
 * « Appel audio » dans une conversation. Masqué si les appels ne sont pas
 * disponibles. Les personnes proposées viennent du serveur (membres actifs
 * des organisations de la conversation) ; il revérifie tout à la création.
 */
export function CallButton({ conversationId }: { conversationId: string }) {
  const { t } = useI18n();
  const disponible = useCalls((state) => state.disponible);
  const phase = useCalls((state) => state.phase);
  const appeler = useCalls((state) => state.appeler);
  const [ouvert, setOuvert] = useState(false);
  const [choisis, setChoisis] = useState<string[]>([]);

  const eligibles = useQuery({
    queryKey: ['calls', 'eligible', conversationId],
    queryFn: () => callsApi.eligible(conversationId).then((r) => r.data),
    enabled: ouvert && disponible,
    staleTime: 30_000,
  });

  if (!disponible) return null;

  const occupe = !['idle', 'ended', 'error'].includes(phase);
  const max = eligibles.data?.maxInvitees ?? 1;
  const basculer = (userId: string) =>
    setChoisis((actuels) =>
      actuels.includes(userId) ? actuels.filter((id) => id !== userId) : actuels.length < max ? [...actuels, userId] : actuels,
    );

  return (
    <View style={styles.racine}>
      <Button label={t('ui.appelAudio')} icon="call-outline" variant="outline" size="sm" disabled={occupe} onPress={() => setOuvert((v) => !v)} />
      {ouvert ? (
        <Card tone="white" style={styles.panneau}>
          {eligibles.isLoading ? (
            <LoadingState count={2} height={44} />
          ) : eligibles.isError ? (
            <ErrorState error={eligibles.error} onRetry={() => void eligibles.refetch()} />
          ) : !eligibles.data?.callable ? (
            <Text preset="bodySm">{t('ui.appelConversationFermee')}</Text>
          ) : eligibles.data.people.length === 0 ? (
            <Text preset="bodySm">{t('ui.appelAucunePersonne')}</Text>
          ) : (
            <>
              <Text preset="bodySm">{t('ui.appelChoisirPersonnes', { max })}</Text>
              {eligibles.data.people.map((personne) => {
                const coche = choisis.includes(personne.userId);
                return (
                  <Pressable
                    key={personne.userId}
                    onPress={() => basculer(personne.userId)}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: coche }}
                    style={styles.ligne}
                  >
                    <Ionicons name={coche ? 'checkbox' : 'square-outline'} size={22} color={COLORS.forestGreen} />
                    <View style={styles.personne}>
                      <Text preset="bodySm">{personne.name ?? '—'}</Text>
                      <Text preset="caption" color={COLORS.slateGray}>{personne.organizationName}</Text>
                    </View>
                  </Pressable>
                );
              })}
              <View style={styles.actions}>
                <Button label={t('ui.appelFermer')} variant="ghost" size="sm" onPress={() => setOuvert(false)} />
                <Button
                  label={t('ui.appelLancer')}
                  icon="call"
                  size="sm"
                  disabled={choisis.length === 0}
                  onPress={() => {
                    const invites = choisis;
                    setOuvert(false);
                    setChoisis([]);
                    void appeler(conversationId, invites);
                  }}
                />
              </View>
            </>
          )}
        </Card>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  racine: { gap: 8 },
  panneau: { gap: 8 },
  ligne: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44 },
  personne: { flex: 1 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
});
