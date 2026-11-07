import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import { AuthGate, Button, Card, CardBody, Chip, Input, Section, Text } from '@/components/ui';
import { adminApi } from '@/services/endpoints';
import { queryKeys } from '@/services/query';
import { useAuthStore } from '@/store/auth';
import { COLORS } from '@/theme';

type Dict = Record<string, unknown>;

const asDict = (value: unknown): Dict => (value && typeof value === 'object' ? (value as Dict) : {});
const asArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);
const asText = (value: unknown, repli = '—'): string => {
  if (typeof value === 'string' && value.length > 0) return value;
  if (typeof value === 'number') return String(value);
  return repli;
};

const formatDate = (value: unknown): string => {
  if (typeof value !== 'string' || !value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('fr-FR');
};

const SEVERITE_TONE: Record<string, 'error' | 'warning' | 'info'> = {
  haute: 'error',
  moyenne: 'warning',
  info: 'info',
};

const telecharger = (contenu: string, filename: string, type: string) => {
  const blob = new Blob([contenu], { type });
  const url = URL.createObjectURL(blob);
  const lien = document.createElement('a');
  lien.href = url;
  lien.download = filename;
  lien.click();
  URL.revokeObjectURL(url);
};

/** M6 U-M6-1 — journal d'audit : recherche avancée (acteur, action, ressource, date, gravité), détail avant/après, export. */
export default function AdminAuditLog() {
  const isAuthenticated = useAuthStore((state) => state.status === 'authenticated');

  const [brouillon, setBrouillon] = useState({ action: '', actor: '', resource: '', from: '', to: '', severity: '' });
  const [filtres, setFiltres] = useState({ action: '', actor: '', resource: '', from: '', to: '', severity: '' });
  const [ouvert, setOuvert] = useState<string | null>(null);
  const [avis, setAvis] = useState('');
  const [erreur, setErreur] = useState('');

  const appliquer = () => setFiltres({ ...brouillon });

  const requete = {
    limit: 100,
    ...(filtres.action.trim() ? { action: filtres.action.trim() } : {}),
    ...(filtres.actor.trim() ? { actor: filtres.actor.trim() } : {}),
    ...(filtres.resource.trim() ? { resource: filtres.resource.trim() } : {}),
    ...(filtres.from ? { from: filtres.from } : {}),
    ...(filtres.to ? { to: filtres.to } : {}),
    ...(filtres.severity ? { severity: filtres.severity } : {}),
  };

  const journal = useQuery({
    queryKey: queryKeys.admin.audit(requete),
    queryFn: () => adminApi.audit(requete).then((result) => ({ lignes: result.data, meta: result.meta })),
    enabled: isAuthenticated,
    retry: false,
  });

  const lignes = asArray(journal.data ? journal.data.lignes : undefined).map(asDict);
  const meta = asDict(journal.data ? journal.data.meta : undefined);

  const exporter = async (format: 'csv' | 'json') => {
    setAvis('');
    setErreur('');
    try {
      const sortie = await adminApi.auditExport({ ...requete, format });
      telecharger(
        sortie.content,
        sortie.filename,
        format === 'csv' ? 'text/csv;charset=utf-8' : 'application/json;charset=utf-8',
      );
      setAvis(`Export généré : ${sortie.filename}`);
    } catch (caught) {
      const dict = asDict(caught);
      setErreur(typeof dict.message === 'string' && dict.message ? dict.message : 'Export impossible');
    }
  };

  return (
    <Section>
      <AuthGate
        isAuthenticated={isAuthenticated}
        title="Journal d'audit"
        description="Actions sensibles — recherche avancée, détail avant/après, export (U-M6-1)."
        icon="🕒"
      >
        <Text preset="h1" style={{ marginBottom: 8 }}>
          Journal d'audit
        </Text>
        <Text preset="bodyMd" color={COLORS.slateGray} style={{ marginBottom: 24 }}>
          Recherche par acteur, action, ressource, date et gravité. Le journal est en insertion seule (RG-S2) :
          aucune entrée n'est modifiable ni supprimable ; les exports sont eux-mêmes journalisés (admin.audit.export).
        </Text>

        <Card style={{ marginBottom: 16 }}>
          <CardBody>
            <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}>
              <Input
                label="Action"
                placeholder="Ex. : auth.login"
                value={brouillon.action}
                onChange={(event) => setBrouillon({ ...brouillon, action: event.target.value })}
              />
              <Input
                label="Acteur"
                placeholder="E-mail, nom ou identifiant"
                value={brouillon.actor}
                onChange={(event) => setBrouillon({ ...brouillon, actor: event.target.value })}
              />
              <Input
                label="Ressource"
                placeholder="Ex. : profile"
                value={brouillon.resource}
                onChange={(event) => setBrouillon({ ...brouillon, resource: event.target.value })}
              />
              <Input
                label="Du"
                type="date"
                value={brouillon.from}
                onChange={(event) => setBrouillon({ ...brouillon, from: event.target.value })}
              />
              <Input
                label="Au"
                type="date"
                value={brouillon.to}
                onChange={(event) => setBrouillon({ ...brouillon, to: event.target.value })}
              />
              <label style={{ display: 'grid', gap: 6 }}>
                <Text preset="caption" color={COLORS.slateGray}>
                  Gravité
                </Text>
                <select
                  value={brouillon.severity}
                  onChange={(event) => setBrouillon({ ...brouillon, severity: event.target.value })}
                  style={{
                    padding: '10px 12px',
                    borderRadius: 10,
                    border: `1px solid ${COLORS.lightBorder}`,
                    background: COLORS.surface,
                    color: COLORS.textPrimary,
                    fontSize: 14,
                  }}
                >
                  <option value="">Toutes</option>
                  <option value="haute">haute</option>
                  <option value="moyenne">moyenne</option>
                  <option value="info">info</option>
                </select>
              </label>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
              <Button label="Rechercher" size="sm" onClick={appliquer} />
              <Button
                label="Réinitialiser"
                variant="outline"
                size="sm"
                onClick={() => {
                  const vide = { action: '', actor: '', resource: '', from: '', to: '', severity: '' };
                  setBrouillon(vide);
                  setFiltres(vide);
                }}
              />
              <Button label="Exporter CSV" variant="outline" size="sm" onClick={() => void exporter('csv')} />
              <Button label="Exporter JSON" variant="outline" size="sm" onClick={() => void exporter('json')} />
            </div>
          </CardBody>
        </Card>

        {avis ? (
          <Card style={{ marginBottom: 12 }}>
            <CardBody>
              <Text preset="bodySm">{avis}</Text>
            </CardBody>
          </Card>
        ) : null}
        {erreur ? (
          <Card style={{ marginBottom: 12 }}>
            <CardBody>
              <Text preset="bodySm">{erreur}</Text>
            </CardBody>
          </Card>
        ) : null}

        <Text preset="caption" color={COLORS.slateGray} style={{ marginBottom: 12 }}>
          page {asNombreSafe(meta.page)} · {lignes.length} entrées affichées · total {asNombreSafe(meta.total)}
        </Text>

        <div style={{ display: 'grid', gap: 8 }}>
          {journal.isLoading ? (
            <Text preset="bodyMd" color={COLORS.slateGray}>
              Chargement…
            </Text>
          ) : lignes.length === 0 ? (
            <Text preset="bodyMd" color={COLORS.slateGray}>
              Aucune entrée d'audit pour ces critères.
            </Text>
          ) : (
            lignes.map((ligne, index) => {
              const cle = asText(ligne.id, `entree-${String(index)}`);
              const acteur = asDict(ligne.actor);
              const nomActeur = [acteur.firstName, acteur.lastName].filter(Boolean).join(' ');
              return (
                <Card key={cle}>
                  <CardBody>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <Chip
                        label={asText(ligne.severity, 'info')}
                        tone={SEVERITE_TONE[asText(ligne.severity, 'info')] ?? 'info'}
                      />
                      <Text preset="bodySm">{asText(ligne.action)}</Text>
                      <Text preset="caption" color={COLORS.slateGray}>
                        {asText(ligne.resource)} · {formatDate(ligne.createdAt)} ·{' '}
                        {nomActeur || asText(ligne.actorId)}
                      </Text>
                      <Button
                        label={ouvert === cle ? 'Masquer' : 'Détail'}
                        variant="ghost"
                        size="sm"
                        onClick={() => setOuvert(ouvert === cle ? null : cle)}
                      />
                    </div>
                    {ouvert === cle ? (
                      <div style={{ marginTop: 12, display: 'grid', gap: 8 }}>
                        <Text preset="caption" color={COLORS.slateGray}>
                          Identifiant : {cle} · Ressource : {asText(ligne.resource)} ({asText(ligne.resourceId)}) ·
                          Adresse IP : {asText(ligne.ip)} · Agent : {asText(ligne.userAgent)}
                        </Text>
                        <div>
                          <Text preset="caption" color={COLORS.slateGray}>
                            Avant
                          </Text>
                          <Text preset="bodySm">{ligne.oldValue === null || ligne.oldValue === undefined ? '—' : JSON.stringify(ligne.oldValue, null, 2)}</Text>
                        </div>
                        <div>
                          <Text preset="caption" color={COLORS.slateGray}>
                            Après
                          </Text>
                          <Text preset="bodySm">{ligne.newValue === null || ligne.newValue === undefined ? '—' : JSON.stringify(ligne.newValue, null, 2)}</Text>
                        </div>
                      </div>
                    ) : null}
                  </CardBody>
                </Card>
              );
            })
          )}
        </div>
      </AuthGate>
    </Section>
  );
}

function asNombreSafe(value: unknown): string {
  return typeof value === 'number' ? String(value) : '—';
}
