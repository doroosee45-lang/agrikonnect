#!/usr/bin/env node
// fix-ui6-nav.mjs — I6 UI : coutures de navigation web (App.tsx routes lazy + menu
// administrateur Admin.tsx) pour /admin/operations et /admin/notifications.
// RACINE uniquement. Patches chirurgicaux remplacer X par Y (split/join), arret si
// empreinte initiale ou texte attendu introuvable. Aucun antislash dans ce fichier.
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';

const md5 = (texte) => createHash('md5').update(texte, 'utf8').digest('hex');
const NL = String.fromCharCode(10);
const joindre = (...lignes) => lignes.join(NL);
const CIBLES = [
  ["apps/web/src/App.tsx", "6db908ed5bc26578cc9c93e2ab3a2d8a"],
  ["apps/web/src/pages/admin/Admin.tsx", "ffc0e7947141382ab76bd70074bc898c"],
];
const misesAJour = {
  "apps/web/src/App.tsx": [
    [joindre(
      "const AdminSecurity = lazy(() => import('@/pages/admin/Security'));",
      "const AdminSync = lazy(() => import('@/pages/admin/Sync'));",
    ), joindre(
      "const AdminSecurity = lazy(() => import('@/pages/admin/Security'));",
      "const AdminOperations = lazy(() => import('@/pages/admin/Operations'));",
      "const AdminNotifications = lazy(() => import('@/pages/admin/Notifications'));",
      "const AdminSync = lazy(() => import('@/pages/admin/Sync'));",
    )],
    [joindre(
      '            <Route path="/admin/security" element={<AdminSecurity />} />',
      '            <Route path="/admin/sync" element={<AdminSync />} />',
    ), joindre(
      '            <Route path="/admin/security" element={<AdminSecurity />} />',
      '            <Route path="/admin/operations" element={<AdminOperations />} />',
      '            <Route path="/admin/notifications" element={<AdminNotifications />} />',
      '            <Route path="/admin/sync" element={<AdminSync />} />',
    )],
  ],
  "apps/web/src/pages/admin/Admin.tsx": [
    [joindre(
      "  { href: '/admin/security', label: 'Sécurité', icon: '🔐' },",
      "  { href: '/admin/sync', label: 'Synchronisation', icon: '🔄' },",
    ), joindre(
      "  { href: '/admin/security', label: 'Sécurité', icon: '🔐' },",
      "  { href: '/admin/operations', label: 'Opérations', icon: '🗂️' },",
      "  { href: '/admin/notifications', label: 'Notifications', icon: '📣' },",
      "  { href: '/admin/sync', label: 'Synchronisation', icon: '🔄' },",
    )],
  ],
};
const appliquer = (chemin, attenduMD5, liste) => {
  let texte = readFileSync(chemin, 'utf8');
  const initial = md5(texte);
  if (initial !== attenduMD5) {
    console.log('ARRET_MD5 ' + chemin + ' : ' + initial + ' au lieu de ' + attenduMD5);
    process.exit(1);
  }
  for (const [avant, apres] of liste) {
    if (!texte.includes(avant)) {
      console.log('ARRET_ABSENCE ' + chemin + ' : ' + avant.slice(0, 60) + ' introuvable');
      process.exit(1);
    }
    texte = texte.split(avant).join(apres);
  }
  writeFileSync(chemin, texte);
  console.log(chemin + ' mis a jour — md5 : ' + md5(texte));
};
for (const [chemin, attenduMD5] of CIBLES) appliquer(chemin, attenduMD5, misesAJour[chemin]);
console.log('FIN fix-ui6-nav OK');
