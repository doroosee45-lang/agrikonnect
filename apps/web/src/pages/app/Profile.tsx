import { useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { AuthGate, Button, Card, Chip, ErrorState, Input, LoadingState, Section, Text } from '@/components/ui';
import { authApi } from '@/services/endpoints';
import { queryKeys } from '@/services/query';
import { useAuthStore } from '@/store/auth';
import { formatNumber } from '@/lib/format';
import { useI18n } from '@/i18n';
import { COLORS, DURATION, EASE } from '@/theme';

export default function Profil() {
  const { t } = useI18n();
  const { locale } = useI18n();
  const queryClient = useQueryClient();
  const isAuthenticated = useAuthStore((state) => state.status === 'authenticated');
  const user = useAuthStore((state) => state.user);
  const permissions = useAuthStore((state) => state.permissions);
  const logout = useAuthStore((state) => state.logout);

  const me = useQuery({
    queryKey: queryKeys.me,
    queryFn: () => authApi.me().then((result) => result.data),
    enabled: isAuthenticated,
  });

  const [firstName, setFirstName] = useState(user?.firstName ?? '');
  const [lastName, setLastName] = useState(user?.lastName ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [whatsapp, setWhatsapp] = useState(user?.whatsapp ?? '');

  const update = useMutation({
    mutationFn: () => authApi.updateMe({ firstName, lastName, phone: phone || undefined, whatsapp: whatsapp || undefined }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.me });
    },
  });

  const completeness = me.data?.completeness;
  const counts = me.data?.counts;

  return (
    <Section>
      <AuthGate isAuthenticated={isAuthenticated} title={t('ui.profil')} description={t('ui.connectezVousPourGererVotreCompte')} icon="👤">
        <div style={{ marginBottom: 32 }}>
          <Text preset="h1" style={{ marginBottom: 8 }}>{t('ui.monProfil')}</Text>
          <Text preset="bodyMd" color={COLORS.slateGray}>{t('ui.informationsPersonnellesCompletudeDuDossierEt')}</Text>
        </div>

        {me.isLoading ? (
          <LoadingState count={2} height={120} />
        ) : me.isError ? (
          <ErrorState error={me.error} onRetry={() => void me.refetch()} />
        ) : (
          <>
            <Card tone="ink" style={{ marginBottom: 24, padding: 32 }}>
              <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 24 }}>
                <div
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: 'rgba(214, 166, 79, 0.18)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 24,
                  }}
                >
                  👤
                </div>
                <div>
                  <Text preset="h2" color={COLORS.pureWhite}>
                    {user ? `${user.firstName} ${user.lastName}` : '—'}
                  </Text>
                  <Text preset="caption" color="rgba(246, 247, 242, 0.7)">
                    {user?.email ?? user?.phone ?? '—'} · {user?.countryCode ?? '—'}
                  </Text>
                </div>
              </div>

              {completeness ? (
                <div style={{ marginBottom: 20 }}>
                  <Text preset="caption" color="rgba(246, 247, 242, 0.8)" style={{ marginBottom: 8 }}>{t('ui.dossierCompleteACriteres', { percent: completeness.percent, done: completeness.done, total: completeness.total })}</Text>
                  <div style={{ height: 8, backgroundColor: 'rgba(246,247,242,0.15)', borderRadius: 4, overflow: 'hidden' }}>
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${completeness.percent}%` }}
                      transition={{ duration: DURATION.slow / 1000, ease: EASE.out }}
                      style={{ height: '100%', backgroundColor: COLORS.goldSurface, borderRadius: 4 }}
                    />
                  </div>
                </div>
              ) : null}

              <div style={{ display: 'flex', gap: 40, flexWrap: 'wrap' }}>
                {[
                  { label: t('ui.exploitations'), value: counts?.farms ?? 0 },
                  { label: t('ui.parcelles'), value: counts?.plots ?? 0 },
                  { label: t('ui.recoltes'), value: counts?.productions ?? 0 },
                ].map((item) => (
                  <div key={item.label}>
                    <Text preset="numeric" color={COLORS.pureWhite}>
                      {formatNumber(item.value, locale)}
                    </Text>
                    <Text preset="caption" color="rgba(246, 247, 242, 0.7)">
                      {item.label}
                    </Text>
                  </div>
                ))}
              </div>
            </Card>

            <Card tone="white" style={{ marginBottom: 24 }}>
              <Text preset="h3" style={{ marginBottom: 20 }}>{t('ui.informationsPersonnelles')}</Text>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  update.mutate();
                }}
                style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}
              >
                <Input label={t('ui.prenom')} value={firstName} onChange={(e) => setFirstName(e.target.value)} required autoComplete="given-name" />
                <Input label={t('ui.nom')} value={lastName} onChange={(e) => setLastName(e.target.value)} required autoComplete="family-name" />
                <Input label={t('ui.telephone_d3b02')} value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" optionalLabel={t('ui.optionnel')} />
                <Input label={t('ui.whatsapp')} value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} autoComplete="tel" optionalLabel={t('ui.optionnel')} />
                <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 12 }}>
                  <Button label={t('common.save')} type="submit" loading={update.isPending} />
                  <Button label={t('common.cancel')} type="button" variant="ghost" onClick={() => update.reset()} />
                </div>
              </form>
            </Card>

            <Card tone="white" style={{ marginBottom: 24 }}>
              <Text preset="h3" style={{ marginBottom: 16 }}>{t('ui.permissions')}</Text>
              {permissions.length === 0 ? (
                <Text preset="caption" color={COLORS.slateGray}>{t('ui.aucunePermissionSpecifiqueChargee')}</Text>
              ) : (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {permissions.map((permission) => (
                    <Chip key={permission} label={permission} tone="neutral" size="sm" />
                  ))}
                </div>
              )}
            </Card>

            <Card tone="white">
              <Text preset="h3" style={{ marginBottom: 16 }}>{t('ui.securite_33e96')}</Text>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <Link to="/auth/forgot">
                  <Button label={t('ui.changerLeMotDePasse')} variant="outline" size="sm" />
                </Link>
                <Button label={t('ui.seDeconnecter')} variant="danger" size="sm" onClick={() => void logout()} />
              </div>
            </Card>
          </>
        )}
      </AuthGate>
    </Section>
  );
}
