import { type ReactNode, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { AuthGate, Button, Card, ErrorState, LoadingState, Section, Text } from '@/components/ui';
import { adminApi } from '@/services/endpoints';
import { queryKeys } from '@/services/query';
import type { AdminBlogPost, BlogPostInput, BlogPostStatus } from '@/services/types';
import { useAuthStore } from '@/store/auth';
import { COLORS } from '@/theme';
import { useI18n } from '@/i18n';

const EMPTY_DRAFT: BlogPostInput = {
  slug: '',
  title: '',
  summary: '',
  imageUrl: '',
  authorName: '',
  content: '',
  status: 'DRAFT',
};

const fieldStyle = {
  boxSizing: 'border-box' as const,
  width: '100%',
  padding: '11px 12px',
  border: '1px solid rgba(0, 0, 0, 0.18)',
  borderRadius: 8,
  font: 'inherit',
};

export default function AdminBlogPostsPage() {
  const { t } = useI18n();
  const isAuthenticated = useAuthStore((state) => state.status === 'authenticated');
  const canManageContent = useAuthStore((state) => state.can('admin.content'));
  const queryClient = useQueryClient();
  const [form, setForm] = useState<BlogPostInput>(EMPTY_DRAFT);
  const [editingId, setEditingId] = useState<string | null>(null);

  const posts = useQuery({
    queryKey: queryKeys.admin.blogPosts({ limit: 100 }),
    queryFn: () => adminApi.blogPosts({ limit: 100 }).then((result) => result.data ?? []),
    enabled: isAuthenticated && canManageContent,
  });

  const save = useMutation({
    mutationFn: (input: BlogPostInput) => editingId
      ? adminApi.updateBlogPost(editingId, input)
      : adminApi.createBlogPost(input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.admin.blogPostsAll });
      await queryClient.invalidateQueries({ queryKey: queryKeys.public.all });
      setEditingId(null);
      setForm(EMPTY_DRAFT);
      },
    });

  const remove = useMutation({
    mutationFn: (id: string) => adminApi.deleteBlogPost(id),
    onSuccess: async (_result, id) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.admin.blogPostsAll });
      await queryClient.invalidateQueries({ queryKey: queryKeys.public.all });
      if (editingId === id) {
        setEditingId(null);
        setForm(EMPTY_DRAFT);
      }
    },
  });

  const edit = (post: AdminBlogPost) => {
    setEditingId(post.id);
    setForm({ slug: post.slug, title: post.title, summary: post.summary, imageUrl: post.imageUrl, authorName: post.authorName, content: post.content, status: post.status });
  };
  const cancel = () => { setEditingId(null); setForm(EMPTY_DRAFT); };

  const field = (label: string, control: ReactNode) => (
    <label style={{ display: 'grid', gap: 7, fontWeight: 600 }}>
      {label}
      {control}
    </label>
  );

  return (
    <Section style={{ maxWidth: 1180, margin: '0 auto', padding: '40px 24px 80px' }}>
      <AuthGate isAuthenticated={isAuthenticated} title={t('ui.articlesAgricoles')} description={t('ui.connectezVousPourGererLesArticles')} icon="✍️">
        <Text preset="h1" style={{ marginBottom: 8 }}>{t('ui.articlesAgricoles')}</Text>
        <Text preset="bodyMd" color={COLORS.slateGray} style={{ marginBottom: 28 }}>{t('ui.creezUnBrouillonModifiezUnArticle')}</Text>

        {!canManageContent ? (
          <Card tone="white">
            <Text preset="bodyMd" color={COLORS.slateGray}>{t('ui.votreCompteNeDisposePasDe')}</Text>
          </Card>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 340px), 1fr))', gap: 24, alignItems: 'start' }}>
            <Card tone="white">
              <Text preset="h3" style={{ marginBottom: 16 }}>{editingId ? t('ui.modifierLArticle') : t('ui.nouvelArticle')}</Text>
              <form onSubmit={(event) => { event.preventDefault(); save.mutate(form); }} style={{ display: 'grid', gap: 14 }}>
                {field(t('ui.titre'), <input required minLength={3} maxLength={200} value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} style={fieldStyle} />)}
                {field(t('ui.slug'), <input required minLength={3} maxLength={160} pattern="[a-z0-9]+(-[a-z0-9]+)*" value={form.slug} onChange={(event) => setForm({ ...form, slug: event.target.value })} style={fieldStyle} />)}
                {field(t('ui.auteur'), <input required minLength={2} maxLength={160} value={form.authorName} onChange={(event) => setForm({ ...form, authorName: event.target.value })} style={fieldStyle} />)}
                {field(t('ui.imageHttps'), <input required type="url" pattern="https://.*" value={form.imageUrl} onChange={(event) => setForm({ ...form, imageUrl: event.target.value })} style={fieldStyle} />)}
                {field(t('ui.resume'), <textarea required minLength={10} maxLength={500} rows={3} value={form.summary} onChange={(event) => setForm({ ...form, summary: event.target.value })} style={fieldStyle} />)}
                {field(t('ui.contenuDetaille'), <textarea required minLength={30} maxLength={100000} rows={10} value={form.content} onChange={(event) => setForm({ ...form, content: event.target.value })} style={{ ...fieldStyle, resize: 'vertical' }} />)}
                {field(t('ui.etat'), <select value={form.status ?? 'DRAFT'} onChange={(event) => setForm({ ...form, status: event.target.value as BlogPostStatus })} style={fieldStyle}><option value="DRAFT">{t('ui.brouillon')}</option><option value="PUBLISHED">{t('ui.publie')}</option></select>)}
                {save.isError ? <ErrorState error={save.error} showRequestId /> : null}
                {remove.isError ? <ErrorState error={remove.error} showRequestId /> : null}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                  <Button label={save.isPending ? t('ui.enregistrement') : editingId ? t('common.save') : t('ui.creerLArticle')} type="submit" disabled={save.isPending} />
                  {editingId ? <Button label={t('common.cancel')} type="button" variant="outline" onClick={cancel} /> : null}
                </div>
              </form>
            </Card>
            <Card tone="white">
              <Text preset="h3">{t('ui.articlesExistants')}</Text>
              {posts.isLoading ? <LoadingState count={3} height={100} /> : null}
              {posts.isError ? <ErrorState error={posts.error} onRetry={() => void posts.refetch()} showRequestId /> : null}
              {!posts.isLoading && !posts.isError && posts.data?.length === 0 ? (
                <Card tone="white"><Text preset="bodyMd" color={COLORS.slateGray}>{t('ui.aucunArticleNAEncoreEte')}</Text></Card>
              ) : null}
              {posts.data?.map((post) => (
                <Card tone="white" key={post.id}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'start' }}>
                    <div>
                      <Text preset="h4" style={{ marginBottom: 6 }}>{post.title}</Text>
                      <Text preset="bodySm" color={COLORS.slateGray}>
                        {post.status === 'PUBLISHED' ? t('ui.publie') : t('ui.brouillon')} · {post.authorName}
                      </Text>
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                        <Button label={t('ui.modifier')} variant="outline" size="sm" onClick={() => edit(post)} />
                        <Button
                          label={remove.isPending ? t('ui.suppression') : t('ui.supprimer')}
                          variant="outline"
                          size="sm"
                          disabled={remove.isPending}
                          onClick={() => {
                            if (window.confirm(t('ui.supprimerCetteActionEstDefinitive', { title: post.title }))) {
                              remove.mutate(post.id);
                            }
                          }}
                        />
                      </div>
                  </div>
                </Card>
              ))}
              </Card>
            </div>
        )}
      </AuthGate>
    </Section>
  );
}
