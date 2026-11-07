import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import type { ReactNode } from 'react';

import { AuthGate, Card, EmptyState, ErrorState, LoadingState, Section, Text } from '@/components/ui';
import { useAuthStore } from '@/store/auth';
import { COLORS } from '@/theme';

/**
 * Socle commun des huit modules d'une parcelle.
 *
 * Chaque module affiche ce que l'API renvoie réellement : un état vide quand
 * aucune donnée n'existe, une erreur explicite quand l'API échoue. Aucune
 * valeur n'est jamais simulée.
 */
export interface PlotModuleProps<T> {
  title: string;
  subtitle: string;
  icon: string;
  /** Avertissement produit obligatoire pour les sorties de modèle (SOIL/PRE/AI). */
  disclaimer?: string;
  /** Clé de cache paramétrée par l'identifiant de parcelle. */
  queryKey: (plotId: string) => readonly unknown[];
  fetch: (plotId: string) => Promise<T>;
  render: (data: T, plotId: string) => ReactNode;
  emptyTitle: string;
  emptyDescription: string;
  /** Renvoie `true` quand la réponse est « vide » au sens métier. */
  isEmpty?: (data: T) => boolean;
}

export function PlotModule<T>({
  title,
  subtitle,
  icon,
  disclaimer,
  queryKey,
  fetch,
  render,
  emptyTitle,
  emptyDescription,
  isEmpty,
}: PlotModuleProps<T>) {
  const { id } = useParams<{ id: string }>();
  const plotId = id ?? '';
  const isAuthenticated = useAuthStore((state) => state.status === 'authenticated');

  const query = useQuery({
    queryKey: queryKey(plotId) as unknown[],
    queryFn: () => fetch(plotId),
    enabled: isAuthenticated && Boolean(plotId),
    retry: false,
  });

  const empty = query.data !== undefined && (isEmpty ? isEmpty(query.data) : false);

  return (
    <Section>
      <AuthGate isAuthenticated={isAuthenticated} title={title} description={subtitle} icon={icon}>
        <div style={{ marginBottom: 24 }}>
          <Link to={`/farmer/plots/${plotId}`} style={{ fontSize: 13, color: COLORS.slateGray, textDecoration: 'none' }}>
            ← Retour à la parcelle
          </Link>
        </div>

        <Text preset="h1" style={{ marginBottom: 8 }}>
          {title}
        </Text>
        <Text preset="bodyMd" color={COLORS.slateGray} style={{ marginBottom: 24 }}>
          {subtitle}
        </Text>

        {disclaimer ? (
          <Card tone="pale" style={{ marginBottom: 24, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <span style={{ fontSize: 18 }}>⚠️</span>
            <Text preset="caption" color={COLORS.textPrimary} style={{ lineHeight: 1.7 }}>
              {disclaimer}
            </Text>
          </Card>
        ) : null}

        {query.isLoading ? (
          <LoadingState count={2} height={110} />
        ) : query.isError ? (
          <ErrorState error={query.error} onRetry={() => void query.refetch()} showRequestId />
        ) : query.data === undefined || empty ? (
          <EmptyState title={emptyTitle} description={emptyDescription} icon={icon} />
        ) : (
          render(query.data, plotId)
        )}
      </AuthGate>
    </Section>
  );
}
