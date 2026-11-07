import { useState } from 'react';
import { motion } from 'framer-motion';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';

import { AuthGate, Button, Card, Chip, ChipRow, ErrorState, LoadingState, Section, Text, TextArea } from '@/components/ui';
import { listingApi } from '@/services/endpoints';
import { queryKeys } from '@/services/query';
import { useAuthStore } from '@/store/auth';
import { formatCurrency, formatDate, formatNumber } from '@/lib/format';
import { useI18n } from '@/i18n';
import { COLORS, DURATION, EASE } from '@/theme';

export default function AnnonceDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { locale } = useI18n();
  const isAuthenticated = useAuthStore((state) => state.status === 'authenticated');
  const [message, setMessage] = useState('');
  const [error, setError] = useState<unknown>(null);

  const listing = useQuery({
    queryKey: queryKeys.listings.one(id!),
    queryFn: () => listingApi.get(id!).then((result) => result.data),
    enabled: isAuthenticated && Boolean(id),
  });

  const contact = useMutation({
    mutationFn: () => listingApi.contact(id!, message.trim() || undefined),
    onSuccess: () => {
      setError(null);
      navigate('/messages');
    },
    onError: (caught) => setError(caught),
  });

  const item = listing.data;

  return (
    <Section>
      <AuthGate
        isAuthenticated={isAuthenticated}
        title="Connexion requise"
        description="Connectez-vous pour consulter cette annonce et contacter le vendeur."
        icon="📦"
      >
        <div style={{ marginBottom: 24 }}>
          <Link to="/market/listings" style={{ fontSize: 13, color: COLORS.slateGray, textDecoration: 'none' }}>
            ← Retour aux annonces
          </Link>
        </div>

        {listing.isLoading ? (
          <LoadingState count={2} height={140} />
        ) : listing.isError ? (
          <ErrorState error={listing.error} onRetry={() => void listing.refetch()} />
        ) : !item ? null : (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: DURATION.slow / 1000, ease: EASE.out }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)', gap: 24, alignItems: 'start' }}>
              <Card tone="white">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, marginBottom: 16 }}>
                  <div>
                    <Text preset="h1" style={{ marginBottom: 8 }}>
                      {item.title}
                    </Text>
                    <Text preset="caption" color={COLORS.slateGray}>
                      {item.countryCode}
                      {item.province ? ` · ${item.province}` : ''} · publiée le {formatDate(item.createdAt, locale)}
                      {item.expiresAt ? ` · expire le ${formatDate(item.expiresAt, locale)}` : ''}
                    </Text>
                  </div>
                  <Chip
                    label={item.status}
                    tone={item.status === 'PUBLISHED' ? 'success' : item.status === 'EXPIRED' ? 'warning' : 'neutral'}
                  />
                </div>

                <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap', marginBottom: 24 }}>
                  <div>
                    <Text preset="caption" color={COLORS.slateGray}>
                      Quantité
                    </Text>
                    <Text preset="numeric" color={COLORS.forestGreen}>
                      {formatNumber(item.quantity, locale, 1)} <span style={{ fontSize: 16, fontWeight: 400 }}>{item.unit}</span>
                    </Text>
                  </div>
                  <div>
                    <Text preset="caption" color={COLORS.slateGray}>
                      Prix indicatif
                    </Text>
                    <Text preset="numeric" color={COLORS.forestGreen}>
                      {item.indicativePrice !== null ? formatCurrency(item.indicativePrice, item.currency, locale) : 'Non communiqué'}
                    </Text>
                  </div>
                  {item.quality ? (
                    <div>
                      <Text preset="caption" color={COLORS.slateGray}>
                        Qualité
                      </Text>
                      <Text preset="bodyLg" color={COLORS.textPrimary}>
                        {item.quality}
                      </Text>
                    </div>
                  ) : null}
                </div>

                {item.description ? (
                  <Text preset="bodyMd" color={COLORS.slateGray} style={{ lineHeight: 1.7, marginBottom: 20 }}>
                    {item.description}
                  </Text>
                ) : null}

                {item.certifications.length > 0 ? (
                  <div style={{ marginBottom: 20 }}>
                    <Text preset="overline" color={COLORS.forestGreen} style={{ marginBottom: 8 }}>
                      Certifications
                    </Text>
                    <ChipRow>
                      {item.certifications.map((certification) => (
                        <Chip key={certification} label={certification} tone="success" size="sm" />
                      ))}
                    </ChipRow>
                  </div>
                ) : null}

                {item.conditions ? (
                  <div style={{ marginBottom: 20 }}>
                    <Text preset="overline" color={COLORS.forestGreen} style={{ marginBottom: 8 }}>
                      Conditions
                    </Text>
                    <Text preset="bodyMd" color={COLORS.slateGray} style={{ lineHeight: 1.7 }}>
                      {item.conditions}
                    </Text>
                  </div>
                ) : null}

                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <Chip label={`Type : ${item.type}`} tone="neutral" size="sm" />
                  <Chip label={`Source : ${item.source}`} tone="neutral" size="sm" />
                  {item.availableFrom ? <Chip label={`Disponible dès ${formatDate(item.availableFrom, locale)}`} tone="info" size="sm" /> : null}
                  {item.availableTo ? <Chip label={`Jusqu'au ${formatDate(item.availableTo, locale)}`} tone="info" size="sm" /> : null}
                </div>
              </Card>

              <Card tone="white">
                <Text preset="h3" style={{ marginBottom: 12 }}>
                  Contacter le vendeur
                </Text>
                <Text preset="caption" color={COLORS.slateGray} style={{ lineHeight: 1.7, marginBottom: 16 }}>
                  Les coordonnées du vendeur ne transitent jamais par la plateforme : le contact ouvre une
                  conversation rattachée à cette annonce.
                </Text>

                <TextArea
                  label="Message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Bonjour, je suis intéressé par ce volume…"
                  minHeight={110}
                  maxLength={3000}
                  optionalLabel="optionnel"
                />

                {error ? (
                  <div style={{ marginTop: 16 }}>
                    <ErrorState error={error} showRequestId />
                  </div>
                ) : null}

                <Button
                  label="Ouvrir la conversation"
                  onClick={() => contact.mutate()}
                  loading={contact.isPending}
                  fullWidth
                  style={{ marginTop: 16 }}
                />
              </Card>
            </div>
          </motion.div>
        )}
      </AuthGate>
    </Section>
  );
}
