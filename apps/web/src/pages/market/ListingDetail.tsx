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
  const { t } = useI18n();
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
        title={t('ui.connexionRequise_37a92')}
        description={t('ui.connectezVousPourConsulterCetteAnnonce')}
        icon="📦"
      >
        <div style={{ marginBottom: 24 }}>
          <Link to="/market/listings" style={{ fontSize: 13, color: COLORS.slateGray, textDecoration: 'none' }}>{t('ui.retourAuxAnnonces')}</Link>
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
                    <Text preset="caption" color={COLORS.slateGray}>{t('ui.publieeLe_2c645', { countryCode: item.countryCode, value: item.province ? ` · ${item.province}` : '', createdAt: formatDate(item.createdAt, locale) })}{item.expiresAt ? t('ui.expireLe_e1021', { expiresAt: formatDate(item.expiresAt, locale) }) : ''}
                    </Text>
                  </div>
                  <Chip
                    label={item.status}
                    tone={item.status === 'PUBLISHED' ? 'success' : item.status === 'EXPIRED' ? 'warning' : 'neutral'}
                  />
                </div>

                <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap', marginBottom: 24 }}>
                  <div>
                    <Text preset="caption" color={COLORS.slateGray}>{t('ui.quantite')}</Text>
                    <Text preset="numeric" color={COLORS.forestGreen}>
                      {formatNumber(item.quantity, locale, 1)} <span style={{ fontSize: 16, fontWeight: 400 }}>{item.unit}</span>
                    </Text>
                  </div>
                  <div>
                    <Text preset="caption" color={COLORS.slateGray}>{t('ui.prixIndicatif')}</Text>
                    <Text preset="numeric" color={COLORS.forestGreen}>
                      {item.indicativePrice !== null ? formatCurrency(item.indicativePrice, item.currency, locale) : t('ui.nonCommunique')}
                    </Text>
                  </div>
                  {item.quality ? (
                    <div>
                      <Text preset="caption" color={COLORS.slateGray}>{t('ui.qualite')}</Text>
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
                    <Text preset="overline" color={COLORS.forestGreen} style={{ marginBottom: 8 }}>{t('ui.certifications')}</Text>
                    <ChipRow>
                      {item.certifications.map((certification) => (
                        <Chip key={certification} label={certification} tone="success" size="sm" />
                      ))}
                    </ChipRow>
                  </div>
                ) : null}

                {item.conditions ? (
                  <div style={{ marginBottom: 20 }}>
                    <Text preset="overline" color={COLORS.forestGreen} style={{ marginBottom: 8 }}>{t('ui.conditions')}</Text>
                    <Text preset="bodyMd" color={COLORS.slateGray} style={{ lineHeight: 1.7 }}>
                      {item.conditions}
                    </Text>
                  </div>
                ) : null}

                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <Chip label={t('ui.type_0e2c4', { type: item.type })} tone="neutral" size="sm" />
                  <Chip label={t('ui.source', { source: item.source })} tone="neutral" size="sm" />
                  {item.availableFrom ? <Chip label={t('ui.disponibleDes', { availableFrom: formatDate(item.availableFrom, locale) })} tone="info" size="sm" /> : null}
                  {item.availableTo ? <Chip label={t('ui.jusquAu', { availableTo: formatDate(item.availableTo, locale) })} tone="info" size="sm" /> : null}
                </div>
              </Card>

              <Card tone="white">
                <Text preset="h3" style={{ marginBottom: 12 }}>{t('ui.contacterLeVendeur')}</Text>
                <Text preset="caption" color={COLORS.slateGray} style={{ lineHeight: 1.7, marginBottom: 16 }}>{t('ui.lesCoordonneesDuVendeurNeTransitent')}</Text>

                <TextArea
                  label={t('ui.message')}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder={t('ui.bonjourJeSuisInteresseParCe')}
                  minHeight={110}
                  maxLength={3000}
                  optionalLabel={t('ui.optionnel')}
                />

                {error ? (
                  <div style={{ marginTop: 16 }}>
                    <ErrorState error={error} showRequestId />
                  </div>
                ) : null}

                <Button
                  label={t('ui.ouvrirLaConversation')}
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
