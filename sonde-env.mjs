import fs from 'node:fs';
const brut = fs.readFileSync('backend/.env', 'utf8');
const cles = ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY'];
const valeurs = {};
for (const ligne of brut.split('\n')) {
  const i = ligne.indexOf('=');
  if (i < 0) continue;
  const nom = ligne.slice(0, i).trim();
  if (cles.includes(nom)) valeurs[nom] = ligne.slice(i + 1);
}
const nu = (v) => {
  let s = v.trim();
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) s = s.slice(1, -1);
  return s;
};
const roleDe = (v) => {
  if (!v.startsWith('eyJ')) return null;
  const p = v.split('.')[1];
  if (!p) return null;
  try { return JSON.parse(Buffer.from(p, 'base64url').toString('utf8')).role ?? null; } catch { return null; }
};
for (const nom of cles) {
  const v = valeurs[nom];
  if (v === undefined) { console.log(nom, ': ABSENTE DU FICHIER'); continue; }
  const s = nu(v);
  const forme = s.startsWith('eyJ') ? 'JWT (ancien format)'
    : s.startsWith('sb_secret_') ? 'sb_secret_ (bon format pour service_role)'
    : s.startsWith('sb_publishable_') ? 'sb_publishable_ (format anon)'
    : s.startsWith('http') ? 'URL' : 'autre (inattendu)';
  const role = roleDe(s);
  const problemes = [];
  if (/\s/.test(s)) problemes.push('espace ou retour a la ligne dans la valeur');
  console.log(nom, '| longueur reelle', s.length, '|', forme, role ? '| role declare : ' + role : '', '| problemes :', problemes.length ? problemes.join(', ') : 'aucun');
}
const a = nu(valeurs['SUPABASE_ANON_KEY'] ?? '');
const b = nu(valeurs['SUPABASE_SERVICE_ROLE_KEY'] ?? '');
if (a && b && a === b) console.log('ALERTE : anon et service_role sont IDENTIQUES');
