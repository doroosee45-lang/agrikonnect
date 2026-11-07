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
      setRapport({ ton: 'succes', texte: `${libelle} — fait.` });
      rafraichir();
    } catch (erreur) {
      const message = erreur instanceof Error ? erreur.message : String(erreur);
      setRapport({ ton: 'erreur', texte: `${libelle} — refusé : ${message}` });
    } finally {
      setOccupe(false);
    }
  };

  const changerRole = (delta: 1 | -1) => {
    if (delta === 1) {
      return executer(`Attribution ${roleChoisi}`, () =>
        adminApi.grantRole(id, {
          role: roleChoisi,
          mfaCode: mfaCode.trim(),
          ...(roleChoisi === 'SUPER_ADMIN' ? { password: motDePasse } : {}),
          reason: motifRole.trim(),
        }),
      );
    }
    return executer(`Révocation ${roleChoisi}`, () => adminApi.revokeRole(id, roleChoisi));
  };

  if (!isAuthenticated) {
    return (
      <Screen background={COLORS.naturalWhite}>
        <AppHeader title="Fiche compte" />
        <Section bare contentStyle={styles.section}>
          <AuthGate isAuthenticated={false} title="Fiche compte" icon="person-outline">
            <Text preset="body" color={COLORS.slateGray}>
              Connecte-toi pour consulter la fiche d'un compte.
            </Text>
          </AuthGate>
        </Section>
      </Screen>
    );
  }

  if (fiche.isLoading) {
    return (
      <Screen background={COLORS.naturalWhite}>
        <AppHeader title="Fiche compte" />
        <Section bare contentStyle={styles.section}>
          <LoadingState count={3} height={90} />
        </Section>
      </Screen>
    );
  }

  if (fiche.isError || !fiche.data) {
    return (
      <Screen background={COLORS.naturalWhite}>
        <AppHeader title="Fiche compte" />
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
        title={`${String(utilisateur.firstName ?? '')} ${String(utilisateur.lastName ?? '')}`.trim() || 'Compte'}
        subtitle={String(utilisateur.email ?? '')}
      />
      <Section bare contentStyle={styles.section}>
        <Text preset="caption" color={COLORS.forestGreen} onPress={() => router.push('/admin/users')} style={styles.retour}>
          ← Retour aux comptes
        </Text>

        {rapport && (
          <Card tone="white" style={styles.rapport}>
            <Text preset="body" color={rapport.ton === 'succes' ? COLORS.success : COLORS.error}>
              {rapport.texte}
            </Text>
          </Card>
        )}

        <Card tone="white" style={styles.bloc}>
          <Text preset="bodyMedium" style={styles.titre}>Profil et organisation(s)</Text>
          <Text preset="caption" color={COLORS.slateGray}>
            {String(utilisateur.phone ?? 'Téléphone : —')} · {String(utilisateur.countryCode ?? '')} ·{' '}
            {String(utilisateur.status ?? '')}
          </Text>
          <Text preset="caption" color={COLORS.slateGray}>
            E-mail vérifié : {data.verification.emailVerifiedAt ? '✅' : '❌'} · Téléphone vérifié :{' '}
            {data.verification.phoneVerifiedAt ? '✅' : '❌'}
          </Text>
          <Text preset="caption" color={COLORS.slateGray}>
            Dernière connexion :{' '}
            {utilisateur.lastLoginAt ? String(utilisateur.lastLoginAt).slice(0, 16).replace('T', ' ') : 'jamais'}
          </Text>
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
          <Text preset="bodyMedium" style={styles.titre}>Sécurité</Text>
          <Text preset="caption" color={COLORS.slateGray}>
            MFA : {data.security.mfaEnabled ? '✅ active' : '❌ inactive'} · Tentatives échouées :{' '}
            {String(data.security.failedLoginAttempts)} ·{' '}
            {data.security.locked ? `Verrouillé jusqu'au ${String(data.security.lockedUntil)}` : 'Non verrouillé'}
          </Text>
        </Card>

        <Card tone="white" style={styles.bloc}>
          <Text preset="bodyMedium" style={styles.titre}>Actions opérationnelles (palier 1)</Text>
          <Text preset="caption" color={COLORS.slateGray} style={styles.aide}>
            Le motif est requis et journalisé (RG-M2-2).
          </Text>
          <Input
            label="Motif"
            placeholder="Motif de l'action (3 caractères minimum)"
            value={motif}
            onChangeText={setMotif}
          />
          <View style={styles.boutons}>
            <Button
              label={suspendu ? 'Réactiver' : 'Suspendre'}
              variant="outline"
              icon={suspendu ? 'play-circle-outline' : 'pause-circle-outline'}
              disabled={occupe || motif.trim().length < 3}
              onPress={() =>
                executer(suspendu ? 'Réactivation' : 'Suspension', () =>
                  adminApi.setUserStatus(id, { status: suspendu ? 'ACTIVE' : 'SUSPENDED', reason: motif.trim() }),
                )
              }
            />
            <Button
              label="Déverrouiller"
              variant="outline"
              icon="lock-open-outline"
              disabled={occupe}
              onPress={() => executer('Déverrouillage', () => adminApi.unlockUser(id, { reason: motif.trim() || undefined }))}
            />
            <Button
              label="Forcer la déconnexion"
              variant="outline"
              icon="log-out-outline"
              disabled={occupe}
              onPress={() =>
                executer('Révocation des sessions', () => adminApi.forceLogout(id, { reason: motif.trim() || undefined }))
              }
            />
            <Button
              label="E-mail vérifié"
              variant="outline"
              icon="mail-open-outline"
              disabled={occupe || motif.trim().length < 3}
              onPress={() => executer('Marquage e-mail vérifié', () => adminApi.verifyUserEmail(id, { reason: motif.trim() }))}
            />
            <Button
              label="Téléphone vérifié"
              variant="outline"
              icon="call-outline"
              disabled={occupe || motif.trim().length < 3}
              onPress={() => executer('Marquage téléphone vérifié', () => adminApi.verifyUserPhone(id, { reason: motif.trim() }))}
            />
          </View>
        </Card>

        {estSuperAdmin && (
          <Card tone="white" style={styles.bloc}>
            <Text preset="bodyMedium" style={styles.titre}>Rôles de gouvernance (palier 2)</Text>
            <Text preset="caption" color={COLORS.slateGray} style={styles.aide}>
              Second facteur exigé (RG-G1). La nomination d'un SUPER_ADMIN exige votre mot de
              passe courant (RG-G3).
            </Text>
            <Input label="Code MFA" placeholder="Code à 6 chiffres" value={mfaCode} onChangeText={setMfaCode} />
            {roleChoisi === 'SUPER_ADMIN' && (
              <Input
                label="Votre mot de passe courant"
                placeholder="Requis par RG-G3"
                secureTextEntry
                value={motDePasse}
                onChangeText={setMotDePasse}
              />
            )}
            <Input label="Motif" placeholder="Motif de la nomination" value={motifRole} onChangeText={setMotifRole} />
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
                label="Attribuer le rôle"
                variant="primary"
                icon="shield-checkmark-outline"
                disabled={occupe || mfaCode.trim().length < 6 || motifRole.trim().length < 3}
                onPress={() => void changerRole(1)}
              />
              <Button
                label={`Révoquer ${roleChoisi}`}
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
            <Text preset="bodyMedium" style={styles.titre}>Données et suppression (palier 2)</Text>
            <View style={styles.boutons}>
              <Button
                label="Exporter les données (portabilité)"
                variant="outline"
                icon="download-outline"
                disabled={occupe}
                onPress={() =>
                  executer('Export de portabilité', () =>
                    adminApi.exportUser(id).then((result) => {
                      // Aperçu du contenu : l'export est aussi audité côté serveur.
                      setRapport({
                        ton: 'succes',
                        texte: `Export généré — ${JSON.stringify(result.data).length} caractères, aucun secret.`,
                      });
                    }),
                  )
                }
              />
              <Button
                label="Supprimer le compte (logique)"
                variant="danger"
                icon="trash-outline"
                disabled={occupe || motif.trim().length < 3}
                onPress={() => executer('Suppression logique', () => adminApi.deleteUser(id, { reason: motif.trim() }))}
              />
            </View>
          </Card>
        )}

        <Card tone="white" style={styles.bloc}>
          <Text preset="bodyMedium" style={styles.titre}>Historique d'actions auditées</Text>
          {data.auditTrail.length === 0 ? (
            <Text preset="caption" color={COLORS.slateGray}>
              Aucune action auditée pour ce compte.
            </Text>
          ) : (
            data.auditTrail.map((entree) => (
              <Text key={String(entree.id)} preset="caption" color={COLORS.slateGray}>
                {String(entree.createdAt).slice(0, 16).replace('T', ' ')} — {String(entree.action)} sur{' '}
                {String(entree.resource)}
              </Text>
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
