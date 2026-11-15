import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Card, ErrorState, LoadingState, Section, Text } from '@/components/ui';
import { publicApi } from '@/services/endpoints';
import { queryKeys } from '@/services/query';
import { COLORS } from '@/theme';
import { useI18n } from '@/i18n';
import { bcpLocale } from '@/lib/format';

export function BlogNewsSection() {
  const { t } = useI18n();
  const posts = useQuery({
    queryKey: queryKeys.public.blogPosts({ limit: 3, includeContent: true }),
    queryFn: () => publicApi.blogPosts({ limit: 3, includeContent: true }).then((result) => result.data ?? []),
    staleTime: 60_000,
  });
  return (
    <Section>
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <Text preset="overline" color={COLORS.forestGreen} style={{ marginBottom: 12 }}>{t('ui.ressources')}</Text>
        <Text preset="h2" style={{ marginBottom: 16 }}>{t('ui.actualitesEtConseilsAgricoles')}</Text>
        <Text preset="bodyMd" color={COLORS.slateGray} style={{ maxWidth: 600, margin: '0 auto' }}>{t('ui.retrouvezLesArticlesAgricolesPubliesPar')}</Text>
      </div>
      {posts.isLoading ? <LoadingState count={3} height={180} /> : null}
      {posts.isError ? <ErrorState error={posts.error} onRetry={() => void posts.refetch()} showRequestId /> : null}
      {!posts.isLoading && !posts.isError && (posts.data?.length ?? 0) === 0 ? (
        <Card tone="white"><Text preset="bodyMd" color={COLORS.slateGray}>{t('ui.aucunArticlePubliePourLeMoment_2b942')}</Text></Card>
      ) : null}
      {posts.data && posts.data.length > 0 ? (
        <div className="home-card-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 20 }}>
          {posts.data.slice(0, 3).map((post) => (
            <Link key={post.id} to={`/public/blog/${encodeURIComponent(post.slug)}`} style={{ color: 'inherit', textDecoration: 'none' }}>
              <Card tone="white" hover style={{ height: '100%', padding: 0, overflow: 'hidden' }}>
                <img className="home-card-image" src={post.imageUrl} alt={post.title} loading="lazy" decoding="async" style={{ width: '100%', height: 190, objectFit: 'cover' }} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 20 }}>
                  {post.publishedAt ? <time dateTime={post.publishedAt} style={{ color: COLORS.slateGray, fontSize: 13 }}>{new Intl.DateTimeFormat(bcpLocale(), { dateStyle: 'medium' }).format(new Date(post.publishedAt))}</time> : null}
                  <Text preset="h4" color={COLORS.textPrimary}>{post.title}</Text>
                  <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.85, overflowWrap: 'anywhere' }}>{post.content}</div>
                  <span style={{ color: COLORS.forestGreen, fontWeight: 600 }}>{t('ui.lireLArticle')}</span>
              </div>
              </Card>
            </Link>
          ))}
        </div>
      ) : null}
      <div style={{ display: 'flex', justifyContent: 'center', marginTop: 32 }}>
        <Link className="service-open-button" to="/public/blog">{t('ui.voirTousNosArticles')}</Link>
      </div>
    </Section>
  );
}
