import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';

import { AuthGate, Button, Card, ErrorState, Input, Section, Text, TextArea } from '@/components/ui';
import { authApi } from '@/services/endpoints';
import { useAuthStore } from '@/store/auth';

const csv = (value: string) => value.split(',').map((item) => item.trim()).filter(Boolean);

export default function ProfessionalProfile() {
  const user = useAuthStore((state) => state.user);
  const isAuthenticated = useAuthStore((state) => state.status === 'authenticated');
  const refreshProfile = useAuthStore((state) => state.refreshProfile);
  const professional = user?.professionalProfile ?? {};
  const [firstName, setFirstName] = useState(user?.firstName ?? '');
  const [lastName, setLastName] = useState(user?.lastName ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [jobTitle, setJobTitle] = useState(professional.jobTitle ?? '');
  const [activityDomain, setActivityDomain] = useState(professional.activityDomain ?? '');
  const [expertise, setExpertise] = useState(professional.expertise ?? '');
  const [yearsExperience, setYearsExperience] = useState(String(professional.yearsExperience ?? ''));
  const [biography, setBiography] = useState(professional.biography ?? '');
  const [services, setServices] = useState((professional.services ?? []).join(', '));
  const [specialties, setSpecialties] = useState((professional.specialties ?? []).join(', '));
  const [zones, setZones] = useState((professional.interventionZones ?? []).join(', '));

  const save = useMutation({
    mutationFn: () =>
      authApi.updateMe({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        ...(phone.trim() ? { phone: phone.trim() } : {}),
        professionalProfile: {
          ...professional,
          jobTitle: jobTitle.trim(),
          activityDomain: activityDomain.trim(),
          expertise: expertise.trim(),
          ...(yearsExperience.trim() ? { yearsExperience: Number(yearsExperience) } : {}),
          biography: biography.trim(),
          services: csv(services),
          specialties: csv(specialties),
          interventionZones: csv(zones),
        },
      }),
    onSuccess: () => void refreshProfile(),
  });

  return (
    <Section>
      <AuthGate isAuthenticated={isAuthenticated} title="Profil professionnel indépendant" icon="💼">
        <div style={{ maxWidth: 760 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 24 }}>
            <div>
              <Text preset="h1">Profil professionnel indépendant</Text>
              <Text preset="bodyMd">Identité personnelle, compétences, prestations et visibilité professionnelle.</Text>
            </div>
            <Link to="/professional/settings"><Button label="Paramètres" variant="outline" /></Link>
          </div>
          <form onSubmit={(event) => { event.preventDefault(); save.mutate(); }}>
            <Card tone="white">
              <div style={grid}>
                <Input label="Prénom" value={firstName} onChange={(event) => setFirstName(event.target.value)} required />
                <Input label="Nom" value={lastName} onChange={(event) => setLastName(event.target.value)} required />
                <Input label="Téléphone" value={phone} onChange={(event) => setPhone(event.target.value)} />
                <Input label="Profession" value={jobTitle} onChange={(event) => setJobTitle(event.target.value)} />
                <Input label="Domaine d’activité" value={activityDomain} onChange={(event) => setActivityDomain(event.target.value)} />
                <Input label="Secteur d’expertise" value={expertise} onChange={(event) => setExpertise(event.target.value)} />
                <Input label="Années d’expérience" type="number" min={0} max={80} value={yearsExperience} onChange={(event) => setYearsExperience(event.target.value)} />
                <Input label="Spécialités, séparées par des virgules" value={specialties} onChange={(event) => setSpecialties(event.target.value)} />
                <Input label="Services proposés, séparés par des virgules" value={services} onChange={(event) => setServices(event.target.value)} />
                <Input label="Zones d’intervention, séparées par des virgules" value={zones} onChange={(event) => setZones(event.target.value)} />
                <TextArea label="Biographie professionnelle" value={biography} onChange={(event) => setBiography(event.target.value)} />
              </div>
              <div style={{ marginTop: 16 }}>
                {save.error ? <ErrorState error={save.error} /> : null}
                <Button label="Enregistrer mon profil" type="submit" loading={save.isPending} />
              </div>
            </Card>
          </form>
        </div>
      </AuthGate>
    </Section>
  );
}

const grid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 } as const;
