import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';

import { AuthGate, ChipRow, FilterChip, Input, Section, Text } from '@/components/ui';
import { ResourcePage, StatusChip, DateCell, render, type Row } from '@/components/pages';
import { adminApi } from '@/services/endpoints';
import { queryKeys } from '@/services/query';
import { useAuthStore } from '@/store/auth';
import { COLORS, DURATION, EASE } from '@/theme';

/**
 * ADMIN M2 — comptes utilisateurs (SPEC-SUPER-ADMIN U-M2-1).
 *
 * Liste paginée et filtrée : terme (e-mail, nom, téléphone), statut, rôle,
 * MFA. Chaque ligne ouvre la fiche complète (`/admin/users/:id`, U-M2-2).
 * Aucune valeur simulée : l'écran n'affiche que ce que l'API renvoie.
 */

const STATUTS = [
  { valeur: '', label: 'Tous les statuts' },
  { valeur: 'ACTIVE', label: 'Actifs' },
  { valeur: 'SUSPENDED', label: 'Suspendus' },
] as const;

const ROLES_FILTRE = [
  '', 'SUPER_ADMIN', 'ADMIN', 'COUNTRY_ADMIN', 'DATA_STEWARD', 'MODERATOR',
  'VERIFIER', 'LAB_PARTNER', 'FARMER', 'COOPERATIVE_ADMIN', 'BUYER',
  'SUPPLIER', 'TRANSPORTER', 'AGRONOMIST', 'INVESTOR',
] as const;

export default function AdminUsers() {
  const isAuthenticated = useAuthStore((state) => state.status === 'authenticated');
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<string>('');
  const [role, setRole] = useState<string>('');
  const [mfa, setMfa] = useState<string>('');

  const filtres = useMemo(
    () => ({
      limit: 100,
      ...(q.trim() ? { q: q.trim() } : {}),
      ...(status ? { status } : {}),
      ...(role ? { role } : {}),
      ...(mfa ? { mfa } : {}),
    }),
    [q, status, role, mfa],
  );

  return (
    <Section>
      <AuthGate
        isAuthenticated={isAuthenticated}
        title="Comptes"
        description="Gestion des utilisateurs, administrateurs et rôles."
        icon="👥"
      >
        <ResourcePage<Row>
          title="Comptes"
          subtitle="Tous les comptes de la plateforme : recherche, statut, rôles, MFA."
          icon="👥"
          queryKey={queryKeys.admin.users(filtres)}
          fetch={() => adminApi.users(filtres).then((result) => result.data)}
          rowKey={(row) => String(row.id)}
          rowHref={(row) => `/admin/users/${String(row.id)}`}
          toolbar={
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: DURATION.base / 1000, ease: EASE.out }}
              style={{ display: 'grid', gap: 12, marginBottom: 16 }}
            >
              <Input
                label="Recherche"
                placeholder="E-mail, nom, téléphone…"
                value={q}
                onChange={(event) => setQ(event.target.value)}
              />
              <ChipRow>
                {STATUTS.map((s) => (
                  <FilterChip
                    key={s.valeur || 'tous'}
                    label={s.label}
                    active={status === s.valeur}
                    onPress={() => setStatus(s.valeur)}
                  />
                ))}
                <FilterChip
                  label="MFA active"
                  active={mfa === 'true'}
                  onPress={() => setMfa(mfa === 'true' ? '' : 'true')}
                />
              </ChipRow>
              <label style={{ display: 'grid', gap: 6 }}>
                <Text preset="caption" color={COLORS.slateGray}>
                  Rôle
                </Text>
                <select
                  value={role}
                  onChange={(event) => setRole(event.target.value)}
                  style={{
                    padding: '10px 12px',
                    borderRadius: 10,
                    border: `1px solid ${COLORS.lightBorder}`,
                    background: COLORS.surface,
                    color: COLORS.textPrimary,
                    fontSize: 14,
                  }}
                >
                  {ROLES_FILTRE.map((r) => (
                    <option key={r || 'tous'} value={r}>
                      {r || 'Tous les rôles'}
                    </option>
                  ))}
                </select>
              </label>
            </motion.div>
          }
          columns={[
            { key: 'email', label: 'Email', render: render('email') },
            {
              key: 'name',
              label: 'Nom',
              render: (row) =>
                `${String(row.firstName ?? '')} ${String(row.lastName ?? '')}`.trim() || '—',
            },
            {
              key: 'roles',
              label: 'Rôles',
              render: (row) => {
                const roles = Array.isArray(row.memberships)
                  ? [...new Set(row.memberships.flatMap((m: { roles?: string[] }) => m.roles ?? []))]
                  : [];
                return roles.length ? roles.join(', ') : '—';
              },
            },
            { key: 'countryCode', label: 'Pays', render: render('countryCode') },
            { key: 'status', label: 'Statut', render: (row) => <StatusChip value={row.status} /> },
            {
              key: 'mfaEnabled',
              label: 'MFA',
              render: (row) => (row.mfaEnabled ? '✅' : '—'),
            },
            { key: 'createdAt', label: 'Créé le', render: (row) => <DateCell value={row.createdAt} /> },
          ]}
          emptyTitle="Aucun compte"
          emptyDescription="L'API d'administration n'a renvoyé aucun compte pour ces filtres."
        />
      </AuthGate>
    </Section>
  );
}
