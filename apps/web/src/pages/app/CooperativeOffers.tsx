import { ResourcePage } from '@/components/pages';
import { cooperativeApi } from '@/services/endpoints';
import { queryKeys } from '@/services/query';
import { useQuery } from '@tanstack/react-query';
import { StatusChip, type Row } from '@/components/pages';

/** APP — offres groupées de la coopérative. */
export default function AppCooperativeOffers() {
  const cooperative = useQuery({
    queryKey: queryKeys.cooperatives.current,
    queryFn: () => cooperativeApi.current().then((result) => result.data),
    retry: false,
  });
  const cooperativeId = cooperative.data?.id ?? '';

  return (
    <ResourcePage<Row>
      title="Offres groupées"
      subtitle="Offres consolidées à partir des volumes des membres consentants."
      icon="🤝"
      queryKey={queryKeys.cooperatives.groupOffers(cooperativeId)}
      fetch={() => cooperativeApi.groupOffers(cooperativeId).then((result) => result.data as Row[])}
      rowKey={(offer) => String(offer.id)}
      columns={[
        { key: 'status', label: 'Statut', render: (offer) => <StatusChip value={offer.status} /> },
        { key: 'createdAt', label: 'Créée le', render: (offer) => String(offer.createdAt ?? '—') },
      ]}
      emptyTitle="Aucune offre groupée"
      emptyDescription="Aucune offre groupée n'a été créée."
      notice="Aucun volume n'est consolidé sans le consentement explicite, daté et révocable de chaque membre."
    />
  );
}
