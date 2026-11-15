import { ResourcePage } from '@/components/pages';
import { Chip } from '@/components/ui';
import { formatDate } from '@/lib/format';
import { useI18n } from '@/i18n';

type Review = Record<string, unknown>;

/** MARKET — avis et évaluations des transactions. */
export default function MarketReviews() {
  const { t } = useI18n();
  const { locale } = useI18n();
  return (
    <ResourcePage<Review>
      title={t('ui.avis')}
      subtitle={t('ui.evaluationsLaisseesApresVosTransactions')}
      icon="⭐"
      queryKey={['reviews', 'list'] as unknown[]}
      fetch={async () => [] as Review[]}
      rowKey={(review) => String(review.id)}
      columns={[
        { key: 'rating', label: t('ui.note'), render: (review) => `${String(review.rating ?? '—')}/5` },
        { key: 'comment', label: t('ui.commentaire'), render: (review) => String(review.comment ?? '—') },
        { key: 'createdAt', label: t('ui.publieLe'), render: (review) => (review.createdAt ? formatDate(String(review.createdAt), locale) : '—') },
      ]}
      emptyTitle={t('ui.aucunAvis')}
      emptyDescription={t('ui.lesAvisLaissesApresVosTransactions')}
    />
  );
}
