import { useState } from 'react';
import { motion } from 'framer-motion';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { AuthGate, Button, Card, Chip, EmptyState, ErrorState, LoadingState, Section, Text, TextArea } from '@/components/ui';
import { aiApi } from '@/services/endpoints';
import { queryKeys } from '@/services/query';
import { useAuthStore } from '@/store/auth';
import { formatDate } from '@/lib/format';
import { useI18n } from '@/i18n';
import { COLORS, DURATION, EASE } from '@/theme';

export default function Ai() {
  const { locale } = useI18n();
  const queryClient = useQueryClient();
  const isAuthenticated = useAuthStore((state) => state.status === 'authenticated');
  const [consent, setConsent] = useState(false);
  const [question, setQuestion] = useState('');
  const [error, setError] = useState<unknown>(null);

  const analyses = useQuery({
    queryKey: queryKeys.ai.list({}),
    queryFn: () => aiApi.list({ limit: 20 }).then((result) => result.data),
    enabled: isAuthenticated,
  });

  const copilot = useMutation({
    mutationFn: () => aiApi.copilot({ question: question.trim() }),
    onSuccess: () => {
      setError(null);
      setQuestion('');
      void queryClient.invalidateQueries({ queryKey: queryKeys.ai.list({}) });
    },
    onError: (caught) => setError(caught),
  });

  const escalate = useMutation({
    mutationFn: (id: string) => aiApi.escalate(id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: queryKeys.ai.list({}) }),
    onError: (caught) => setError(caught),
  });

  return (
    <Section>
      <AuthGate
        isAuthenticated={isAuthenticated}
        title="Assistance IA"
        description="Connectez-vous pour poser vos questions agronomiques et générer des documents."
        icon="✨"
      >
        <div style={{ marginBottom: 32 }}>
          <Text preset="h1" style={{ marginBottom: 8 }}>
            Assistance IA
          </Text>
          <Text preset="bodyMd" color={COLORS.slateGray}>
            Analyses de cultures, documents et copilote — avec avertissement systématique et escalade humaine.
          </Text>
        </div>

        <Card tone="pale" style={{ marginBottom: 24, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <span style={{ fontSize: 20 }}>⚠️</span>
          <Text preset="caption" color={COLORS.textPrimary} style={{ lineHeight: 1.7 }}>
            Les réponses de l'IA sont des estimations, pas des conseils agronomiques validés. Elles ne remplacent
            jamais l'avis d'un agronome identifié. Toute analyse peut être escaladée vers un humain.
          </Text>
        </Card>

        <Card tone="white" style={{ marginBottom: 32 }}>
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 20, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              style={{ marginTop: 3, width: 18, height: 18, accentColor: COLORS.forestGreen }}
            />
            <span>
              <Text preset="bodySm" color={COLORS.textPrimary} style={{ fontWeight: 600 }}>
                J'accepte que mes questions soient traitées par un modèle d'IA
              </Text>
              <Text preset="caption" color={COLORS.slateGray}>
                Consentement requis (AI-01). Réversible à tout moment depuis votre profil.
              </Text>
            </span>
          </label>

          <TextArea
            label="Votre question"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ex. : quelles pratiques de conservation des sols pour une parcelle argileuse en zone soudanienne ?"
            minHeight={110}
            maxLength={1000}
            disabled={!consent}
          />

          {error ? (
            <div style={{ marginTop: 16 }}>
              <ErrorState error={error} showRequestId />
            </div>
          ) : null}

          <div style={{ marginTop: 16, display: 'flex', gap: 12, alignItems: 'center' }}>
            <Button
              label="Poser la question"
              onClick={() => copilot.mutate()}
              disabled={!consent || question.trim().length < 3}
              loading={copilot.isPending}
            />
            <Text preset="caption" color={COLORS.slateGray}>
              {question.length}/1000 caractères
            </Text>
          </div>
        </Card>

        <Text preset="h3" style={{ marginBottom: 16 }}>
          Historique des analyses
        </Text>
        {analyses.isLoading ? (
          <LoadingState count={2} height={90} />
        ) : analyses.isError ? (
          <ErrorState error={analyses.error} onRetry={() => void analyses.refetch()} />
        ) : (analyses.data ?? []).length === 0 ? (
          <EmptyState title="Aucune analyse" description="Vos questions et analyses apparaîtront ici." icon="✨" />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {(analyses.data ?? []).map((item, index) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: DURATION.base / 1000, delay: index * 0.03, ease: EASE.out }}
              >
                <Card tone="white">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 8 }}>
                    <Text preset="bodyMd" color={COLORS.textPrimary} style={{ fontWeight: 600, flex: 1 }}>
                      {item.prompt ?? `Analyse ${item.type}`}
                    </Text>
                    <Chip label={item.status} tone={item.status === 'ESCALATED' ? 'warning' : 'info'} size="sm" />
                  </div>
                  <Text preset="caption" color={COLORS.slateGray}>
                    {item.type} · {formatDate(item.createdAt, locale)}
                  </Text>
                  {item.disclaimer ? (
                    <Text preset="caption" color={COLORS.warning} style={{ marginTop: 8, lineHeight: 1.6 }}>
                      {item.disclaimer}
                    </Text>
                  ) : null}
                  {item.status !== 'ESCALATED' ? (
                    <Button
                      label="Escalader vers un agronome"
                      onClick={() => escalate.mutate(item.id)}
                      variant="ghost"
                      size="sm"
                      style={{ marginTop: 12 }}
                      loading={escalate.isPending && escalate.variables === item.id}
                    />
                  ) : null}
                </Card>
              </motion.div>
            ))}
          </div>
        )}
      </AuthGate>
    </Section>
  );
}
