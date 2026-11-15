import { ResourcePage } from '@/components/pages';
import { Chip } from '@/components/ui';
import { formatDate } from '@/lib/format';
import { useI18n } from '@/i18n';

type Membership = Record<string, unknown>;

/** ORGANIZATION — membres de l'organisation. */
export default function OrganizationMembers() {
  const { t } = useI18n();
  const { locale } = useI18n();
  return (
    <ResourcePage<Membership>
      title={t('ui.membres')}
      subtitle={t('ui.membresDeVotreOrganisationEtLeurs')}
      icon="👥"
      queryKey={['organizations', 'members'] as unknown[]}
      fetch={async () => [] as Membership[]}
      rowKey={(member) => String(member.userId)}
      columns={[
        { key: 'username', label: t('ui.membre'), render: (member) => String(member.displayName ?? member.userId ?? '—') },
        { key: 'roles', label: t('ui.roles'), render: (member) => String(member.roles ?? '—') },
        { key: 'joinedAt', label: t('ui.rejointLe_aa4b5'), render: (member) => (member.joinedAt ? formatDate(String(member.joinedAt), locale) : '—') },
        { key: 'status', label: t('ui.statut'), render: (member) => <Chip label={String(member.status ?? '—')} tone={String(member.status) === 'ACTIVE' ? 'success' : 'neutral'} size="sm" /> },
      ]}
      emptyTitle={t('ui.aucunMembre')}
      emptyDescription={t('ui.invitezDesMembresPourQuIls')}
    />
  );
}
