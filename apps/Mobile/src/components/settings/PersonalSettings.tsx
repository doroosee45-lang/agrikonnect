import { useState } from 'react';
import { Alert, Share, StyleSheet, Switch, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';

import { Button, Card, Chip, ErrorState, Input, PressableScale, Section, Text } from '@/components/ui';
import { SUPPORTED_LOCALES, useI18n } from '@/i18n';
import { authApi, notificationApi } from '@/services/api/endpoints';
import type { NotificationPreference } from '@/services/api/types';
import { queryKeys } from '@/services/query';
import { useAuthStore } from '@/store/auth';
import { COLORS } from '@/theme/colors';
import { SPACING } from '@/theme/space';

const notificationDefaults = ['order.status', 'message.new', 'verification.decision', 'price.alert'];

function label(locale: 'fr' | 'en', fr: string, en: string) {
  return locale === 'fr' ? fr : en;
}

export function PersonalSettings({ profileRoute }: { profileRoute: string }) {
  const { t, locale, setLocale } = useI18n();
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const refreshProfile = useAuthStore((state) => state.refreshProfile);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [notice, setNotice] = useState<string | null>(null);

  const permissions = useQuery({
    queryKey: queryKeys.permissions,
    queryFn: () => authApi.permissions().then((result) => result.data),
  });
  const mfa = useQuery({
    queryKey: ['auth', 'mfa', 'status'],
    queryFn: () => authApi.mfaStatus().then((result) => result.data),
  });
  const notifications = useQuery({
    queryKey: [...queryKeys.notifications.all, 'preferences'],
    queryFn: () => notificationApi.preferences().then((result) => result.data),
  });

  const changeLocale = useMutation({
    mutationFn: (next: 'fr' | 'en') =>
      authApi.updateMe({ locale: next }).then((result) => ({ next, user: result.data.user })),
    onSuccess: ({ next }) => {
      setLocale(next);
      void refreshProfile();
      setNotice(label(locale, 'Langue enregistrée.', 'Language saved.'));
    },
  });

  const saveCommunication = useMutation({
    mutationFn: (accountPreferences: Record<string, unknown>) => authApi.updateMe({ accountPreferences }),
    onSuccess: () => {
      void refreshProfile();
      setNotice(label(locale, 'Préférences enregistrées.', 'Preferences saved.'));
    },
  });

  const password = useMutation({
    mutationFn: () =>
      authApi.changePassword({
        currentPassword,
        newPassword,
        ...(mfaCode.trim() ? { mfaCode: mfaCode.trim() } : {}),
      }),
    onSuccess: () => {
      setCurrentPassword('');
      setNewPassword('');
      setMfaCode('');
      setNotice(label(locale, 'Mot de passe modifié. Vos autres sessions ont été révoquées.', 'Password changed. Your other sessions were revoked.'));
    },
  });

  const logoutMutation = useMutation({
    mutationFn: logout,
    onSuccess: () => router.replace('/auth/login'),
  });

  const exportData = useMutation({
    mutationFn: () => authApi.exportData().then((result) => result.data),
    onSuccess: async (data) => {
      await Share.share({
        title: label(locale, 'Mes données AGRIKONNECT', 'My AGRIKONNECT data'),
        message: JSON.stringify(data, null, 2),
      });
      setNotice(label(locale, 'Export généré.', 'Export generated.'));
    },
  });

  const remove = useMutation({
    mutationFn: () => authApi.deleteAccount(),
    onSuccess: async () => {
      await queryClient.clear();
      await logout();
      router.replace('/');
    },
  });

  const confirmDelete = () => {
    Alert.alert(
      label(locale, 'Supprimer mon compte ?', 'Delete my account?'),
      label(
        locale,
        'Cette action désactive votre accès, retire vos appartenances et ne peut pas être annulée dans l’application.',
        'This disables your access, removes your memberships, and cannot be undone in the app.',
      ),
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: label(locale, 'Supprimer', 'Delete'), style: 'destructive', onPress: () => remove.mutate() },
      ],
    );
  };

  const disabledNotifications = (notifications.data?.preferences ?? []).filter(
    (item: NotificationPreference) => notificationDefaults.includes(item.type) && !item.enabled,
  ).length;
  const accountPreferences = user?.accountPreferences ?? {};
  const error =
    changeLocale.error ??
    saveCommunication.error ??
    password.error ??
    exportData.error ??
    remove.error ??
    logoutMutation.error ??
    permissions.error;

  return (
    <Section bare contentStyle={styles.section}>
      <Card tone="white">
        <Text preset="h3">{t('common.language')}</Text>
        <Text preset="caption" color={COLORS.slateGray}>
          {label(locale, 'La langue est synchronisée avec votre compte.', 'The language is synchronized with your account.')}
        </Text>
        <View style={styles.chips}>
          {SUPPORTED_LOCALES.map((option) => {
            const active = locale === option.code;
            return (
              <PressableScale
                key={option.code}
                onPress={() => changeLocale.mutate(option.code)}
                disabled={changeLocale.isPending}
                style={[styles.localeChip, active ? styles.localeChipActive : null]}
              >
                <Text preset="bodySm" color={active ? COLORS.pureWhite : COLORS.textPrimary}>
                  {option.native}
                </Text>
              </PressableScale>
            );
          })}
        </View>
      </Card>

      <Card tone="white">
        <Text preset="h3">{label(locale, 'Préférences de communication', 'Communication preferences')}</Text>
        <View style={styles.row}>
          <Text preset="bodySm" style={styles.flex}>{label(locale, 'Actualités par e-mail', 'Updates by email')}</Text>
          <Switch
            value={accountPreferences.communicationEmail !== false}
            onValueChange={(communicationEmail) =>
              saveCommunication.mutate({ ...accountPreferences, communicationEmail })
            }
          />
        </View>
        <View style={styles.row}>
          <Text preset="bodySm" style={styles.flex}>SMS</Text>
          <Switch
            value={accountPreferences.communicationSms === true}
            onValueChange={(communicationSms) =>
              saveCommunication.mutate({ ...accountPreferences, communicationSms })
            }
          />
        </View>
        <Button
          label={label(locale, 'Consentement SMS', 'SMS consent')}
          variant="outline"
          size="sm"
          onPress={() => router.push('/notifications/sms-consent')}
        />
      </Card>

      <Card tone="white">
        <Text preset="h3">{t('ui.notifications')}</Text>
        <Text preset="caption" color={COLORS.slateGray}>
          {notifications.isError
            ? label(locale, 'Résumé indisponible.', 'Summary unavailable.')
            : label(
                locale,
                `${disabledNotifications} canal(aux) désactivé(s) sur les alertes principales.`,
                `${disabledNotifications} channel(s) disabled for key alerts.`,
              )}
        </Text>
        <Button
          label={label(locale, 'Configurer les notifications', 'Configure notifications')}
          variant="outline"
          onPress={() => router.push('/notifications/preferences')}
        />
      </Card>

      <Card tone="white">
        <Text preset="h3">{label(locale, 'Sécurité du compte', 'Account security')}</Text>
        <Text preset="bodySm">
          {mfa.data?.enabled
            ? label(locale, 'Double authentification active.', 'Two-factor authentication is enabled.')
            : label(locale, 'Double authentification inactive.', 'Two-factor authentication is disabled.')}
        </Text>
        <Button
          label={mfa.data?.enabled
            ? label(locale, 'Gérer la 2FA', 'Manage 2FA')
            : label(locale, 'Activer la 2FA', 'Enable 2FA')}
          variant="outline"
          onPress={() => router.push('/auth/mfa')}
        />
        <Input
          label={label(locale, 'Mot de passe actuel', 'Current password')}
          value={currentPassword}
          onChangeText={setCurrentPassword}
          secure
          autoComplete="current-password"
        />
        <Input
          label={label(locale, 'Nouveau mot de passe', 'New password')}
          value={newPassword}
          onChangeText={setNewPassword}
          secure
          autoComplete="new-password"
        />
        {mfa.data?.enabled ? (
          <Input
            label={label(locale, 'Code 2FA', '2FA code')}
            value={mfaCode}
            onChangeText={setMfaCode}
            keyboardType="number-pad"
          />
        ) : null}
        <Button
          label={label(locale, 'Changer le mot de passe', 'Change password')}
          loading={password.isPending}
          disabled={!currentPassword || newPassword.length < 8}
          onPress={() => password.mutate()}
        />
      </Card>

      {permissions.data ? (
        <Card tone="white">
          <Text preset="h3">{t('ui.permissionsEffectives')}</Text>
          <View style={styles.chips}>
            {permissions.data.roles.map((role) => (
              <Chip key={role} label={role} tone="forest" size="sm" />
            ))}
          </View>
          <Text preset="caption" color={COLORS.slateGray}>
            {t('ui.permissionsAccordeesSurCeRole', { length: permissions.data.permissions.length })}
          </Text>
        </Card>
      ) : null}

      <Card tone="white">
        <Text preset="h3">{t('ui.confidentialite')}</Text>
        <Button
          label={label(locale, 'Exporter mes données', 'Export my data')}
          variant="outline"
          loading={exportData.isPending}
          onPress={() => exportData.mutate()}
        />
        <Button
          label={label(locale, 'Supprimer mon compte', 'Delete my account')}
          variant="danger"
          loading={remove.isPending}
          onPress={confirmDelete}
        />
      </Card>

      <Card tone="white">
        <Text preset="h3">{label(locale, 'Compte et session', 'Account and session')}</Text>
        <Button
          label={t('ui.monProfil')}
          variant="ghost"
          onPress={() => router.push(profileRoute as never)}
        />
        <Button
          label={t('auth.logout')}
          variant="outline"
          loading={logoutMutation.isPending}
          onPress={() => logoutMutation.mutate()}
        />
      </Card>

      {error ? <ErrorState error={error} showRequestId /> : null}
      {notice ? <Text preset="caption" color={COLORS.success}>{notice}</Text> : null}
    </Section>
  );
}

const styles = StyleSheet.create({
  section: { paddingTop: SPACING.sm, paddingBottom: SPACING.xxl, gap: SPACING.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  flex: { flex: 1 },
  chips: { flexDirection: 'row', gap: SPACING.xs, flexWrap: 'wrap' },
  localeChip: {
    marginTop: SPACING.xs,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.lightBorder,
  },
  localeChipActive: { backgroundColor: COLORS.forestGreen, borderColor: COLORS.forestGreen },
});
