import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { Button, Card, ErrorState, Input, Text } from '@/components/ui';
import { authApi, notificationApi } from '@/services/endpoints';
import { queryKeys } from '@/services/query';
import { useAuthStore } from '@/store/auth';
import { useI18n } from '@/i18n';
import { COLORS } from '@/theme';

export function AccountSettingsPanel({ profileRoute }: { profileRoute: string }) {
  const { locale, setLocale } = useI18n();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const refreshProfile = useAuthStore((state) => state.refreshProfile);
  const logout = useAuthStore((state) => state.logout);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [notice, setNotice] = useState<string | null>(null);

  const mfa = useQuery({
    queryKey: ['auth', 'mfa', 'status'],
    queryFn: () => authApi.mfaStatus().then((result) => result.data),
  });
  const preferences = useQuery({
    queryKey: [...queryKeys.notifications.all, 'preferences'],
    queryFn: () => notificationApi.preferences().then((result) => result.data),
  });

  const language = useMutation({
    mutationFn: (next: 'fr' | 'en') => authApi.updateMe({ locale: next }).then(() => next),
    onSuccess: (next) => {
      setLocale(next);
      void refreshProfile();
      setNotice('Langue enregistrée.');
    },
  });

  const communication = useMutation({
    mutationFn: (accountPreferences: Record<string, unknown>) => authApi.updateMe({ accountPreferences }),
    onSuccess: () => {
      void refreshProfile();
      setNotice('Préférences enregistrées.');
    },
  });

  const password = useMutation({
    mutationFn: () =>
      authApi.changePassword({
        currentPassword,
        newPassword,
        ...(mfaCode ? { mfaCode } : {}),
      }),
    onSuccess: () => {
      setCurrentPassword('');
      setNewPassword('');
      setMfaCode('');
      setNotice('Mot de passe modifié. Les autres sessions ont été révoquées.');
    },
  });

  const exportData = useMutation({
    mutationFn: () => authApi.exportData().then((result) => result.data),
    onSuccess: (data) => {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `agrikonnect-data-${data.exportedAt.slice(0, 10)}.json`;
      link.click();
      URL.revokeObjectURL(url);
      setNotice('Export généré.');
    },
  });

  const remove = useMutation({
    mutationFn: () => authApi.deleteAccount(),
    onSuccess: async () => {
      queryClient.clear();
      await logout();
      navigate('/', { replace: true });
    },
  });

  const disabled = (preferences.data?.preferences ?? []).filter((item) => !item.enabled).length;
  const accountPreferences = user?.accountPreferences ?? {};
  const error = language.error ?? communication.error ?? password.error ?? exportData.error ?? remove.error;

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <Card tone="white">
        <Text preset="h3" style={{ marginBottom: 12 }}>Préférences de l’application</Text>
        <Text preset="bodySm" color={COLORS.slateGray} style={{ marginBottom: 12 }}>
          La langue est persistée sur le serveur et synchronisée entre appareils.
        </Text>
        <div style={{ display: 'flex', gap: 8 }}>
          {(['fr', 'en'] as const).map((item) => (
            <Button
              key={item}
              label={item === 'fr' ? 'Français' : 'English'}
              variant={locale === item ? 'primary' : 'outline'}
              size="sm"
              loading={language.isPending && language.variables === item}
              onClick={() => language.mutate(item)}
            />
          ))}
        </div>
        <label style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 18 }}>
          <input
            type="checkbox"
            checked={accountPreferences.communicationEmail !== false}
            onChange={(event) =>
              communication.mutate({ ...accountPreferences, communicationEmail: event.target.checked })
            }
          />
          Recevoir les actualités par e-mail
        </label>
        <label style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 10 }}>
          <input
            type="checkbox"
            checked={accountPreferences.communicationSms === true}
            onChange={(event) =>
              communication.mutate({ ...accountPreferences, communicationSms: event.target.checked })
            }
          />
          Autoriser les communications SMS
        </label>
        <Link to="/app/sms-consent"><Button label="Gérer le consentement SMS" variant="outline" size="sm" /></Link>
      </Card>

      <Card tone="white">
        <Text preset="h3" style={{ marginBottom: 8 }}>Notifications</Text>
        <Text preset="bodySm" color={COLORS.slateGray} style={{ marginBottom: 12 }}>
          {preferences.isError
            ? 'Le résumé des préférences est indisponible.'
            : `${disabled} préférence(s) désactivée(s).`}
        </Text>
        <Link to="/notifications/preferences"><Button label="Configurer les notifications" variant="outline" /></Link>
      </Card>

      <Card tone="white">
        <Text preset="h3" style={{ marginBottom: 8 }}>Sécurité et compte</Text>
        <Text preset="bodySm" style={{ marginBottom: 12 }}>
          {mfa.data?.enabled ? 'Double authentification active.' : 'Double authentification inactive.'}
        </Text>
        <Link to="/auth/mfa">
          <Button label={mfa.data?.enabled ? 'Gérer la 2FA' : 'Activer la 2FA'} variant="outline" />
        </Link>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            password.mutate();
          }}
          style={{ display: 'grid', gap: 12, marginTop: 20 }}
        >
          <Input label="Mot de passe actuel" type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} required autoComplete="current-password" />
          <Input label="Nouveau mot de passe" type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} minLength={8} required autoComplete="new-password" />
          {mfa.data?.enabled ? (
            <Input label="Code 2FA" value={mfaCode} onChange={(event) => setMfaCode(event.target.value)} inputMode="numeric" />
          ) : null}
          <Button label="Changer le mot de passe" type="submit" loading={password.isPending} />
        </form>
      </Card>

      <Card tone="white">
        <Text preset="h3" style={{ marginBottom: 8 }}>Confidentialité et données</Text>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Button label="Exporter mes données" variant="outline" loading={exportData.isPending} onClick={() => exportData.mutate()} />
          <Link to={profileRoute}><Button label="Voir mon profil" variant="ghost" /></Link>
          <Button
            label="Supprimer mon compte"
            variant="danger"
            loading={remove.isPending}
            onClick={() => {
              if (window.confirm('Supprimer définitivement l’accès à ce compte ? Les appartenances seront retirées.')) {
                remove.mutate();
              }
            }}
          />
        </div>
      </Card>

      {error ? <ErrorState error={error} showRequestId /> : null}
      {notice ? <Text preset="bodySm" color={COLORS.success}>{notice}</Text> : null}
    </div>
  );
}
