import fs from "node:fs";
import crypto from "node:crypto";
const NL = String.fromCharCode(10);
const md5 = (t) => crypto.createHash("md5").update(t, "utf8").digest("hex");

const IMPORT_ANC = "const AdminMonitoring = lazy(() => import('@/pages/admin/Monitoring'));";
const IMPORT_NEW = [
  "const AdminMonitoring = lazy(() => import('@/pages/admin/Monitoring'));",
  "const AdminJobs = lazy(() => import('@/pages/admin/Jobs'));",
  "const AdminSecurity = lazy(() => import('@/pages/admin/Security'));",
].join(NL);

const ROUTE_ANC = '            <Route path="/admin/monitoring" element={<AdminMonitoring />} />';
const ROUTE_NEW = [
  '            <Route path="/admin/monitoring" element={<AdminMonitoring />} />',
  '            <Route path="/admin/jobs" element={<AdminJobs />} />',
  '            <Route path="/admin/security" element={<AdminSecurity />} />',
].join(NL);

const MENU_ANC = "  { href: '/admin/monitoring', label: 'Tâches', icon: '⚙️' },";
const MENU_NEW = [
  "  { href: '/admin/monitoring', label: 'Supervision', icon: '📡' },",
  "  { href: '/admin/jobs', label: 'Tâches planifiées', icon: '⚙️' },",
  "  { href: '/admin/security', label: 'Sécurité', icon: '🔐' },",
].join(NL);

const travaux = [
  {
    chemin: "apps/web/src/App.tsx",
    avant: "f89eac0da20f6b5e7c6cd0463152e0c8",
    apres: "6db908ed5bc26578cc9c93e2ab3a2d8a",
    paires: [[IMPORT_ANC, IMPORT_NEW], [ROUTE_ANC, ROUTE_NEW]],
  },
  {
    chemin: "apps/web/src/pages/admin/Admin.tsx",
    avant: "21b8f498bb7e4189688fc1a9760614ce",
    apres: "ffc0e7947141382ab76bd70074bc898c",
    paires: [[MENU_ANC, MENU_NEW]],
  },
];
if (process.env.DUMP_PAIRES) { console.log(JSON.stringify(travaux)); process.exit(0); }
for (const t of travaux) {
  let s = fs.readFileSync(t.chemin, "utf8");
  const m0 = md5(s);
  if (m0 === t.apres) { console.log(t.chemin + " : deja a jour"); continue; }
  if (m0 !== t.avant) { console.error("ARRET_MD5 " + t.chemin + " : " + m0 + " inattendu"); process.exit(1); }
  let n = 0;
  for (const [a, b] of t.paires) {
    const na = s.split(a).length - 1;
    if (na === 1) { s = s.replace(a, b); n += 1; }
    else if (na === 0 && s.split(b).length - 1 === 1) { }
    else { console.error("ARRET_PAIRE " + t.chemin + " : " + a.slice(0, 50)); process.exit(1); }
  }
  fs.writeFileSync(t.chemin, s);
  const m1 = md5(s);
  console.log(t.chemin + " : " + n + " paires, md5 = " + m1 + (m1 === t.apres ? " OK" : " MAUVAIS"));
  if (m1 !== t.apres) process.exit(1);
}
console.log("FIX_UI_NAV_OK");
