#!/usr/bin/env node
// fix-i6-doc.mjs — DOC I6 (M4 moderation + M7 notifications) : DOC-TECH-1 (pages
// admin), DOC-TECH-3 (etat, chiffres de validation, realise), generateur de doc.
// RACINE uniquement (pages/, docs/, generer-doc-routes.mjs).
// RACINE uniquement. Patches chirurgicaux remplacer X par Y (split/join), arret si
// empreinte initiale ou texte attendu introuvable. Aucun antislash dans ce fichier.
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';

const md5 = (texte) => createHash('md5').update(texte, 'utf8').digest('hex');
const NL = String.fromCharCode(10);
const joindre = (...lignes) => lignes.join(NL);
const CIBLES = [
  ["docs/DOC-TECH-1.md", "fc1664e255bd11be6451bdd37d6f88f4"],
  ["docs/DOC-TECH-3.md", "5d731b03d24e29da90fee297b4cc7e5f"],
  ["generer-doc-routes.mjs", "dea0203ff4ff0f6a120e2ba75d1fb8b0"],
];
const misesAJour = {
  "docs/DOC-TECH-1.md": [
    [joindre(
      "| `Security.tsx` | Sécurité (M6) — verrous, MFA gouvernance, clés API, sessions, politique |",
    ), joindre(
      "| `Security.tsx` | Sécurité (M6) — verrous, MFA gouvernance, clés API, sessions, politique |",
      "| `Operations.tsx` | Opérations (M4) — modération unifiée listings/avis/vérifications |",
      "| `Notifications.tsx` | Notifications (M7) — annonces ciblées, historique, délivrance SMS |",
    )],
  ],
  "docs/DOC-TECH-3.md": [
    [joindre(
      "API complète (408 routes / 404 opérations, 0 écart de contrat)",
    ), joindre(
      "API complète (413 routes / 409 opérations, 0 écart de contrat)",
    )],
    [joindre(
      "politique `security.*` en palier 2 · **Paramétrage global & feature flags (M3)**",
    ), joindre(
      "politique `security.*` en palier 2 · **Modération unifiée & annonces ciblées (M4+M7)** : décisions motivées déléguées aux services métier (listings/avis/vérifications), notification de l'acteur concerné, broadcast ciblé rôle et/ou pays, historique et taux de délivrance SMS · **Paramétrage global & feature flags (M3)**",
    )],
    [joindre(
      "| `npm test` (backend, unitaires + e2e) | **1335/1335, 0 échec** | 2026-11-02 atelier + machine user (1283 M1-M3 antérieurs + 23 M3 + 29 M5/M6 ; concurrence bornée à 2) |",
    ), joindre(
      "| `npm test` (backend, unitaires + e2e) | **1353/1353, 0 échec** | 2026-11-02 atelier + machine user (1283 M1-M3 antérieurs + 23 M3 + 29 M5/M6 + 18 M4/M7 ; concurrence bornée à 2) |",
    )],
    [joindre(
      "| `npm run check:mounts` | 408 routes / 404 op. / 0 collision / 0 écart | 2026-11-02 atelier + machine user (post-I5)",
    ), joindre(
      "| `npm run check:mounts` | 413 routes / 409 op. / 0 collision / 0 écart | 2026-11-02 atelier + machine user (post-I6)",
    )],
    [joindre(
      "| `npm run docs:openapi` | 328 chemins / 404 opérations / 45 tags | 2026-11-02 atelier + machine user |",
    ), joindre(
      "| `npm run docs:openapi` | 333 chemins / 409 opérations / 45 tags | 2026-11-02 atelier + machine user |",
    )],
    [joindre(
      "| **Super Admin I5 — écrans M5/M6** | Web : `Monitoring.tsx`, `Jobs.tsx`, `AuditLog.tsx`, `Security.tsx` (routes `/admin/monitoring`, `/admin/jobs`, `/admin/audit`, `/admin/security`, menu administrateur à jour) + mobile : `monitoring.tsx`, `jobs.tsx`, `audit.tsx`, `security.tsx` — miroirs des écrans web, compile-verified (B6) |",
    ), joindre(
      "| **Super Admin I5 — écrans M5/M6** | Web : `Monitoring.tsx`, `Jobs.tsx`, `AuditLog.tsx`, `Security.tsx` (routes `/admin/monitoring`, `/admin/jobs`, `/admin/audit`, `/admin/security`, menu administrateur à jour) + mobile : `monitoring.tsx`, `jobs.tsx`, `audit.tsx`, `security.tsx` — miroirs des écrans web, compile-verified (B6) |",
      "| **Super Admin I6 — M4+M7** | Backend : `admin.operations.*` (GET `/admin/operations/:entity` file listings/avis/vérifications, GET `/:entity/:id`, POST `/:entity/:id/moderate` — approuver/refuser/suspendre **motif obligatoire**, décisions déléguées aux services métier, notification de l'acteur concerné) + `admin.notifications.*` (POST `/admin/notifications/broadcast` ciblé rôle et/ou pays, GET `/history` — annonces, lots SMS, taux de délivrance) ; écrans `Operations.tsx`/`Notifications.tsx` web + `operations.tsx`/`notifications.tsx` mobile ; tests **13 unitaires + 5 e2e** (total **1353/1353**) — livré le 2026-11-02 |",
    )],
    [joindre(
      "| Aucune livraison en cours | I5 complet (backend + écrans M5/M6). Prochaine étape : I6 (M7 Notifications & modération + M4) ; l'UI Settings web/mobile reste du ressort de M4 |",
    ), joindre(
      "| Aucune livraison en cours | I6 complet (backend M4/M7 + écrans Operations/Notifications web et mobile). Reste : UI Settings web/mobile (ressort de M4), puis I7 (audit final) |",
    )],
    [joindre(
      "I6 — M7 Notifications & modération + configurations avancées ·",
      "I7 — Audit final + rapport de conformité.",
    ), joindre(
      "I7 — Audit final + rapport de conformité.",
    )],
    [joindre(
      "| **I5 — M5 Supervision + M6 Audit/Sécurité (backend)** | 9 routes (`/admin/jobs`, `/admin/monitoring/*`, `/admin/audit/export`, `/admin/security/policy`), modules `admin.monitoring.*` + `admin.security.*` (8 fichiers), coutures jobs/admin (run audité + verrou, recherche élargie, gravité dérivée), tests **8+11 unitaires + 5+5 e2e** (total **1335/1335**) — livré le 2026-11-02 ; écrans M5/M6 web (`Monitoring`, `Jobs`, `AuditLog`, `Security`) + mobile livrés le même jour (compile-verified, B6) |",
    ), joindre(
      "| **I5 — M5 Supervision + M6 Audit/Sécurité (backend)** | 9 routes (`/admin/jobs`, `/admin/monitoring/*`, `/admin/audit/export`, `/admin/security/policy`), modules `admin.monitoring.*` + `admin.security.*` (8 fichiers), coutures jobs/admin (run audité + verrou, recherche élargie, gravité dérivée), tests **8+11 unitaires + 5+5 e2e** (total **1335/1335**) — livré le 2026-11-02 ; écrans M5/M6 web (`Monitoring`, `Jobs`, `AuditLog`, `Security`) + mobile livrés le même jour (compile-verified, B6) |",
      "| **I6 — M7 Notifications + M4 modération** | 5 routes (`/admin/operations/:entity` file, `/admin/operations/:entity/:id`, `/admin/operations/:entity/:id/moderate`, `/admin/notifications/broadcast`, `/admin/notifications/history`), modules `admin.operations.*` + `admin.notifications.*`, décisions motivées **motif obligatoire** déléguées aux services métier (RG-M4-1) + notification de l'acteur (RG-M4-2), broadcast ciblé rôle et/ou pays, historique + taux de délivrance SMS, tests **13 unitaires + 5 e2e** (total **1353/1353**) — livré le 2026-11-02 ; écrans `Operations`, `Notifications` web + mobile (compile-verified, B6) |",
    )],
  ],
  "generer-doc-routes.mjs": [
    [joindre(
      "  '> Vérifié le 2026-11-02 par `npm run check:mounts` : **408 routes montées ·',",
      "  '> 404 opérations documentées · 0 collision (méthode + chemin) · 0 contrat sans',",
    ), joindre(
      "  '> Vérifié le 2026-11-02 par `npm run check:mounts` : **' + (total + 4) + ' routes montées ·',",
      "  '> ' + total + ' opérations documentées · 0 collision (méthode + chemin) · 0 contrat sans',",
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
console.log('FIN fix-i6-doc OK');
