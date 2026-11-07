import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { publicApi } from '@/services/api/endpoints';
import { queryKeys } from '@/services/query';
import type {
  ApiMeta,
  MapResult,
  PageQuery,
  PublicFarmListItem,
  PublicLot,
  SoilStatsResult,
} from '@/services/api/types';
import { useI18n } from '@/i18n';

/**
 * Hooks de données publiques.
 *
 * Toutes les requêtes ici visent `/public/*`, c'est-à-dire les seules routes du
 * backend accessibles sans session. Les écrans publics ne doivent jamais appeler
 * une route authentifiée « au cas où » : ils passeraient leur temps en 401.
 */

export interface PublicFarmPage {
  items: PublicFarmListItem[];
  meta?: ApiMeta;
}

/**
 * Annuaire public paginé (`GET /public/farms`).
 * Le serveur répond par `paginated()` : les items sont dans `data`, la
 * pagination dans `meta` — on conserve les deux.
 */
export function usePublicFarms(params: PageQuery = {}): UseQueryResult<PublicFarmPage> {
  const { locale } = useI18n();
  return useQuery({
    queryKey: queryKeys.public.farms({ ...params, locale }),
    queryFn: async () => {
      const result = await publicApi.farms({ ...params, locale });
      return { items: result.data, meta: result.meta };
    },
    staleTime: 5 * 60_000,
  });
}

/** Carte agricole (`GET /public/map`) — positions déjà arrondies côté serveur. */
export function usePublicMap(
  params: { countryCode?: string; province?: string; cropId?: string; limit?: number; bbox?: string } = {},
): UseQueryResult<MapResult> {
  const { locale } = useI18n();
  return useQuery({
    queryKey: queryKeys.public.map({ ...params, locale }),
    queryFn: () => publicApi.map({ ...params, locale }).then((result) => result.data),
    staleTime: 5 * 60_000,
  });
}

/** Statistiques de sol agrégées, k-anonymat ≥ 10 (`GET /public/soil-stats`). */
export function useSoilStats(params: { countryCode?: string; parameter?: string } = {}): UseQueryResult<SoilStatsResult> {
  return useQuery({
    queryKey: queryKeys.public.soilStats(params),
    queryFn: () => publicApi.soilStats(params).then((result) => result.data),
    staleTime: 10 * 60_000,
  });
}

/** Fiche publique d'un lot (`GET /public/lots/:code`), activée dès qu'un code est saisi. */
export function usePublicLot(code: string | null): UseQueryResult<PublicLot> {
  return useQuery({
    queryKey: queryKeys.public.lot(code ?? ''),
    queryFn: () => publicApi.lot(code as string).then((result) => result.data),
    enabled: Boolean(code && code.trim().length >= 6),
    retry: false,
    staleTime: 60_000,
  });
}

/** Regroupe les pays présents dans le jeu de carte (aucune liste de pays inventée). */
export function useCountriesFromMap(params: { limit?: number } = {}) {
  const query = usePublicMap(params);
  const countries = (query.data?.features ?? []).reduce<Record<string, number>>((acc, feature) => {
    const code = feature.properties.countryCode;
    acc[code] = (acc[code] ?? 0) + 1;
    return acc;
  }, {});

  return {
    ...query,
    countries,
    entries: Object.entries(countries).sort((a, b) => b[1] - a[1]),
  };
}
