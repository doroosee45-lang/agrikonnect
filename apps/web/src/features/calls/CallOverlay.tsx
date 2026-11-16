import { useEffect, useState } from 'react';

import { Button, Text } from '@/components/ui';
import { useI18n, type TranslationKey } from '@/i18n';
import { useAuthStore } from '@/store/auth';
import { COLORS } from '@/theme';

import type { CallErrorCode } from './callMachine';
import type { CallStatus } from './types';
import { useCalls } from './useCalls';

const MESSAGE_ERREUR: Record<CallErrorCode, TranslationKey> = {
  microphone: 'ui.appelErreurMicro',
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
 * Écran d'appel global (monté dans AppLayout). Ne rend rien tant que les appels
 * ne sont pas activés côté serveur (`GET /calls/config` → `enabled: true`).
 */
export function CallOverlay() {
  const { t } = useI18n();
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

  if (phase === 'idle' || !call && phase !== 'error') return null;

  const hote = call?.participants.find((p) => p.isHost);
  const autres = call?.participants.filter((p) => !p.isHost) ?? [];
  const interlocuteur = call?.me?.isHost
    ? autres.map((p) => p.name ?? t('ui.appelAudio')).join(', ')
    : hote?.name ?? t('ui.appelAudio');

  const titre = {
    incoming: t('ui.appelEntrant'),
    outgoing: t('ui.appelSonnerie'),
    connecting: t('ui.appelConnexion'),
    in_call: t('ui.appelEnCours'),
    reconnecting: t('ui.appelReconnexion'),
    ended: t(MESSAGE_FIN[endStatus ?? 'ENDED'] ?? 'ui.appelTermine'),
    error: t(MESSAGE_ERREUR[error ?? 'generic']),
    idle: '',
  }[phase];

  return (
    <div
      role={phase === 'incoming' ? 'alertdialog' : 'dialog'}
      aria-live="assertive"
      aria-label={titre}
      style={{
        position: 'fixed',
        right: 16,
        bottom: 16,
        left: 'auto',
        zIndex: 1000,
        width: 'min(360px, calc(100vw - 32px))',
        padding: 20,
        borderRadius: 'var(--radius-lg, 16px)',
        background: COLORS.pureWhite,
        boxShadow: '0 12px 40px rgba(0,0,0,0.18)',
        border: `1px solid ${COLORS.paleGreen}`,
      }}
    >
      <Text preset="caption" color={COLORS.slateGray}>{t('ui.appelAudio')}</Text>
      <Text preset="h4" color={COLORS.textPrimary} style={{ marginTop: 4 }}>{titre}</Text>
      {call && phase !== 'error' ? (
        <Text preset="bodySm" color={COLORS.textPrimary} style={{ marginTop: 6 }}>
          {interlocuteur}
          {phase === 'in_call' && call.startedAt ? ` · ${duree(call.startedAt, maintenant)}` : ''}
        </Text>
      ) : null}
      {call && call.participants.length > 2 ? (
        <Text preset="caption" color={COLORS.slateGray} style={{ marginTop: 4 }}>
          {t('ui.appelParticipants', { count: call.participants.length })}
        </Text>
      ) : null}

      <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
        {phase === 'incoming' ? (
          <>
            <Button label={t('ui.appelRepondre')} onClick={() => void accepter()} />
            <Button label={t('ui.appelRefuser')} variant="danger" onClick={() => void refuser()} />
          </>
        ) : null}
        {['outgoing', 'connecting', 'in_call', 'reconnecting'].includes(phase) ? (
          <>
            {phase !== 'outgoing' ? (
              <Button
                label={muted ? t('ui.appelActiverMicro') : t('ui.appelCouperMicro')}
                variant="outline"
                aria-pressed={muted}
                onClick={() => void basculerMicro()}
              />
            ) : null}
            <Button label={t('ui.appelRaccrocher')} variant="danger" onClick={() => void raccrocher()} />
          </>
        ) : null}
        {phase === 'ended' || phase === 'error' ? (
          <Button label={t('ui.appelFermer')} variant="ghost" onClick={fermer} />
        ) : null}
      </div>

      <Text preset="caption" color={COLORS.slateGray} style={{ marginTop: 12 }}>
        {t('ui.appelChiffrementTransport')}
      </Text>
    </div>
  );
}
