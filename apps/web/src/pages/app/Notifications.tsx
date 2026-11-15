import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { AuthGate, Button, Card, Chip, EmptyState, ErrorState, LoadingState, Section, Text } from '@/components/ui';
import { notificationApi } from '@/services/endpoints';
import { queryKeys } from '@/services/query';
import { useAuthStore } from '@/store/auth';
import { formatRelative } from '@/lib/format';
import { useI18n } from '@/i18n';
import { COLORS, DURATION, EASE } from '@/theme';

export default function Notifications() {
  const { t } = useI18n();
  const { locale } = useI18n();
  const queryClient = useQueryClient();
  const isAuthenticated = useAuthStore((state) => state.status === 'authenticated');

  const notifications = useQuery({
    queryKey: queryKeys.notifications.list({}),
    queryFn: () => notificationApi.list({ limit: 50 }).then((result) => result.data),
    enabled: isAuthenticated,
  });

  const readAll = useMutation({
    mutationFn: () => notificationApi.readAll(),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: queryKeys.notifications.list({}) }),
  });

  const read = useMutation({
    mutationFn: (id: string) => notificationApi.read(id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: queryKeys.notifications.list({}) }),
  });

  const items = notifications.data?.items ?? [];
  const unreadCount = notifications.data?.unreadCount ?? 0;

  return (
    <Section>
      <AuthGate
        isAuthenticated={isAuthenticated}
        title={t('ui.notifications')}
        description={t('ui.connectezVousPourConsulterVosAlertes')}
        icon="🔔"
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, marginBottom: 32, flexWrap: 'wrap' }}>
          <div>
            <Text preset="h1" style={{ marginBottom: 8 }}>{t('ui.notifications')}</Text>
            <Text preset="bodyMd" color={COLORS.slateGray}>
              {unreadCount > 0 ? t(unreadCount > 1 ? 'ui.unreadCountOther' : 'ui.unreadCountOne', { unreadCount }) : t('ui.toutEstAJour')}
            </Text>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {/*
              Le SMS est le canal d'alerte primaire en RDC, mais il est à sens
              unique : la désinscription n'existe que dans l'application. On
              donne donc l'accès ici, à l'endroit où l'on parle déjà des alertes.
            */}
            <Link to="/app/sms-consent">
              <Button label={t('ui.alertesParSms')} variant="outline" size="sm" />
            </Link>
            {unreadCount > 0 ? (
              <Button label={t('ui.toutMarquerCommeLu')} onClick={() => readAll.mutate()} variant="outline" size="sm" loading={readAll.isPending} />
            ) : null}
          </div>
        </div>

        {notifications.isLoading ? (
          <LoadingState count={3} height={80} />
        ) : notifications.isError ? (
          <ErrorState error={notifications.error} onRetry={() => void notifications.refetch()} />
        ) : items.length === 0 ? (
          <EmptyState title={t('ui.aucuneNotification')} description={t('ui.vosAlertesApparaitrontIci')} icon="🔔" />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {items.map((item, index) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: DURATION.base / 1000, delay: index * 0.03, ease: EASE.out }}
              >
                <Card tone={item.readAt ? 'white' : 'pale'} style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6, flexWrap: 'wrap' }}>
                      <Text preset="bodyMd" color={COLORS.textPrimary} style={{ fontWeight: item.readAt ? 400 : 600 }}>
                        {item.title}
                      </Text>
                      {!item.readAt ? <Chip label={t('ui.nouveau_cafe5')} tone="forest" size="sm" /> : null}
                      <Chip label={item.type} tone="neutral" size="sm" />
                    </div>
                    {item.body ? (
                      <Text preset="caption" color={COLORS.slateGray} style={{ lineHeight: 1.6, marginBottom: 6 }}>
                        {item.body}
                      </Text>
                    ) : null}
                    <Text preset="caption" color={COLORS.slateGray}>
                      {formatRelative(item.createdAt, locale)}
                    </Text>
                  </div>
                  {!item.readAt ? (
                    <Button label={t('ui.marquerLu')} onClick={() => read.mutate(item.id)} variant="ghost" size="sm" loading={read.isPending && read.variables === item.id} />
                  ) : null}
                </Card>
              </motion.div>
            ))}
          </div>
        )}
      </AuthGate>
    </Section>
  );
}
