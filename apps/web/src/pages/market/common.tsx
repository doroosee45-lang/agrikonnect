import type { Listing } from '@/services/types';
import { Chip } from '@/components/ui';
import { formatDate, formatCurrency } from '@/lib/format';
import { tr } from '@/i18n';

/** MARKET — colonnes et helpers partagés par les pages marketplace. */

export const listingColumns = (locale: 'fr' | 'en') => [
  { key: 'cropId', label: tr('ui.culture'), render: (listing: Listing) => listing.cropId ?? '—' },
  { key: 'quantity', label: tr('ui.quantite'), render: (listing: Listing) => `${listing.quantity} ${listing.unit}` },
  { key: 'indicativePrice', label: tr('ui.prixIndicatif'), render: (listing: Listing) => (listing.indicativePrice !== null ? formatCurrency(listing.indicativePrice, listing.currency) : '—') },
  { key: 'status', label: tr('ui.statut'), render: (listing: Listing) => <Chip label={listing.status} tone={listing.status === 'AVAILABLE' ? 'success' : 'neutral'} size="sm" /> },
  { key: 'createdAt', label: tr('ui.publieeLe'), render: (listing: Listing) => formatDate(listing.createdAt, locale) },
];

export const ORDER_STATUSES = ['PENDING', 'ACCEPTED', 'IN_TRANSIT', 'DELIVERED', 'DISPUTED', 'CANCELLED'] as const;
export const PAYMENT_STATUSES = ['UNPAID', 'PARTIAL', 'PAID', 'REFUNDED'] as const;
