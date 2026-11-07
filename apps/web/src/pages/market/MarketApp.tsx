import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';

import { Button, Card, Chip, EmptyState, ErrorState, LoadingState, Section, Text } from '@/components/ui';
import { listingApi } from '@/services/endpoints';
import { queryKeys } from '@/services/query';
import { useAuthStore } from '@/store/auth';
import { formatDate, formatNumber } from '@/lib/format';
import { useI18n } from '@/i18n';
import { COLORS, DURATION, EASE } from '@/theme';

export default function Annonces() {
  const { locale } = useI18n();
  const isAuthenticated = useAuthStore((state) => state.status === 'authenticated');

  const listings = useQuery({
    queryKey: queryKeys.listings.list({ limit: 30 }),
    queryFn: () => listingApi.list({ limit: 30 }).then((result) => result.data),
    enabled: isAuthenticated,
  });

  if (!isAuthenticated) {
    return (
      <Section style={{ minHeight: 'calc(100vh - 72px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Card tone="white" style={{ textAlign: 'center', padding: 48, maxWidth: 500 }}>
          <Text preset="h2" style={{ marginBottom: 16 }}>
            Connexion requise
          </Text>
          <Text preset="bodyMd" color={COLORS.slateGray} style={{ marginBottom: 32 }}>
            Connectez-vous pour consulter les annonces et contacter les vendeurs.
          </Text>
          <Link to="/auth/login">
            <Button label="Se connecter" variant="primary" size="lg" />
          </Link>
        </Card>
      </Section>
    );
  }

  return (
    <Section>
      <div style={{ marginBottom: 32 }}>
        <Text preset="h1" style={{ marginBottom: 16 }}>
          Annonces du marché
        </Text>
        <Text preset="bodyMd" color={COLORS.slateGray}>
          Volumes disponibles publiés par les producteurs et coopératives.
        </Text>
      </div>

      {listings.isLoading ? (
        <LoadingState count={3} height={120} />
      ) : listings.isError ? (
        <ErrorState error={listings.error} onRetry={() => void listings.refetch()} />
      ) : (listings.data ?? []).length === 0 ? (
        <EmptyState
          title="Aucune annonce"
          description="Les annonces publiées par les producteurs apparaîtront ici."
          icon="📦"
        />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 24 }}>
          {(listings.data ?? []).map((item, index) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: DURATION.base / 1000, delay: index * 0.03, ease: EASE.out }}
            >
              <Card tone="white" hover style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <Text preset="h4" color={COLORS.textPrimary} style={{ marginBottom: 4 }}>
                      {item.title}
                    </Text>
                    <Text preset="caption" color={COLORS.slateGray}>
                      {item.countryCode} · publiée le {formatDate(item.createdAt, locale)}
                    </Text>
                  </div>
                  <Chip
                    label={item.status}
                    tone={item.status === 'PUBLISHED' ? 'success' : item.status === 'EXPIRED' ? 'warning' : 'neutral'}
                    size="sm"
                  />
                </div>

                <Text preset="bodyMd" color={COLORS.slateGray}>
                  {formatNumber(item.quantity, locale, 1)} {item.unit}
                </Text>

                <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text preset="bodyMd" color={COLORS.forestGreen} style={{ fontWeight: 600 }}>
                    {item.indicativePrice !== null ? `${item.indicativePrice} ${item.currency}` : 'Prix sur demande'}
                  </Text>
                  <Link to={`/annonces/${item.id}`}>
                    <Button label="Voir" variant="outline" size="sm" />
                  </Link>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      )}
    </Section>
  );
}
