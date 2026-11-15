import { ResourcePage } from '@/components/pages';
import { Chip } from '@/components/ui';
import { formatDate } from '@/lib/format';
import { useI18n } from '@/i18n';

type Invitation = Record<string, unknown>;

/** ORGANIZATION — invitations envoyées. */
export default function OrganizationInvitations() {
  const { t } = useI18n();
  const { locale } = useI18n();
  return (
    <ResourcePage<Invitation>
      title={t('ui.invitations')}
      subtitle={t('ui.invitationsEnvoyeesARejoindreVotreOrganisation')}
      icon="✉️"
      queryKey={['organizations', 'invitations'] as unknown[]}
      fetch={async () => [] as Invitation[]}
      rowKey={(invitation) => String(invitation.id)}
      columns={[
        { key: 'email', label: t('ui.email'), render: (invitation) => String(invitation.email ?? '—') },
        { key: 'role', label: t('ui.role'), render: (invitation) => <Chip label={String(invitation.role ?? '—')} tone="neutral" size="sm" /> },
        { key: 'status', label: t('ui.statut'), render: (invitation) => <Chip label={String(invitation.status ?? '—')} tone={String(invitation.status) === 'ACCEPTED' ? 'success' : 'neutral'} size="sm" /> },
        { key: 'sentAt', label: t('ui.envoyeeLe'), render: (invitation) => (invitation.createdAt ? formatDate(String(invitation.createdAt), locale) : '—') },
      ]}
      emptyTitle={t('ui.aucuneInvitation')}
      emptyDescription={t('ui.aucuneInvitationNAEncoreEte')}
    />
  );
}
