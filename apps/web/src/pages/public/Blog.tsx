import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';

import { Card, ErrorState, LoadingState, Section, Text } from '@/components/ui';
import { publicApi } from '@/services/endpoints';
import { queryKeys } from '@/services/query';
import type { BlogPostSummary } from '@/services/types';
import { COLORS } from '@/theme';
import { useI18n } from '@/i18n';
import { bcpLocale } from '@/lib/format';

const PAGE_SIZE = 20;

async function fetchAllPublishedPosts(): Promise<BlogPostSummary[]> {
  const allPosts: BlogPostSummary[] = [];
  for (let page = 1; ; page += 1) {
    const result = await publicApi.blogPosts({ page, limit: PAGE_SIZE });
    const pagePosts = result.data ?? [];
    allPosts.push(...pagePosts);
    if (pagePosts.length < PAGE_SIZE) return allPosts;
  }
}

export default function PublicBlogPage() {
  const { t } = useI18n();
  const posts = useQuery({
    queryKey: queryKeys.public.blogPosts({ page: 1, limit: PAGE_SIZE }),
    queryFn: fetchAllPublishedPosts,
    staleTime: 60_000,
  });

  return (
    <div className="public-home services-page">
      <section className="services-catalogue">
        <div className="services-section-heading">
          <span className="services-eyebrow">{t('common.appName')}</span>
          <h1>{t('ui.actualitesEtConseilsAgricoles')}</h1>
          <p>{t('ui.lesArticlesPubliesParLEquipe')}</p>
        </div>

        <Section style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px 80px' }}>
          {posts.isLoading ? <LoadingState count={3} height={180} /> : null}
          {posts.isError ? <ErrorState error={posts.error} onRetry={() => void posts.refetch()} showRequestId /> : null}
          {!posts.isLoading && !posts.isError && (posts.data?.length ?? 0) === 0 ? (
            <Card tone="white">
              <Text preset="bodyMd" color={COLORS.slateGray}>{t('ui.aucunArticlePubliePourLeMoment')}</Text>
            </Card>
          ) : null}
          {posts.data && posts.data.length > 0 ? (
            <div className="home-card-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 20 }}>
              {posts.data.map((post) => (
                <Card key={post.id} tone="white" hover style={{ height: '100%', padding: 0, overflow: 'hidden' }}>
                  <img src={post.imageUrl} alt={post.title} loading="lazy" decoding="async" style={{ display: 'block', width: '100%', height: 200, objectFit: 'cover' }} />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 20 }}>
                    {post.publishedAt ? <time dateTime={post.publishedAt} style={{ color: COLORS.slateGray, fontSize: 13 }}>{new Intl.DateTimeFormat(bcpLocale(), { dateStyle: 'medium' }).format(new Date(post.publishedAt))}</time> : null}
                    <Text preset="h4" color={COLORS.textPrimary}>{post.title}</Text>
                    <p style={{ color: COLORS.slateGray, lineHeight: 1.7, margin: 0, flex: 1 }}>{post.summary}</p>
                    <Link className="service-open-button" to={`/public/blog/${encodeURIComponent(post.slug)}`}>{t('ui.lireLArticle')}</Link>
                  </div>
                </Card>
              ))}
            </div>
          ) : null}
        </Section>
      </section>
    </div>
  );
}
