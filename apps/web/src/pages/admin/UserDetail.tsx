import { useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import {
  AuthGate, Button, Card, Chip, ChipRow, ErrorState, Input, LoadingState, Section, Text,
} from '@/components/ui';
import { StatusChip, DateCell } from '@/components/pages';
import { adminApi } from '@/services/endpoints';
import { queryKeys } from '@/services/query';
import { useAuthStore } from '@/store/auth';
import { COLORS, DURATION, EASE } from '@/theme';
import { useI18n } from '@/i18n';

/**
 * ADMIN M2 — fiche utilisateur complète (SPEC-SUPER-ADMIN U-M2-2 → U-M2-5).
 *
 * Palier 1 (`admin.users`) : statut avec motif, déverrouillage, révocation de
 * sessions, marquage vérifié.
 * Palier 2 (`SUPER_ADMIN`, garde `requireSuperAdmin` côté serveur) :
 * attribution/révocation de rôles de gouvernance (code MFA exigé, mot de
 * passe courant pour un SUPER_ADMIN — RG-G1/G3), export de portabilité,
 * suppression logique (RG-G5). RG-G2 protège le dernier SUPER_ADMIN.
 *
 * L'interface masque le palier 2 aux non-Super-Admins, mais c'est le serveur
 * qui tranche : chaque route porte sa propre garde.
 */

const ROLES_GOUVERNANCE = [
  'ADMIN', 'SUPER_ADMIN', 'MODERATOR', 'COUNTRY_ADMIN', 'DATA_STEWARD',
  'VERIFIER', 'LAB_PARTNER',
] as const;

type Rapport = { ton: 'succes' | 'erreur'; texte: string } | null;

const SectionCarte = ({ titre, children }: { titre: string; children: ReactNode }) => (
  <Card tone="white" style={{ marginBottom: 16 }}>
    <Text preset="h2" style={{ fontSize: 20, marginBottom: 12 }}>
      {titre}
    </Text>
    {children}
  </Card>
);

export default function AdminUserDetail() {
  const { t } = useI18n();
  const { id = '' } = useParams();
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
    queryFn: () => adminApi.user(id).then((result) => result.data),
    enabled: isAuthenticated && Boolean(id),
  });

  const rafraichir = () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.admin.user(id) });
    void queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
  };

  /** Exécute une mutation admin, rapporte le résultat, rafraîchit la fiche. */
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

  if (!isAuthenticated) {
    return (
      <Section>
        <AuthGate isAuthenticated={false} title={t('ui.ficheCompte')} description={t('ui.connexionRequise')} icon="👤">
          <Text preset="bodyMd" color={COLORS.slateGray}>{t('ui.connecteToiPourConsulterLaFiche')}</Text>
        </AuthGate>
      </Section>
    );
  }

  if (fiche.isLoading) {
    return (
      <Section>
        <LoadingState count={3} height={120} />
      </Section>
    );
  }

  if (fiche.isError || !fiche.data) {
    return (
      <Section>
        <ErrorState error={fiche.error} onRetry={() => void fiche.refetch()} showRequestId />
      </Section>
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
    <Section>
      <Text preset="caption" color={COLORS.slateGray} style={{ marginBottom: 8 }}>
        <Link to="/admin/users" style={{ color: COLORS.forestGreen }}>{t('ui.retourAuxComptes')}</Link>
      </Text>
      <Text preset="h1" style={{ fontSize: 32, marginBottom: 4 }}>
        {String(utilisateur.firstName ?? '')} {String(utilisateur.lastName ?? '')}
      </Text>
      <Text preset="bodyMd" color={COLORS.slateGray} style={{ marginBottom: 24 }}>
        {String(utilisateur.email ?? '')} · {String(utilisateur.countryCode ?? '')} ·{' '}
        <StatusChip value={utilisateur.status} />
      </Text>

      {rapport && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: DURATION.base / 1000, ease: EASE.out }}
          style={{
            marginBottom: 16,
            padding: '12px 16px',
            borderRadius: 12,
            border: `1px solid ${rapport.ton === 'succes' ? COLORS.success : COLORS.error}`,
            background: rapport.ton === 'succes' ? 'rgba(23, 100, 60, 0.08)' : 'rgba(160, 40, 40, 0.08)',
          }}
        >
          <Text preset="bodyMd" color={rapport.ton === 'succes' ? COLORS.success : COLORS.error}>
            {rapport.texte}
          </Text>
        </motion.div>
      )}

      <SectionCarte titre={t('ui.profilEtOrganisationS')}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
          <Text preset="bodyMd">{t('ui.telephone', { value: String(utilisateur.phone ?? '—') })}</Text>
          <Text preset="bodyMd">{t('ui.langue', { value: String(utilisateur.locale ?? '—') })}</Text>
          <Text preset="bodyMd">{t('ui.eMailVerifie', { value: data.verification.emailVerifiedAt ? '✅' : '❌' })}</Text>
          <Text preset="bodyMd">{t('ui.telephoneVerifie', { value: data.verification.phoneVerifiedAt ? '✅' : '❌' })}</Text>
          <Text preset="bodyMd">{t('ui.creeLe_53f56', { value: utilisateur.createdAt ? String(utilisateur.createdAt).slice(0, 10) : '—' })}</Text>
          <Text preset="bodyMd">{t('ui.derniereConnexion', { value: utilisateur.lastLoginAt ? String(utilisateur.lastLoginAt).slice(0, 16).replace('T', ' ') : 'jamais' })}</Text>
        </div>
        <div style={{ marginTop: 12 }}>
          {data.organizations.map((org) => (
            <ChipRow key={String(org.membershipId)}>
              <Chip label={String((org.organization as Record<string, unknown> | null)?.name ?? org.organizationId)} />
              {(org.roles as string[]).map((r) => (
                <Chip key={r} label={r} tone="success" />
              ))}
              <Chip label={String(org.status)} />
            </ChipRow>
          ))}
        </div>
      </SectionCarte>

      <SectionCarte titre={t('ui.securite_33e96')}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
          <Text preset="bodyMd">{t('ui.mfa')}{' '}{data.security.mfaEnabled ? t('ui.active') : t('ui.inactive')}</Text>
          <Text preset="bodyMd">{t('ui.tentativesEchouees', { failedLoginAttempts: String(data.security.failedLoginAttempts) })}</Text>
          <Text preset="bodyMd">{t('ui.verrouille')}{' '}{data.security.locked ? t('ui.ouiJusquAu', { lockedUntil: String(data.security.lockedUntil) }) : 'non'}
          </Text>
        </div>
      </SectionCarte>

      <SectionCarte titre={t('ui.actionsOperationnellesPalier1')}>
        <Text preset="caption" color={COLORS.slateGray} style={{ marginBottom: 8 }}>{t('ui.leMotifEstRequisEtJournalise')}</Text>
        <Input
          label={t('ui.motif')}
          placeholder={t('ui.motifDeLAction3Caracteres')}
          value={motif}
          onChange={(event) => setMotif(event.target.value)}
          style={{ marginBottom: 12 }}
        />
        <ChipRow>
          <Button
            label={suspendu ? t('ui.reactiver') : t('ui.suspendre')}
            variant="outline"
            disabled={occupe || motif.trim().length < 3}
            onClick={() =>
              executer(suspendu ? t('ui.reactivation') : t('ui.suspension'), () =>
                adminApi.setUserStatus(id, {
                  status: suspendu ? 'ACTIVE' : 'SUSPENDED',
                  reason: motif.trim(),
                }),
              )
            }
          />
          <Button
            label={t('ui.deverrouiller')}
            variant="outline"
            disabled={occupe}
            onClick={() => executer(t('ui.deverrouillage'), () => adminApi.unlockUser(id, { reason: motif.trim() || undefined }))}
          />
          <Button
            label={t('ui.forcerLaDeconnexion')}
            variant="outline"
            disabled={occupe}
            onClick={() =>
              executer(t('ui.revocationDesSessions'), () => adminApi.forceLogout(id, { reason: motif.trim() || undefined }))
            }
          />
          <Button
            label={t('ui.eMailVerifie_aa657')}
            variant="outline"
            disabled={occupe || motif.trim().length < 3}
            onClick={() => executer(t('ui.marquageEMailVerifie'), () => adminApi.verifyUserEmail(id, { reason: motif.trim() }))}
          />
          <Button
            label={t('ui.telephoneVerifie_8a357')}
            variant="outline"
            disabled={occupe || motif.trim().length < 3}
            onClick={() => executer(t('ui.marquageTelephoneVerifie'), () => adminApi.verifyUserPhone(id, { reason: motif.trim() }))}
          />
        </ChipRow>
      </SectionCarte>

      {estSuperAdmin && (
        <SectionCarte titre={t('ui.rolesDeGouvernancePalier2Super')}>
          <Text preset="caption" color={COLORS.slateGray} style={{ marginBottom: 8 }}>{t('ui.attributionProtegeeParLeSecondFacteur')}</Text>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12, marginBottom: 12 }}>
            <label style={{ display: 'grid', gap: 6 }}>
              <Text preset="caption" color={COLORS.slateGray}>{t('ui.roleAAttribuer')}</Text>
              <select
                value={roleChoisi}
                onChange={(event) => setRoleChoisi(event.target.value)}
                style={{
                  padding: '10px 12px',
                  borderRadius: 10,
                  border: `1px solid ${COLORS.lightBorder}`,
                  background: COLORS.surface,
                  color: COLORS.textPrimary,
                  fontSize: 14,
                }}
              >
                {ROLES_GOUVERNANCE.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </label>
            <Input
              label={t('ui.codeMfa')}
              placeholder={t('ui.codeA6Chiffres')}
              value={mfaCode}
              onChange={(event) => setMfaCode(event.target.value)}
            />
            {roleChoisi === 'SUPER_ADMIN' && (
              <Input
                label={t('ui.votreMotDePasseCourant')}
                type="password"
                placeholder={t('ui.requisParRgG3')}
                value={motDePasse}
                onChange={(event) => setMotDePasse(event.target.value)}
              />
            )}
            <Input
              label={t('ui.motif')}
              placeholder={t('ui.motifDeLaNomination')}
              value={motifRole}
              onChange={(event) => setMotifRole(event.target.value)}
            />
          </div>
          <ChipRow>
            <Button
              label={t('ui.attribuerLeRole')}
              variant="primary"
              disabled={occupe || mfaCode.trim().length < 6 || motifRole.trim().length < 3}
              onClick={() =>
                executer(t('ui.attribution', { roleChoisi }), () =>
                  adminApi.grantRole(id, {
                    role: roleChoisi,
                    mfaCode: mfaCode.trim(),
                    ...(roleChoisi === 'SUPER_ADMIN' ? { password: motDePasse } : {}),
                    reason: motifRole.trim(),
                  }),
                )
              }
            />
            {(data.organizations ?? [])
              .flatMap((org) => (org.roles as string[]).map((r) => ({ role: r })))
              .filter(({ role }) => ROLES_GOUVERNANCE.includes(role as (typeof ROLES_GOUVERNANCE)[number]))
              .map(({ role }) => (
                <Button
                  key={role}
                  label={t('ui.revoquer', { role })}
                  variant="ghost"
                  disabled={occupe}
                  onClick={() => executer(t('ui.revocation', { role }), () => adminApi.revokeRole(id, role))}
                />
              ))}
          </ChipRow>
        </SectionCarte>
      )}

      {estSuperAdmin && (
        <SectionCarte titre={t('ui.donneesEtSuppressionPalier2')}>
          <ChipRow>
            <Button
              label={t('ui.exporterLesDonneesPortabilite')}
              variant="outline"
              disabled={occupe}
              onClick={() =>
                executer(t('ui.exportDePortabilite'), () =>
                  adminApi.exportUser(id).then((result) => {
                    const contenu = JSON.stringify(result.data, null, 2);
                    const lien = document.createElement('a');
                    lien.href = URL.createObjectURL(new Blob([contenu], { type: 'application/json' }));
                    lien.download = `portabilite-${id}.json`;
                    lien.click();
                    URL.revokeObjectURL(lien.href);
                  }),
                )
              }
            />
            <Button
              label={t('ui.supprimerLeCompteLogique')}
              variant="danger"
              disabled={occupe || motif.trim().length < 3}
              onClick={() =>
                executer(t('ui.suppressionLogique_36532'), () => adminApi.deleteUser(id, { reason: motif.trim() }))
              }
            />
          </ChipRow>
        </SectionCarte>
      )}

      <SectionCarte titre={t('ui.historiqueDActionsAuditees')}>
        {data.auditTrail.length === 0 ? (
          <Text preset="bodyMd" color={COLORS.slateGray}>{t('ui.aucuneActionAuditeePourCeCompte')}</Text>
        ) : (
          <div style={{ display: 'grid', gap: 8 }}>
            {data.auditTrail.map((entree) => (
              <Text key={String(entree.id)} preset="caption" color={COLORS.slateGray}>
                <DateCell value={entree.createdAt} />{' '}{t('ui.sur', { action: String(entree.action), resource: String(entree.resource) })}</Text>
            ))}
          </div>
        )}
      </SectionCarte>
    </Section>
  );
}
