import fs from "node:fs";
import crypto from "node:crypto";
const NL = String.fromCharCode(10);
const md5 = (t) => crypto.createHash("md5").update(t, "utf8").digest("hex");
const travaux = [
  {
    chemin: "generer-doc-routes.mjs",
    avant: "c2e0aba8e45594729509332f7a82e769",
    apres: "dea0203ff4ff0f6a120e2ba75d1fb8b0",
    paires: [
      ["  '> Vérifié le 2026-11-02 par `npm run check:mounts` : **396 routes montées ·',", "  '> Vérifié le 2026-11-02 par `npm run check:mounts` : **408 routes montées ·',"],
      ["  '> 392 opérations documentées · 0 collision (méthode + chemin) · 0 contrat sans',", "  '> 404 opérations documentées · 0 collision (méthode + chemin) · 0 contrat sans',"],
    ],
  },
  {
    chemin: "docs/DOC-TECH-1.md",
    avant: "54c6e6010b764991c2fffbd0fec7d1d3",
    apres: "974489db3073eac416060b3ca55d0656",
    paires: [
      ["> **Version du document** : 1.0 — **2026-11-02**.", "> **Version du document** : 1.1 — **2026-11-02** (mise à jour I5 — M5 Supervision + M6 Audit/Sécurité)."],
    ],
  },
  {
    chemin: "docs/DOC-TECH-3.md",
    avant: "74e9c9b73d022017310040126efb9e9b",
    apres: "21888e2bb2c45966dc1e5cbfca1c8fb3",
    paires: [
      ["| admin | **Super Admin** : dashboard, comptes, rôles, **paramètres globaux & feature flags (M3)**, jobs, audit | ai |",
       "| admin | **Super Admin** : dashboard, comptes, rôles, **paramètres globaux & feature flags (M3)**, **supervision (M5)**, **audit avancé & sécurité (M6)**, jobs, audit | ai |"],
      ["API complète (400 routes, 0 écart de contrat) · **Paramétrage global & feature flags (M3)**",
       "API complète (408 routes / 404 opérations, 0 écart de contrat) · **Supervision (M5)** : services dégradés évalués en direct (cause + marche à suivre), santé technique, jobs listés, run manuel audité (`admin.job.run`) avec verrou anti double-exécution · **Audit avancé & sécurité (M6)** : recherche (acteur, dates, gravité), export CSV/JSON audité (`admin.audit.export`), vue sécurité (verrous, MFA gouvernance, clés, sessions), politique `security.*` en palier 2 · **Paramétrage global & feature flags (M3)**"],
      ["| `npm test` (backend, unitaires + e2e) | **1306/1306, 0 échec** | 2026-11-02 atelier (1283 M1-M3 antérieurs + 23 M3) + machine user (validé le 2026-11-02) |",
       "| `npm test` (backend, unitaires + e2e) | **1335/1335, 0 échec** | 2026-11-02 atelier + machine user (1283 M1-M3 antérieurs + 23 M3 + 29 M5/M6 ; concurrence bornée à 2) |"],
      ["| dont e2e M3 (`adminSettings.e2e.test.mjs`) | 8/8 (AC-M3 `module_disabled`, maintenance, palier 2, secrets, flags) | 2026-11-02 atelier |",
       "| dont e2e M3 (`adminSettings.e2e.test.mjs`) | 8/8 (AC-M3 `module_disabled`, maintenance, palier 2, secrets, flags) | 2026-11-02 atelier |" + NL +
       "| dont unitaires M5 (`adminMonitoring.test.mjs`) | 8/8 (AC-M5, RG-M5-1 direct, RG-M5-2 verrou/audit) | 2026-11-02 atelier + machine user |" + NL +
       "| dont unitaires M6 (`adminSecurity.test.mjs`) | 11/11 (AC-M6, RG-S1 MFA, RG-S2 insertion seule, RG-S3 aucun secret) | idem |" + NL +
       "| dont e2e M5 (`adminMonitoring.e2e.test.mjs`) | 5/5 (écran = rapport de démarrage, run manuel réel de `notifications.purge`, palier 2, audit) | idem |" + NL +
       "| dont e2e M6 (`adminSecurity.e2e.test.mjs`) | 5/5 (verrouillage → vue sécurité → déverrouillage → audit, RG-S1, export, politique) | idem |"],
      ["| `npm run check:mounts` | 400 routes / 396 op. / 0 collision / 0 écart | 2026-11-02 atelier + machine user (post-M3, générateur OpenAPI étendu aux sous-routeurs) |",
       "| `npm run check:mounts` | 408 routes / 404 op. / 0 collision / 0 écart | 2026-11-02 atelier + machine user (post-I5)" + NL +
       "| `npm run docs:openapi` | 328 chemins / 404 opérations / 45 tags | 2026-11-02 atelier + machine user |"],
      ["### 9.2 Organisation des tests (`backend/tests/`, 86 fichiers)",
       "### 9.2 Organisation des tests (`backend/tests/`, 90 fichiers)"],
      ["palier 2, flags, contre-épreuves).",
       "palier 2, flags, contre-épreuves) + 5 tests M5 (écran = rapport de démarrage avec `degradedServices`, run manuel réel, RG-M5-1 état en direct, RG-M5-2) + 5 tests M6 (AC-M6 cycle complet de verrouillage, RG-S1 `mfa_required`, recherche/export, politique `security.*`)."],
      ["(enchaînement complet), `npm run check:*`.",
       "(enchaînement complet), `npm run check:*`. **Concurrence bornée à 2** (`--test-concurrency=2` placé avant la liste des fichiers, couture `fix-test-conc.mjs`) : en parallèle totale sous Windows, les démarrages (base PostgreSQL embarquée, moteur Python) se marchent dessus et font échouer des tests qui passent isolément — limite conservée dans `npm test`."],
      [", contrat OpenAPI complet — livré via `fix-m3.mjs`, validé sur machine le 2026-11-02 (1306/1306, check:mounts 400/396/0/0/0) |",
       ", contrat OpenAPI complet — livré via `fix-m3.mjs`, validé sur machine le 2026-11-02 (1306/1306, check:mounts 400/396/0/0/0)" + NL +
       "| **Super Admin I5/M5+M6** | Supervision + Audit/Sécurité : 9 routes API (`GET /admin/jobs`, `POST /admin/jobs/:name/{run,pause,resume}`, `GET /admin/monitoring/{services,health}`, `GET /admin/audit/export`, `GET/PUT /admin/security/policy`), jobs enrichis (pause/reprise palier 2, verrou anti double-exécution, audit `admin.job.run`), gravité dérivée (`SEVERITY_RULES`), vue sécurité, politique palier 2, tests **8+11 unitaires, 5+5 e2e** (total **1335/1335**) — livré via coutures (`fix-i5.mjs`, `fix-i5-tests.mjs`), validé sur machine le 2026-11-02 |"],
      ["| **I5 — M5 Supervision + M6 Audit/Sécurité** | Démarré le 2026-11-02 après clôture de I4/M3 (validé sur machine) ; l'UI Settings web/mobile reste du ressort de M4 |",
       "| **I5 — écrans M5/M6** | Backend M5/M6 livré et validé (1335/1335) ; restant : écrans `Monitoring.tsx`, `jobs.tsx`, `AuditLog.tsx`, `Security.tsx` web + miroirs mobile ; l'UI Settings web/mobile reste du ressort de M4 |"],
      ["I5 — M5 Supervision (services, jobs, santé) + M6 Audit/Sécurité ·" + NL + "I6 — M7 Notifications & modération + configurations avancées ·", "I6 — M7 Notifications & modération + configurations avancées ·"],
      ["tests **15+8** (total **1306/1306**) — livré et validé sur machine le 2026-11-02 |",
       "tests **15+8** (total **1306/1306**) — livré et validé sur machine le 2026-11-02" + NL +
       "| **I5 — M5 Supervision + M6 Audit/Sécurité (backend)** | 9 routes (`/admin/jobs`, `/admin/monitoring/*`, `/admin/audit/export`, `/admin/security/policy`), modules `admin.monitoring.*` + `admin.security.*` (8 fichiers), coutures jobs/admin (run audité + verrou, recherche élargie, gravité dérivée), tests **8+11 unitaires + 5+5 e2e** (total **1335/1335**) — livré le 2026-11-02, écrans à venir |"],
      ["| *À venir* | I5 (M5 Supervision + M6 Audit/Sécurité) · I6 (M7 Notifications + M4 modération) · I7 (audit final + conformité) |",
       "| *À venir* | Écrans M5/M6 (web + mobile) · I6 (M7 Notifications + M4 modération) · I7 (audit final + conformité) |"],
      ["documentation technique v1.0 (2026-11-02).*", "documentation technique v1.1 (2026-11-02).*"],
    ],
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
console.log("FIX_DOC_I5_OK");
