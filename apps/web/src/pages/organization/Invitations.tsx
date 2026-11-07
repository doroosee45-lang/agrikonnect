import { ResourcePage } from '@/components/pages';
import { Chip } from '@/components/ui';
import { formatDate } from '@/lib/format';
import { useI18n } from '@/i18n';

type Invitation = Record<string, unknown>;

/** ORGANIZATION — invitations envoyées. */
export default function OrganizationInvitations() {
  const { locale } = useI18n();
  return (
    <ResourcePage<Invitation>
      title="Invitations"
      subtitle="Invitations envoyées à rejoindre votre organisation."
      icon="✉️"
      queryKey={['organizations', 'invitations'] as unknown[]}
      fetch={async () => [] as Invitation[]}
      rowKey={(invitation) => String(invitation.id)}
      columns={[
        { key: 'email', label: 'Email', render: (invitation) => String(invitation.email ?? '—') },
        { key: 'role', label: 'Rôle', render: (invitation) => <Chip label={String(invitation.role ?? '—')} tone="neutral" size="sm" /> },
        { key: 'status', label: 'Statut', render: (invitation) => <Chip label={String(invitation.status ?? '—')} tone={String(invitation.status) === 'ACCEPTED' ? 'success' : 'neutral'} size="sm" /> },
        { key: 'sentAt', label: 'Envoyée le', render: (invitation) => (invitation.createdAt ? formatDate(String(invitation.createdAt), locale) : '—') },
      ]}
      emptyTitle="Aucune invitation"
      emptyDescription="Aucune invitation n'a encore été envoyée."
    />
  );
}
