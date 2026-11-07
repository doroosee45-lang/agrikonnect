import { ResourcePage } from '@/components/pages';
import { Chip } from '@/components/ui';
import { formatDate } from '@/lib/format';
import { useI18n } from '@/i18n';

type Review = Record<string, unknown>;

/** MARKET — avis et évaluations des transactions. */
export default function MarketReviews() {
  const { locale } = useI18n();
  return (
    <ResourcePage<Review>
      title="Avis"
      subtitle="Évaluations laissées après vos transactions."
      icon="⭐"
      queryKey={['reviews', 'list'] as unknown[]}
      fetch={async () => [] as Review[]}
      rowKey={(review) => String(review.id)}
      columns={[
        { key: 'rating', label: 'Note', render: (review) => `${String(review.rating ?? '—')}/5` },
        { key: 'comment', label: 'Commentaire', render: (review) => String(review.comment ?? '—') },
        { key: 'createdAt', label: 'Publié le', render: (review) => (review.createdAt ? formatDate(String(review.createdAt), locale) : '—') },
      ]}
      emptyTitle="Aucun avis"
      emptyDescription="Les avis laissés après vos transactions apparaîtront ici."
    />
  );
}
