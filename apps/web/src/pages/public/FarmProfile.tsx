import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';

import { Card, Chip, ErrorState, LoadingState, ProvenanceTag, Section, Text } from '@/components/ui';
import { publicApi } from '@/services/endpoints';
import { queryKeys } from '@/services/query';
import { formatDate } from '@/lib/format';
import { useI18n } from '@/i18n';
import { COLORS } from '@/theme';

/** PUBLIC — fiche publique d'une exploitation (PUB-01 → PUB-06). */
export default function PublicFarmProfile() {
  const { slug } = useParams<{ slug: string }>();
  const { locale } = useI18n();

  const query = useQuery({
    queryKey: queryKeys.public.farm(slug ?? ''),
    queryFn: () => publicApi.farm(slug ?? '').then((result) => result.data),
    enabled: Boolean(slug),
    retry: false,
  });

  const farm = query.data?.farm;

  return (
    <Section>
      {query.isLoading ? (
        <LoadingState count={2} height={120} />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} showRequestId />
      ) : !farm ? (
        <Text preset="bodyMd">Exploitation introuvable.</Text>
      ) : (
        <>
          <div style={{ marginBottom: 32 }}>
            <Text preset="h1" style={{ marginBottom: 8 }}>
              {farm.name}
            </Text>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
              <Chip label={farm.countryCode} tone="neutral" size="sm" />
              {farm.adminPath.province ? <Chip label={farm.adminPath.province} tone="neutral" size="sm" /> : null}
              <Chip label={farm.verification.label} tone={farm.verification.status === 'VERIFIED' ? 'success' : 'warning'} size="sm" />
            </div>
            <Text preset="caption" color={COLORS.slateGray}>
              Mise à jour : {formatDate(farm.updatedAt, locale)} · {farm.viewCount} vue(s)
            </Text>
          </div>

          {farm.description ? (
            <Card tone="white" style={{ marginBottom: 24 }}>
              <Text preset="h3" style={{ marginBottom: 12 }}>
                Présentation
              </Text>
              <Text preset="bodySm" style={{ lineHeight: 1.7 }}>
                {farm.description}
              </Text>
            </Card>
          ) : null}

          <Card tone="white" style={{ marginBottom: 24 }}>
            <Text preset="h3" style={{ marginBottom: 16 }}>
              Informations
            </Text>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 }}>
              <div>
                <Text preset="caption" color={COLORS.slateGray} style={{ marginBottom: 4 }}>
                  Surface totale
                </Text>
                <Text preset="numeric" color={COLORS.forestGreen}>
                  {farm.totalAreaHa !== null ? `${farm.totalAreaHa} ha` : '—'}
                </Text>
              </div>
              <div>
                <Text preset="caption" color={COLORS.slateGray} style={{ marginBottom: 4 }}>
                  Parcelles
                </Text>
                <Text preset="numeric" color={COLORS.forestGreen}>
                  {farm.plotsCount}
                </Text>
              </div>
              <div>
                <Text preset="caption" color={COLORS.slateGray} style={{ marginBottom: 4 }}>
                  Travailleurs
                </Text>
                <Text preset="numeric" color={COLORS.forestGreen}>
                  {farm.workers ?? '—'}
                </Text>
              </div>
              <div>
                <Text preset="caption" color={COLORS.slateGray} style={{ marginBottom: 4 }}>
                  Année de création
                </Text>
                <Text preset="numeric" color={COLORS.forestGreen}>
                  {farm.foundedYear ?? '—'}
                </Text>
              </div>
            </div>
          </Card>

          {farm.crops.length > 0 ? (
            <Card tone="white" style={{ marginBottom: 24 }}>
              <Text preset="h3" style={{ marginBottom: 16 }}>
                Cultures
              </Text>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {farm.crops.map((crop) => (
                  <Chip key={crop.slug} label={crop.name} tone="forest" size="sm" />
                ))}
              </div>
            </Card>
          ) : null}

          <Card tone="white" style={{ marginBottom: 24 }}>
            <Text preset="h3" style={{ marginBottom: 12 }}>
              Vérification
            </Text>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <Text preset="bodySm">
                Statut : <Chip label={farm.verification.label} tone={farm.verification.status === 'VERIFIED' ? 'success' : 'warning'} size="sm" />
              </Text>
              {farm.verification.verifiedAt ? (
                <Text preset="caption" color={COLORS.slateGray}>
                  Vérifié le {formatDate(farm.verification.verifiedAt, locale)}
                </Text>
              ) : null}
              <div style={{ marginTop: 8 }}>
                <ProvenanceTag kind={farm.source === 'declared' ? 'DECLARED' : 'MEASURED'} source={farm.source} />
              </div>
            </div>
          </Card>

          <Card tone="pale">
            <Text preset="caption" color={COLORS.textPrimary} style={{ lineHeight: 1.7 }}>
              {farm.contact.masked
                ? 'Les coordonnées du producteur ne sont pas affichées. Pour le contacter, passez par la messagerie interne après avoir créé un compte.'
                : 'Contactez le producteur via la messagerie interne.'}
            </Text>
          </Card>
        </>
      )}
    </Section>
  );
}
