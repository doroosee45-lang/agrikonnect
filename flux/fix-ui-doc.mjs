import fs from "node:fs";
import crypto from "node:crypto";
const NL = String.fromCharCode(10);
const md5 = (t) => crypto.createHash("md5").update(t, "utf8").digest("hex");

const PAGES_ANC = "| `AuditLog.tsx` | Journal d'audit (M6) |";
const PAGES_NEW = [
  "| `AuditLog.tsx` | Journal d'audit (M6) — recherche avancée, détail avant/après, export |",
  "| `Monitoring.tsx` | Supervision (M5) — services externes, santé technique, alertes |",
  "| `Jobs.tsx` | Tâches planifiées (M5) — exécution manuelle, pause/reprise |",
  "| `Security.tsx` | Sécurité (M6) — verrous, MFA gouvernance, clés API, sessions, politique |",
].join(NL);

const EN_COURS_ANC = "| **I5 — écrans M5/M6** | Backend M5/M6 livré et validé (1335/1335) ; restant : écrans `Monitoring.tsx`, `jobs.tsx`, `AuditLog.tsx`, `Security.tsx` web + miroirs mobile ; l'UI Settings web/mobile reste du ressort de M4 |";
const EN_COURS_NEW = "| Aucune livraison en cours | I5 complet (backend + écrans M5/M6). Prochaine étape : I6 (M7 Notifications & modération + M4) ; l'UI Settings web/mobile reste du ressort de M4 |";

const REAL_ANC = "livré via coutures (`fix-i5.mjs`, `fix-i5-tests.mjs`), validé sur machine le 2026-11-02 |";
const REAL_NEW = [
  "livré via coutures (`fix-i5.mjs`, `fix-i5-tests.mjs`), validé sur machine le 2026-11-02",
  "| **Super Admin I5 — écrans M5/M6** | Web : `Monitoring.tsx`, `Jobs.tsx`, `AuditLog.tsx`, `Security.tsx` (routes `/admin/monitoring`, `/admin/jobs`, `/admin/audit`, `/admin/security`, menu administrateur à jour) + mobile : `monitoring.tsx`, `jobs.tsx`, `audit.tsx`, `security.tsx` — miroirs des écrans web, compile-verified (B6) |",
].join(NL);

const HIST_ANC = "— livré le 2026-11-02, écrans à venir |";
const HIST_NEW = "— livré le 2026-11-02 ; écrans M5/M6 web (`Monitoring`, `Jobs`, `AuditLog`, `Security`) + mobile livrés le même jour (compile-verified, B6) |";

const travaux = [
  {
    chemin: "docs/DOC-TECH-1.md",
    avant: "974489db3073eac416060b3ca55d0656",
    apres: "fc1664e255bd11be6451bdd37d6f88f4",
    paires: [[PAGES_ANC, PAGES_NEW]],
  },
  {
    chemin: "docs/DOC-TECH-3.md",
    avant: "21888e2bb2c45966dc1e5cbfca1c8fb3",
    apres: "5d731b03d24e29da90fee297b4cc7e5f",
    paires: [[EN_COURS_ANC, EN_COURS_NEW], [REAL_ANC, REAL_NEW], [HIST_ANC, HIST_NEW]],
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
console.log("FIX_UI_DOC_OK");
