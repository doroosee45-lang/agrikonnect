#!/usr/bin/env node
/**
 * maj-cle — installe la cle service_role reçue par variable d'environnement
 * locale dans backend/.env. Validée par sa forme, jamais affichée.
 */
import fs from 'node:fs';

const chemin = 'backend/.env';
const brut = fs.readFileSync(chemin, 'utf8');
if (!/^SUPABASE_SERVICE_ROLE_KEY=/m.test(brut)) {
  console.log('ARRET : aucune ligne SUPABASE_SERVICE_ROLE_KEY= dans backend/.env');
  process.exit(1);
}
let cle = (process.env.CLE_A_INSTALLER ?? '').trim();
if (cle.length === 0) {
  console.log('ARRET : aucune cle recue');
  process.exit(1);
}
if ((cle.startsWith('"') && cle.endsWith('"')) || (cle.startsWith("'") && cle.endsWith("'"))) cle = cle.slice(1, -1);
const roleJwt = (() => {
  if (!cle.startsWith('eyJ')) return null;
  const p = cle.split('.')[1];
  if (!p) return null;
  try { return JSON.parse(Buffer.from(p, 'base64url').toString('utf8')).role ?? null; } catch { return null; }
})();
const ok = (cle.startsWith('eyJ') && roleJwt === 'service_role' && cle.length >= 150)
  || (cle.startsWith('sb_secret_') && cle.length >= 40);
if (!ok) {
  console.log('ARRET_FORME : valeur refusee — attendu JWT avec role service_role (150+ caracteres) ou sb_secret_ (40+ caracteres). backend/.env INCHANGE.');
  process.exit(1);
}
const maj = brut.replace(/^SUPABASE_SERVICE_ROLE_KEY=.*$/gm, () => 'SUPABASE_SERVICE_ROLE_KEY=' + cle);
fs.writeFileSync(chemin, maj);
console.log('CLE_MAJ_OK : ligne remplacee —', cle.startsWith('eyJ') ? 'JWT service_role' : 'sb_secret_', '| longueur', cle.length);
