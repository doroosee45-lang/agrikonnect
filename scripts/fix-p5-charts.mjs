#!/usr/bin/env node
/*
 * fix-p5-charts.mjs -- BLOC 95 (Mission 2, Phase 5 : data-viz).
 * but : creer ChartCard (design-system, kit 8) et l ADOPTER dans les deux
 * zones graphiques reels : le bloc Inscriptions de pages/admin/Dashboard.tsx
 * (barres + tableau alternatif) et le bloc Repartition de
 * pages/organization/ProductionSummary.tsx (serie + source).
 * regles : aucun composant orphelin (ChartCard adopte x2 des sa naissance),
 * zero librairie de rendu ajoutee (decision : harmoniser l existant), le
 * graphique lui-meme INTACT (barres, tableau, serie, etats vides), aucune
 * donnee changee (source = stats.data.source, formulation kit Source : X),
 * aucune mention fictive (periode/source optionnelles), aucun hex (I3),
 * aucun npm. StatCard deja adopte (BLOC 93) reste intact.
 */
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const RD = 'D:/AGRIKONNECT/Soupabase/Nouveau dossier/agrikonnect-africa-final';
const GEN = process.argv.includes('--gen');
const RACINE = GEN ? '/tmp/p5tree' : RD;

const md5 = (f) => createHash('md5').update(fs.readFileSync(f)).digest('hex');
const lire = (f) => fs.readFileSync(f, 'utf8');
const ecrire = (f, contenu) => { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, contenu, 'utf8'); };
const verifie = (f, contenu, valeurs) => {
  for (const v of valeurs) {
    if (typeof v === 'string' && !contenu.includes(v)) throw new Error('ABSENT: ' + v + ' @ ' + f);
    if (v instanceof RegExp && !v.test(contenu)) throw new Error('ABSENT_RE: ' + String(v) + ' @ ' + f);
  }
};
function pre(m5, f) {
  const p = path.join(RACINE, f);
  if (!fs.existsSync(p)) throw new Error('MANQUANT ' + f);
  const v = md5(p);
  if (v !== m5) throw new Error('ARRET_MD5 ' + v + ' ' + f + ' (attendu ' + m5 + ')');
  console.log('  [ok] ' + f + ' = ' + v);
}
function post(m5, f, valeurs) {
  const p = path.join(RACINE, f);
  const v = md5(p);
  verifie(p, lire(p), valeurs);
  if (v !== m5) throw new Error('ARRET_MD5_POST ' + v + ' ' + f + ' (attendu ' + m5 + ')');
  console.log('  [ok] ' + f + ' = ' + v);
}
function remplacerTout(f, avant, apres, attendu) {
  const p = path.join(RACINE, f);
  const c = lire(p);
  if (c.split(avant).length - 1 !== attendu) throw new Error('ARRET_ANCRE ' + f + ' : ' + avant.slice(0, 50));
  ecrire(p, c.split(avant).join(apres));
}

console.log('== BLOC 95 : P5, ChartCard cree + adopte dans les 2 zones graphiques ==');

/* 0. portes PRE : cibles exactes + kit intact */
pre('f46b7606175f4824f59bf2597febf399', 'apps/web/src/pages/admin/Dashboard.tsx');
pre('c1afa8737d0f8e9041649d21a650526e', 'apps/web/src/pages/organization/ProductionSummary.tsx');
pre('01d5ce843ce105a64fa82c67362e9467', 'apps/web/src/design-system/index.ts');
pre('c3b5c6aa047b6169c2c37f5a355806f7', 'apps/web/src/design-system/components/StatCard.tsx');

/* 1. ChartCard cree (design-system/components/ChartCard.tsx) */
ecrire(path.join(RACINE, 'apps/web/src/design-system/components/ChartCard.tsx'), 'import type { ReactNode } from \'react\';\n\nimport { cn } from \'../lib/utils\';\n\n/**\n * ChartCard (kit 8) : carte enveloppe des graphiques et repartitions. Titre,\n * periode, source ; le contenu (barres, tableau, liste) reste fourni par\n * l ecran : aucune librairie de rendu n est ajoutee (harmonisation de\n * l existant). La source suit la formulation du kit : Source : X.\n *\n * Aucune mention par defaut : periode et source n apparaissent que si elles\n * sont fournies (jamais d information fictive).\n */\nexport interface ChartCardProps {\n  titre: string;\n  periode?: string;\n  source?: string;\n  children: ReactNode;\n  className?: string;\n}\n\nexport function ChartCard({ titre, periode, source, children, className }: ChartCardProps) {\n  return (\n    <section className={cn(\'rounded-carte border border-bordure bg-surface p-5\', className)}>\n      <header className="mb-4 flex flex-wrap items-baseline justify-between gap-3">\n        <h3 className="text-2xl font-semibold text-texte">{titre}</h3>\n        {periode || source ? (\n          <p className="flex flex-wrap items-center gap-2 text-xs text-texte-doux">\n            {periode ? <span>{periode}</span> : null}\n            {source ? <span>Source : {source}</span> : null}\n          </p>\n        ) : null}\n      </header>\n      {children}\n    </section>\n  );\n}\n');
post('a98bb0a9a87735c536b4412fe0d46af0', 'apps/web/src/design-system/components/ChartCard.tsx', [
  'ChartCardProps', 'titre', 'periode', 'source', 'Source : {source}',
  'rounded-carte border border-bordure bg-surface', "from '../lib/utils'", 'text-2xl font-semibold text-texte',
]);

