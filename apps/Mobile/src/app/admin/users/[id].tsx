import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { AppHeader } from '@/components/app/AppHeader';
import {
  AuthGate, Button, Card, Chip, ErrorState, Input, LoadingState,
  Screen, Section, Text,
} from '@/components/ui';
import { adminApi } from '@/services/api/endpoints';
import { queryKeys } from '@/services/query';
import { useAuthStore } from '@/store/auth';
import { COLORS } from '@/theme/colors';
import { SPACING } from '@/theme/space';
import { useI18n } from '@/i18n';

/**
 * ADMIN M2 — fiche utilisateur (SPEC-SUPER-ADMIN U-M2-2 → U-M2-5), miroir de
 * `apps/web/src/pages/admin/UserDetail.tsx`.
 *
 * Palier 1 : statut avec motif, déverrouillage, révocation de sessions,
 * marquage vérifié. Palier 2 (Super Admin, garde serveur `requireSuperAdmin`) :
 * attribution/révocation de rôles (code MFA exigé ; mot de passe courant pour
 * un SUPER_ADMIN — RG-G1/G3), export de portabilité, suppression logique
 * (RG-G5). RG-G2 protège le dernier SUPER_ADMIN.
 */

const ROLES_GOUVERNANCE = [
  'ADMIN', 'SUPER_ADMIN', 'MODERATOR', 'COUNTRY_ADMIN', 'DATA_STEWARD',
  'VERIFIER', 'LAB_PARTNER',
] as const;

type Rapport = { ton: 'succes' | 'erreur'; texte: string } | null;

