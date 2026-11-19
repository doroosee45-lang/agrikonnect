import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';

import { AuthGate, Button, Card, Chip, ChipRow, ErrorState, Input, LoadingState, Section, Text, TextArea } from '@/components/ui';
import { organizationApi } from '@/services/endpoints';
import { queryKeys } from '@/services/query';
import { useAuthStore } from '@/store/auth';
import { COLORS } from '@/theme';
import { getActiveOrganizationId } from '@/lib/redirects';

const csv = (value: string) => value.split(',').map((item) => item.trim()).filter(Boolean);

export default function OrganizationProfile() {
  const params = useParams();
  const isAuthenticated = useAuthStore((state) => state.status === 'authenticated');
  const canWrite = useAuthStore((state) => state.can('organizations.write'));
  const organizations = useAuthStore((state) => state.user?.organizations ?? []);
  const organizationId = params.id ?? getActiveOrganizationId() ?? organizations[0]?.id ?? '';
  const query = useQuery({
    queryKey: queryKeys.organizations.one(organizationId),
    queryFn: () => organizationApi.get(organizationId).then((result) => result.data),
    enabled: isAuthenticated && Boolean(organizationId),
  });
  const [form, setForm] = useState({
    name: '', description: '', officialName: '', tradingName: '', logoUrl: '', coverUrl: '',
    sector: '', foundedAt: '', legalForm: '', registrationNumber: '', taxIdentifier: '',
    legalRepresentative: '', headquartersAddress: '', officialPhone: '', institutionalEmail: '',
    website: '', activities: '', locations: '', partners: '',
  });

  useEffect(() => {
    const org = query.data;
    if (!org) return;
    const details = org.profileDetails ?? {};
    setForm({
      name: org.name,
      description: org.description ?? '',
      officialName: details.officialName ?? org.name,
      tradingName: details.tradingName ?? '',
      logoUrl: details.logoUrl ?? '',
      coverUrl: details.coverUrl ?? '',
      sector: details.sector ?? '',
      foundedAt: details.foundedAt ?? '',
      legalForm: details.legalForm ?? '',
      registrationNumber: details.registrationNumber ?? '',
      taxIdentifier: details.taxIdentifier ?? '',
      legalRepresentative: details.legalRepresentative ?? '',
      headquartersAddress: details.headquartersAddress ?? '',
      officialPhone: details.officialPhone ?? '',
      institutionalEmail: details.institutionalEmail ?? '',
      website: details.website ?? '',
      activities: (details.activities ?? []).join(', '),
      locations: (details.locations ?? []).join(', '),
      partners: (details.partners ?? []).join(', '),
    });
  }, [query.data]);

  const save = useMutation({
    mutationFn: () =>
      organizationApi.update(organizationId, {
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        profileDetails: {
          officialName: form.officialName.trim(),
          tradingName: form.tradingName.trim(),
          logoUrl: form.logoUrl.trim(),
          coverUrl: form.coverUrl.trim(),
          sector: form.sector.trim(),
          ...(form.foundedAt.trim() ? { foundedAt: form.foundedAt.trim() } : {}),
          registrationCountry: query.data?.countryCode,
          legalForm: form.legalForm.trim(),
          registrationNumber: form.registrationNumber.trim(),
          taxIdentifier: form.taxIdentifier.trim(),
          legalRepresentative: form.legalRepresentative.trim(),
          headquartersAddress: form.headquartersAddress.trim(),
          officialPhone: form.officialPhone.trim(),
          institutionalEmail: form.institutionalEmail.trim(),
          website: form.website.trim(),
          socialLinks: [],
          activities: csv(form.activities),
          locations: csv(form.locations),
          partners: csv(form.partners),
        },
      }),
    onSuccess: () => void query.refetch(),
  });
  const set = <K extends keyof typeof form>(key: K, value: string) =>
    setForm((current) => ({ ...current, [key]: value }));

  return (
    <Section>
      <AuthGate isAuthenticated={isAuthenticated} title="Profil de l’organisation" icon="🏢">
        <div style={{ maxWidth: 820 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 24 }}>
            <div>
              <Text preset="h1">Profil de l’organisation</Text>
              <Text preset="bodyMd" color={COLORS.slateGray}>Identité institutionnelle, coordonnées, direction et activités.</Text>
            </div>
            <Link to="/organization/settings"><Button label="Paramètres" variant="outline" /></Link>
          </div>

          {query.isLoading ? <LoadingState count={2} height={120} /> : query.isError ? (
            <ErrorState error={query.error} onRetry={() => void query.refetch()} showRequestId />
          ) : !query.data ? (
            <Text preset="bodyMd">Aucune organisation accessible.</Text>
          ) : (
            <form onSubmit={(event) => { event.preventDefault(); save.mutate(); }} style={{ display: 'grid', gap: 16 }}>
              <Card tone="white">
                <Text preset="h3" style={{ marginBottom: 12 }}>Identité de l’organisation</Text>
                <ChipRow>
                  {query.data.roles.map((role) => <Chip key={role} label={role} tone="info" size="sm" />)}
                </ChipRow>
                <Text preset="caption" color={COLORS.slateGray} style={{ margin: '12px 0' }}>
                  {query.data.type} · {query.data.countryCode} · {query.data.slug ?? query.data.id}
                </Text>
                <div style={grid}>
                  <Input label="Nom affiché" value={form.name} onChange={(event) => set('name', event.target.value)} disabled={!canWrite} required />
                  <Input label="Nom officiel" value={form.officialName} onChange={(event) => set('officialName', event.target.value)} disabled={!canWrite} />
                  <Input label="Nom commercial" value={form.tradingName} onChange={(event) => set('tradingName', event.target.value)} disabled={!canWrite} />
                  <Input label="URL du logo" value={form.logoUrl} onChange={(event) => set('logoUrl', event.target.value)} disabled={!canWrite} />
                  <Input label="URL de couverture" value={form.coverUrl} onChange={(event) => set('coverUrl', event.target.value)} disabled={!canWrite} />
                  <Input label="Secteur d’activité" value={form.sector} onChange={(event) => set('sector', event.target.value)} disabled={!canWrite} />
                  <TextArea label="Description institutionnelle" value={form.description} onChange={(event) => set('description', event.target.value)} disabled={!canWrite} />
                </div>
              </Card>

              <Card tone="white">
                <Text preset="h3" style={{ marginBottom: 16 }}>Informations juridiques et coordonnées</Text>
                <div style={grid}>
                  <Input label="Date de création (AAAA-MM-JJ)" value={form.foundedAt} onChange={(event) => set('foundedAt', event.target.value)} disabled={!canWrite} />
                  <Input label="Forme juridique, si applicable" value={form.legalForm} onChange={(event) => set('legalForm', event.target.value)} disabled={!canWrite} />
                  <Input label="Numéro d’immatriculation, si applicable" value={form.registrationNumber} onChange={(event) => set('registrationNumber', event.target.value)} disabled={!canWrite} />
                  <Input label="Identifiant fiscal, si applicable" value={form.taxIdentifier} onChange={(event) => set('taxIdentifier', event.target.value)} disabled={!canWrite} />
                  <Input label="Représentant légal" value={form.legalRepresentative} onChange={(event) => set('legalRepresentative', event.target.value)} disabled={!canWrite} />
                  <Input label="Adresse du siège" value={form.headquartersAddress} onChange={(event) => set('headquartersAddress', event.target.value)} disabled={!canWrite} />
                  <Input label="Téléphone officiel" value={form.officialPhone} onChange={(event) => set('officialPhone', event.target.value)} disabled={!canWrite} />
                  <Input label="E-mail institutionnel" value={form.institutionalEmail} onChange={(event) => set('institutionalEmail', event.target.value)} disabled={!canWrite} />
                  <Input label="Site Internet" value={form.website} onChange={(event) => set('website', event.target.value)} disabled={!canWrite} />
                </div>
              </Card>

              <Card tone="white">
                <Text preset="h3" style={{ marginBottom: 16 }}>Activités et implantation</Text>
                <div style={grid}>
                  <Input label="Domaines d’intervention, séparés par des virgules" value={form.activities} onChange={(event) => set('activities', event.target.value)} disabled={!canWrite} />
                  <Input label="Implantations, séparées par des virgules" value={form.locations} onChange={(event) => set('locations', event.target.value)} disabled={!canWrite} />
                  <Input label="Partenaires, séparés par des virgules" value={form.partners} onChange={(event) => set('partners', event.target.value)} disabled={!canWrite} />
                </div>
                <Link to="/organization/members"><Button label="Gérer les membres et permissions" variant="outline" /></Link>
              </Card>

              {!canWrite ? <Text preset="caption" color={COLORS.slateGray}>Lecture seule : seul un responsable autorisé peut modifier ce profil.</Text> : null}
              {save.error ? <ErrorState error={save.error} showRequestId /> : null}
              {canWrite ? <Button label="Enregistrer le profil de l’organisation" type="submit" loading={save.isPending} /> : null}
            </form>
          )}
        </div>
      </AuthGate>
    </Section>
  );
}

const grid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 } as const;
