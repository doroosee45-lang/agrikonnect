import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Text } from '@/components/ui';
import { useI18n, type TranslationKey } from '@/i18n';
import { useAuthStore } from '@/store/auth';
import { COLORS } from '@/theme/colors';

import type { CallErrorCode, CallPhase } from './callMachine';
import type { CallStatus } from './types';
import { useCalls } from './useCalls';

const MESSAGE_ERREUR: Record<CallErrorCode, TranslationKey> = {
  microphone: 'ui.appelErreurMicroAppareil',
  network: 'ui.appelErreurReseau',
  unavailable: 'ui.appelErreurIndisponible',
  generic: 'ui.appelErreurGenerique',
};

const MESSAGE_FIN: Partial<Record<CallStatus, TranslationKey>> = {
  MISSED: 'ui.appelManque',
  DECLINED: 'ui.appelRefuse',
  CANCELLED: 'ui.appelAnnule',
};

const duree = (depuis: string | null, maintenant: number) => {
  if (!depuis) return '';
  const secondes = Math.max(0, Math.floor((maintenant - new Date(depuis).getTime()) / 1000));
  return `${Math.floor(secondes / 60)}:${String(secondes % 60).padStart(2, '0')}`;
};

/**
 * Bandeau d'appel au premier plan (monté à la racine). Rien n'est rendu tant
 * que les appels ne sont pas disponibles (serveur + build natif).
 */
export function CallOverlay() {
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const authentifie = useAuthStore((state) => state.status === 'authenticated');
  const { phase, call, muted, error, endStatus, demarrer, arreter, accepter, refuser, raccrocher, basculerMicro, fermer } = useCalls();
  const [maintenant, setMaintenant] = useState(() => Date.now());

  useEffect(() => {
    if (authentifie) void demarrer();
    else arreter();
  }, [authentifie, demarrer, arreter]);

  useEffect(() => {
    if (phase !== 'in_call') return;
    const minuteur = setInterval(() => setMaintenant(Date.now()), 1000);
    return () => clearInterval(minuteur);
  }, [phase]);

  if (phase === 'idle' || (!call && phase !== 'error')) return null;

  const hote = call?.participants.find((p) => p.isHost);
  const autres = call?.participants.filter((p) => !p.isHost) ?? [];
  const interlocuteur = call?.me?.isHost
    ? autres.map((p) => p.name ?? t('ui.appelAudio')).join(', ')
    : hote?.name ?? t('ui.appelAudio');

  const titre: Record<CallPhase, string> = {
    incoming: t('ui.appelEntrant'),
    outgoing: t('ui.appelSonnerie'),
    connecting: t('ui.appelConnexion'),
    in_call: t('ui.appelEnCours'),
    reconnecting: t('ui.appelReconnexion'),
    ended: t(MESSAGE_FIN[endStatus ?? 'ENDED'] ?? 'ui.appelTermine'),
    error: t(MESSAGE_ERREUR[error ?? 'generic']),
    idle: '',
  };
  const enCommunication = ['outgoing', 'connecting', 'in_call', 'reconnecting'].includes(phase);

  return (
    <View
      style={[styles.panneau, { top: insets.top + 8 }]}
      accessibilityRole="alert"
      accessibilityLiveRegion="assertive"
      accessibilityLabel={titre[phase]}
    >
      <Text preset="caption" color={COLORS.slateGray}>{t('ui.appelAudio')}</Text>
      <Text preset="h3">{titre[phase]}</Text>
      {call && phase !== 'error' ? (
        <Text preset="bodySm">
          {interlocuteur}
          {phase === 'in_call' && call.startedAt ? ` · ${duree(call.startedAt, maintenant)}` : ''}
        </Text>
      ) : null}
      {call && call.participants.length > 2 ? (
        <Text preset="caption" color={COLORS.slateGray}>{t('ui.appelParticipants', { count: call.participants.length })}</Text>
      ) : null}

      <View style={styles.actions}>
        {phase === 'incoming' ? (
          <>
            <Button label={t('ui.appelRepondre')} icon="call" onPress={() => void accepter()} />
            <Button label={t('ui.appelRefuser')} variant="danger" onPress={() => void refuser()} />
          </>
        ) : null}
        {enCommunication ? (
          <>
            {phase !== 'outgoing' ? (
              <Button
                label={muted ? t('ui.appelActiverMicro') : t('ui.appelCouperMicro')}
                icon={muted ? 'mic-off' : 'mic'}
                variant="outline"
                onPress={() => void basculerMicro()}
              />
            ) : null}
            <Button label={t('ui.appelRaccrocher')} variant="danger" onPress={() => void raccrocher()} />
          </>
        ) : null}
        {phase === 'ended' || phase === 'error' ? <Button label={t('ui.appelFermer')} variant="ghost" onPress={fermer} /> : null}
      </View>
      <Text preset="caption" color={COLORS.slateGray}>{t('ui.appelChiffrementTransport')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  panneau: {
    position: 'absolute',
    left: 12,
    right: 12,
    zIndex: 1000,
    elevation: 12,
    gap: 6,
    padding: 16,
    borderRadius: 16,
    backgroundColor: COLORS.pureWhite,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
  },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
});