export default function AdminUserDetail() {
  const { t } = useI18n();
  const { id = '' } = useLocalSearchParams<{ id: string }>();
  const isAuthenticated = useAuthStore((state) => state.status === 'authenticated');
  const hasAnyRole = useAuthStore((state) => state.hasAnyRole);
  const estSuperAdmin = hasAnyRole(['SUPER_ADMIN']);
  const queryClient = useQueryClient();

  const [rapport, setRapport] = useState<Rapport>(null);
  const [occupe, setOccupe] = useState(false);
  const [motif, setMotif] = useState('');
  const [motifRole, setMotifRole] = useState('');
  const [roleChoisi, setRoleChoisi] = useState<string>('MODERATOR');
  const [mfaCode, setMfaCode] = useState('');
  const [motDePasse, setMotDePasse] = useState('');

  const fiche = useQuery({
    queryKey: queryKeys.admin.user(id),
    queryFn: () => adminApi.user(id).then((r) => r.data),
    enabled: isAuthenticated && Boolean(id),
    retry: false,
  });

  const rafraichir = () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.admin.user(id) });
    void queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
  };

  const executer = async (libelle: string, action: () => Promise<unknown>) => {
    setOccupe(true);
    setRapport(null);
    try {
      await action();
      setRapport({ ton: 'succes', texte: t('ui.fait', { libelle }) });
      rafraichir();
    } catch (erreur) {
      const message = erreur instanceof Error ? erreur.message : String(erreur);
      setRapport({ ton: 'erreur', texte: t('ui.refuse', { libelle, message }) });
    } finally {
      setOccupe(false);
    }
  };

  const changerRole = (delta: 1 | -1) => {
    if (delta === 1) {
      return executer(t('ui.attribution', { roleChoisi }), () =>
        adminApi.grantRole(id, {
          role: roleChoisi,
          mfaCode: mfaCode.trim(),
          ...(roleChoisi === 'SUPER_ADMIN' ? { password: motDePasse } : {}),
          reason: motifRole.trim(),
        }),
      );
    }
    return executer(t('ui.revocation_724aa', { roleChoisi }), () => adminApi.revokeRole(id, roleChoisi));
  };

  if (!isAuthenticated) {
    return (
      <Screen background={COLORS.naturalWhite}>
        <AppHeader title={t('ui.ficheCompte')} />
        <Section bare contentStyle={styles.section}>
          <AuthGate isAuthenticated={false} title={t('ui.ficheCompte')} icon="person-outline">
            <Text preset="body" color={COLORS.slateGray}>{t('ui.connecteToiPourConsulterLaFiche')}</Text>
          </AuthGate>
        </Section>
      </Screen>
    );
  }

  if (fiche.isLoading) {
    return (
      <Screen background={COLORS.naturalWhite}>
        <AppHeader title={t('ui.ficheCompte')} />
        <Section bare contentStyle={styles.section}>
          <LoadingState count={3} height={90} />
        </Section>
      </Screen>
    );
  }

  if (fiche.isError || !fiche.data) {
    return (
      <Screen background={COLORS.naturalWhite}>
        <AppHeader title={t('ui.ficheCompte')} />
        <Section bare contentStyle={styles.section}>
          <ErrorState error={fiche.error} onRetry={() => void fiche.refetch()} />
        </Section>
      </Screen>
    );
  }

  const data = fiche.data as {
    user: Record<string, unknown>;
    organizations: Array<Record<string, unknown>>;
    security: Record<string, unknown>;
    verification: Record<string, unknown>;
    auditTrail: Array<Record<string, unknown>>;
  };
  const utilisateur = data.user;
  const suspendu = utilisateur.status === 'SUSPENDED';

  return (
    <Screen background={COLORS.naturalWhite}>
      <AppHeader
        title={`${String(utilisateur.firstName ?? '')} ${String(utilisateur.lastName ?? '')}`.trim() || t('ui.compte')}
        subtitle={String(utilisateur.email ?? '')}
      />
      <Section bare contentStyle={styles.section}>
        <Text preset="caption" color={COLORS.forestGreen} onPress={() => router.push('/admin/users')} style={styles.retour}>{t('ui.retourAuxComptes')}</Text>

        {rapport && (
          <Card tone="white" style={styles.rapport}>
            <Text preset="body" color={rapport.ton === 'succes' ? COLORS.success : COLORS.error}>
              {rapport.texte}
            </Text>
          </Card>
        )}

        <Card tone="white" style={styles.bloc}>
          <Text preset="bodyMedium" style={styles.titre}>{t('ui.profilEtOrganisationS')}</Text>
          <Text preset="caption" color={COLORS.slateGray}>
            {String(utilisateur.phone ?? t('ui.telephone_d37c7'))} · {String(utilisateur.countryCode ?? '')} ·{' '}
            {String(utilisateur.status ?? '')}
          </Text>
          <Text preset="caption" color={COLORS.slateGray}>{t('ui.eMailVerifieTelephoneVerifie', { value: data.verification.emailVerifiedAt ? '✅' : '❌', value2: data.verification.phoneVerifiedAt ? '✅' : '❌' })}</Text>
          <Text preset="caption" color={COLORS.slateGray}>{t('ui.derniereConnexion', { value: utilisateur.lastLoginAt ? String(utilisateur.lastLoginAt).slice(0, 16).replace('T', ' ') : 'jamais' })}</Text>
          {data.organizations.map((org) => (
            <View key={String(org.membershipId)} style={styles.ligneOrg}>
              <Chip label={String((org.organization as Record<string, unknown> | null)?.name ?? org.organizationId)} size="sm" />
              {(org.roles as string[]).map((r) => (
                <Chip key={r} label={r} tone="success" size="sm" />
              ))}
            </View>
          ))}
        </Card>

        <Card tone="white" style={styles.bloc}>
          <Text preset="bodyMedium" style={styles.titre}>{t('ui.securite_33e96')}</Text>
          <Text preset="caption" color={COLORS.slateGray}>{t('ui.mfa')}{' '}{data.security.mfaEnabled ? t('ui.active') : t('ui.inactive')}{' '}{t('ui.tentativesEchouees_39638', { failedLoginAttempts: String(data.security.failedLoginAttempts) })}{' '}{data.security.locked ? t('ui.verrouilleJusquAu', { lockedUntil: String(data.security.lockedUntil) }) : t('ui.nonVerrouille')}
          </Text>
        </Card>

        <Card tone="white" style={styles.bloc}>
          <Text preset="bodyMedium" style={styles.titre}>{t('ui.actionsOperationnellesPalier1')}</Text>
          <Text preset="caption" color={COLORS.slateGray} style={styles.aide}>{t('ui.leMotifEstRequisEtJournalise_d3006')}</Text>
          <Input
            label={t('ui.motif')}
            placeholder={t('ui.motifDeLAction3Caracteres')}
            value={motif}
            onChangeText={setMotif}
          />
          <View style={styles.boutons}>
            <Button
              label={suspendu ? t('ui.reactiver') : t('ui.suspendre')}
              variant="outline"
              icon={suspendu ? 'play-circle-outline' : 'pause-circle-outline'}
              disabled={occupe || motif.trim().length < 3}
              onPress={() =>
                executer(suspendu ? t('ui.reactivation') : t('ui.suspension'), () =>
                  adminApi.setUserStatus(id, { status: suspendu ? 'ACTIVE' : 'SUSPENDED', reason: motif.trim() }),
                )
              }
            />
            <Button
              label={t('ui.deverrouiller')}
              variant="outline"
              icon="lock-open-outline"
              disabled={occupe}
              onPress={() => executer(t('ui.deverrouillage'), () => adminApi.unlockUser(id, { reason: motif.trim() || undefined }))}
            />
            <Button
              label={t('ui.forcerLaDeconnexion')}
              variant="outline"
              icon="log-out-outline"
              disabled={occupe}
              onPress={() =>
                executer(t('ui.revocationDesSessions'), () => adminApi.forceLogout(id, { reason: motif.trim() || undefined }))
              }
            />
            <Button
              label={t('ui.eMailVerifie_aa657')}
              variant="outline"
              icon="mail-open-outline"
              disabled={occupe || motif.trim().length < 3}
              onPress={() => executer(t('ui.marquageEMailVerifie'), () => adminApi.verifyUserEmail(id, { reason: motif.trim() }))}
            />
            <Button
              label={t('ui.telephoneVerifie_8a357')}
              variant="outline"
              icon="call-outline"
              disabled={occupe || motif.trim().length < 3}
              onPress={() => executer(t('ui.marquageTelephoneVerifie'), () => adminApi.verifyUserPhone(id, { reason: motif.trim() }))}
            />
          </View>
        </Card>

        {estSuperAdmin && (
          <Card tone="white" style={styles.bloc}>
            <Text preset="bodyMedium" style={styles.titre}>{t('ui.rolesDeGouvernancePalier2')}</Text>
            <Text preset="caption" color={COLORS.slateGray} style={styles.aide}>{t('ui.secondFacteurExigeRgG1La')}</Text>
            <Input label={t('ui.codeMfa')} placeholder={t('ui.codeA6Chiffres')} value={mfaCode} onChangeText={setMfaCode} />
            {roleChoisi === 'SUPER_ADMIN' && (
              <Input
                label={t('ui.votreMotDePasseCourant')}
                placeholder={t('ui.requisParRgG3')}
                secureTextEntry
                value={motDePasse}
                onChangeText={setMotDePasse}
              />
            )}
            <Input label={t('ui.motif')} placeholder={t('ui.motifDeLaNomination')} value={motifRole} onChangeText={setMotifRole} />
            <View style={styles.boutons}>
              {ROLES_GOUVERNANCE.map((r) => (
                <Text
                  key={`sel-${r}`}
                  preset="caption"
                  color={roleChoisi === r ? COLORS.forestGreen : COLORS.slateGray}
                  onPress={() => setRoleChoisi(r)}
                  style={styles.lienFiltre}
                >
                  {roleChoisi === r ? `● ${r}` : r}
                </Text>
              ))}
            </View>
            <View style={styles.boutons}>
              <Button
                label={t('ui.attribuerLeRole')}
                variant="primary"
                icon="shield-checkmark-outline"
                disabled={occupe || mfaCode.trim().length < 6 || motifRole.trim().length < 3}
                onPress={() => void changerRole(1)}
              />
              <Button
                label={t('ui.revoquer_a14cc', { roleChoisi })}
                variant="ghost"
                icon="shield-outline"
                disabled={occupe}
                onPress={() => void changerRole(-1)}
              />
            </View>
          </Card>
        )}

        {estSuperAdmin && (
          <Card tone="white" style={styles.bloc}>
            <Text preset="bodyMedium" style={styles.titre}>{t('ui.donneesEtSuppressionPalier2')}</Text>
            <View style={styles.boutons}>
              <Button
                label={t('ui.exporterLesDonneesPortabilite')}
                variant="outline"
                icon="download-outline"
                disabled={occupe}
                onPress={() =>
                  executer(t('ui.exportDePortabilite'), () =>
                    adminApi.exportUser(id).then((result) => {
                      // Aperçu du contenu : l'export est aussi audité côté serveur.
                      setRapport({
                        ton: 'succes',
                        texte: t('ui.exportGenereCaracteresAucunSecret', { length: JSON.stringify(result.data).length }),
                      });
                    }),
                  )
                }
              />
              <Button
                label={t('ui.supprimerLeCompteLogique')}
                variant="danger"
                icon="trash-outline"
                disabled={occupe || motif.trim().length < 3}
                onPress={() => executer(t('ui.suppressionLogique_36532'), () => adminApi.deleteUser(id, { reason: motif.trim() }))}
              />
            </View>
          </Card>
        )}

        <Card tone="white" style={styles.bloc}>
          <Text preset="bodyMedium" style={styles.titre}>{t('ui.historiqueDActionsAuditees')}</Text>
          {data.auditTrail.length === 0 ? (
            <Text preset="caption" color={COLORS.slateGray}>{t('ui.aucuneActionAuditeePourCeCompte')}</Text>
          ) : (
            data.auditTrail.map((entree) => (
              <Text key={String(entree.id)} preset="caption" color={COLORS.slateGray}>{t('ui.sur_c993e', { value: String(entree.createdAt).slice(0, 16).replace('T', ' '), action: String(entree.action), resource: String(entree.resource) })}</Text>
            ))
          )}
        </Card>
      </Section>
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { paddingTop: SPACING.sm, paddingBottom: SPACING.xxl, gap: SPACING.md },
  retour: { textDecorationLine: 'underline' },
  rapport: { borderLeftWidth: 3, borderLeftColor: COLORS.livingGreen },
  bloc: { gap: SPACING.sm },
  titre: { marginBottom: 2 },
  aide: { marginBottom: 4 },
  ligneOrg: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 4 },
  boutons: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  lienFiltre: { textDecorationLine: 'underline', marginRight: SPACING.sm },
});