/* 2. coutures : barrel + admin (import, ouverture, fermeture) + production (import, Chip, ouverture, fermeture) */
remplacerTout('apps/web/src/design-system/index.ts', 'export { StatCard } from \'./components/StatCard\';', 'export { ChartCard } from \'./components/ChartCard\';\nexport type { ChartCardProps } from \'./components/ChartCard\';\nexport { StatCard } from \'./components/StatCard\';', 1);
remplacerTout('apps/web/src/pages/admin/Dashboard.tsx', 'import { StatCard } from \'@/design-system\';', 'import { ChartCard, StatCard } from \'@/design-system\';', 1);
remplacerTout('apps/web/src/pages/admin/Dashboard.tsx', '            <Text preset="h2" style={{ marginBottom: 12 }}>\n              Inscriptions \u2014 12 derniers mois\n            </Text>\n            <Card tone="white" style={{ marginBottom: 24 }}>', '            <ChartCard titre="Inscriptions \u2014 12 derniers mois" className="mb-6">', 1);
remplacerTout('apps/web/src/pages/admin/Dashboard.tsx', '            </Card>', '            </ChartCard>', 1);
remplacerTout('apps/web/src/pages/organization/ProductionSummary.tsx', 'import { COLORS, DURATION, EASE } from \'@/theme\';', 'import { COLORS, DURATION, EASE } from \'@/theme\';\nimport { ChartCard } from \'@/design-system\';', 1);
remplacerTout('apps/web/src/pages/organization/ProductionSummary.tsx', 'Card, Chip, ChipRow,', 'Card, ChipRow,', 1);
remplacerTout('apps/web/src/pages/organization/ProductionSummary.tsx', '              <Card tone="white">\n                <div style={{ display: \'flex\', justifyContent: \'space-between\', alignItems: \'baseline\', marginBottom: 16 }}>\n                  <Text preset="h3">R\u00e9partition {GROUP_LABELS[groupBy]}</Text>\n                  <Chip label={`source ${stats.data.source}`} tone="neutral" size="sm" />\n                </div>', '              <ChartCard titre={`R\u00e9partition ${GROUP_LABELS[groupBy]}`} source={stats.data.source}>', 1);
remplacerTout('apps/web/src/pages/organization/ProductionSummary.tsx', '                )}\n              </Card>', '              </ChartCard>', 1);

/* 3. portes POST : empreintes calculees atelier + fonctionnalites preservees */
post('e7e375f5a5f1b0fcefc6e9858865316a', 'apps/web/src/design-system/index.ts', [
  "export { ChartCard } from './components/ChartCard';", 'ChartCardProps', 'StatCard', 'Sidebar', 'useBreakpoint',
]);
post('75c1fb867d8e3e7c9a0f488ee5aa2230', 'apps/web/src/pages/admin/Dashboard.tsx', [
  '<ChartCard', 'Inscriptions', 'className="mb-6"', '</ChartCard>',
  '<StatCard', 'label={kpi.label}', 'to={kpi.vers ?? bloc.vers}', 'dashboardExport', 'maxSerie',
]);
post('c90ead2b3e1239b7429353cd51e5b1c4', 'apps/web/src/pages/organization/ProductionSummary.tsx', [
  '<ChartCard', 'GROUP_LABELS[groupBy]', 'source={stats.data.source}', '</ChartCard>',
  'recordsWithoutKg', 'formatNumber', 'groupBy', "from '@/design-system'",
]);
for (const f of ['apps/web/src/design-system/components/ChartCard.tsx', 'apps/web/src/pages/admin/Dashboard.tsx', 'apps/web/src/pages/organization/ProductionSummary.tsx']) {
  const c = lire(path.join(RACINE, f));
  if (/(?<![-\w])#[0-9a-fA-F]{6}(?![-\w])/.test(c)) throw new Error('I3 hex ' + f);
}
if (lire(path.join(RACINE, 'apps/web/src/pages/organization/ProductionSummary.tsx')).includes('Chip label')) throw new Error('RESIDU Chip source');

console.log('');
console.log('RECAP BLOC 95 (P5) :');
console.log('  ChartCard cree (kit 8) + adopte dans les 2 zones graphiques reels');
console.log('  graphiques INTACTS (barres, tableau alternatif, serie, etats vides)');
console.log('  source = stats.data.source (formulation kit : Source : X) ; zero fictif');
console.log('  aucune librairie de rendu ajoutee, aucun hex, aucun npm');
console.log('');
console.log('BLOC_95_OK (si verifications npm web + mobile sont vertes)');
