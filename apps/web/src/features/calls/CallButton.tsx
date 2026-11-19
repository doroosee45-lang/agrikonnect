import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import { Button, Card, ErrorState, LoadingState, Text } from '@/components/ui';
import { useI18n } from '@/i18n';
import { COLORS } from '@/theme';

import { callsApi } from './callsApi';
import { useCalls } from './useCalls';

/**
 * Bouton « Appel audio » d'une conversation. Invisible si les appels sont
 * désactivés. La liste des personnes vient du serveur (`/calls/eligible` :
 * membres actifs des organisations de la conversation) ; le serveur revérifie
 * chaque invitation à la création de l'appel.
 */
export function CallButton({ conversationId }: { conversationId: string }) {
  const { t } = useI18n();
  const config = useCalls((state) => state.config);
  const phase = useCalls((state) => state.phase);
  const appeler = useCalls((state) => state.appeler);
  const [ouvert, setOuvert] = useState(false);
  const [choisis, setChoisis] = useState<string[]>([]);

  const eligibles = useQuery({
    queryKey: ['calls', 'eligible', conversationId],
    queryFn: () => callsApi.eligible(conversationId).then((r) => r.data),
    enabled: ouvert && Boolean(config?.enabled),
    staleTime: 30_000,
  });

  if (!config?.enabled) return null;

  const occupe = !['idle', 'ended', 'error'].includes(phase);
  const max = eligibles.data?.maxInvitees ?? 1;

  const basculer = (userId: string) =>
    setChoisis((actuels) =>
      actuels.includes(userId) ? actuels.filter((id) => id !== userId) : actuels.length < max ? [...actuels, userId] : actuels,
    );

  const lancer = () => {
    const invites = choisis;
    setOuvert(false);
    setChoisis([]);
    void appeler(conversationId, invites);
  };

  return (
    <div style={{ position: 'relative' }}>
      <Button label={t('ui.appelAudio')} variant="outline" size="sm" disabled={occupe} onClick={() => setOuvert((v) => !v)} aria-expanded={ouvert} />
      {ouvert ? (
        <Card tone="white" style={{ position: 'absolute', right: 0, top: 'calc(100% + 8px)', zIndex: 50, width: 'min(340px, calc(100vw - 32px))', boxShadow: '0 8px 24px rgba(0,0,0,0.12)' }}>
          {eligibles.isLoading ? (
            <LoadingState count={2} height={36} />
          ) : eligibles.isError ? (
            <ErrorState error={eligibles.error} onRetry={() => void eligibles.refetch()} />
          ) : !eligibles.data?.callable ? (
            <Text preset="bodySm" color={COLORS.textPrimary}>{t('ui.appelConversationFermee')}</Text>
          ) : eligibles.data.people.length === 0 ? (
            <Text preset="bodySm" color={COLORS.textPrimary}>{t('ui.appelAucunePersonne')}</Text>
          ) : (
            <>
              <Text preset="bodySm" color={COLORS.textPrimary}>{t('ui.appelChoisirPersonnes', { max })}</Text>
              <ul style={{ listStyle: 'none', padding: 0, margin: '12px 0', maxHeight: 240, overflowY: 'auto' }}>
                {eligibles.data.people.map((personne) => (
                  <li key={personne.userId}>
                    <label style={{ display: 'flex', gap: 10, alignItems: 'center', minHeight: 44, cursor: 'pointer' }}>
                      <input type="checkbox" checked={choisis.includes(personne.userId)} onChange={() => basculer(personne.userId)} />
                      <span>
                        <Text preset="bodySm" color={COLORS.textPrimary}>{personne.name ?? '—'}</Text>
                        <Text preset="caption" color={COLORS.slateGray}>{personne.organizationName}</Text>
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <Button label={t('ui.appelFermer')} variant="ghost" size="sm" onClick={() => setOuvert(false)} />
                <Button label={t('ui.appelLancer')} size="sm" disabled={choisis.length === 0} onClick={lancer} />
              </div>
            </>
          )}
        </Card>
      ) : null}
    </div>
  );
}
