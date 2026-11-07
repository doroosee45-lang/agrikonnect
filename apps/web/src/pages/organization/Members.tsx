import { ResourcePage } from '@/components/pages';
import { Chip } from '@/components/ui';
import { formatDate } from '@/lib/format';
import { useI18n } from '@/i18n';

type Membership = Record<string, unknown>;

/** ORGANIZATION — membres de l'organisation. */
export default function OrganizationMembers() {
  const { locale } = useI18n();
  return (
    <ResourcePage<Membership>
      title="Membres"
      subtitle="Membres de votre organisation et leurs rôles."
      icon="👥"
      queryKey={['organizations', 'members'] as unknown[]}
      fetch={async () => [] as Membership[]}
      rowKey={(member) => String(member.userId)}
      columns={[
        { key: 'username', label: 'Membre', render: (member) => String(member.displayName ?? member.userId ?? '—') },
        { key: 'roles', label: 'Rôles', render: (member) => String(member.roles ?? '—') },
        { key: 'joinedAt', label: 'Rejoint le', render: (member) => (member.joinedAt ? formatDate(String(member.joinedAt), locale) : '—') },
        { key: 'status', label: 'Statut', render: (member) => <Chip label={String(member.status ?? '—')} tone={String(member.status) === 'ACTIVE' ? 'success' : 'neutral'} size="sm" /> },
      ]}
      emptyTitle="Aucun membre"
      emptyDescription="Invitez des membres pour qu'ils rejoignent votre organisation."
    />
  );
}
