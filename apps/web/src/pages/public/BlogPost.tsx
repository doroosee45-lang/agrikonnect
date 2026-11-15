import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';

import { Card, ErrorState, LoadingState, Section, Text } from '@/components/ui';
import { publicApi } from '@/services/endpoints';
import { queryKeys } from '@/services/query';
import { COLORS } from '@/theme';
import { useI18n } from '@/i18n';
import { bcpLocale } from '@/lib/format';

export default function PublicBlogPostPage() {
  const { t } = useI18n();
  const { slug = '' } = useParams();
  const post = useQuery({
    queryKey: queryKeys.public.blogPost(slug),
    queryFn: () => publicApi.blogPost(slug).then((result) => result.data),
    enabled: Boolean(slug),
    staleTime: 60_000,
  });

  return (
    <Section style={{ maxWidth: 960, margin: '0 auto', padding: '48px 24px 80px' }}>
      <Link to="/" style={{ display: 'inline-block', marginBottom: 24, color: COLORS.forestGreen }}>{t('ui.retourALAccueil_5e2c7')}</Link>
      {post.isLoading ? <LoadingState count={2} height={180} /> : null}
      {post.isError ? <ErrorState error={post.error} onRetry={() => void post.refetch()} showRequestId /> : null}
      {post.data ? (
        <article>
          <Text preset="overline" color={COLORS.forestGreen} style={{ marginBottom: 12 }}>{t('ui.actualitesAgricoles')}</Text>
          <Text preset="h1" style={{ marginBottom: 18 }}>
            {post.data.title}
          </Text>
          <p style={{ color: COLORS.slateGray, margin: '0 0 24px', lineHeight: 1.7 }}>{t('ui.par')}{' '}<strong>{post.data.authorName}</strong>
            {post.data.publishedAt ? (
              <> · <time dateTime={post.data.publishedAt}>{new Intl.DateTimeFormat(bcpLocale(), { dateStyle: 'long' }).format(new Date(post.data.publishedAt))}</time></>
            ) : null}
          </p>
          <Card tone="white" style={{ padding: 0, overflow: 'hidden', marginBottom: 28 }}>
            <img
              src={post.data.imageUrl}
              alt={post.data.title}
              style={{ display: 'block', width: '100%', maxHeight: 520, objectFit: 'cover' }}
            />
          </Card>
          <Text preset="bodyLg" color={COLORS.textPrimary} style={{ marginBottom: 24, lineHeight: 1.8 }}>
            {post.data.summary}
          </Text>
          <div
            className="public-blog-content"
            style={{ color: COLORS.textPrimary, whiteSpace: 'pre-wrap', lineHeight: 1.85, overflowWrap: 'anywhere' }}
          >
            {post.data.content}
          </div>
        </article>
      ) : null}
    </Section>
  );
}
