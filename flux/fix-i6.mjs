import fs from "node:fs";
import crypto from "node:crypto";
const NL = String.fromCharCode(10);
const md5 = (t) => crypto.createHash("md5").update(t, "utf8").digest("hex");

const IMPORT_ANC = "import { auditExportRouter, securityRouter } from './admin.security.routes.js';";
const IMPORT_NEW = [
  "import { auditExportRouter, securityRouter } from './admin.security.routes.js';",
  "import { operationsRouter } from './admin.operations.routes.js';",
  "import { adminNotificationsRouter } from './admin.notifications.routes.js';",
].join(NL);

const MONT_ANC = "router.get('/export/farms', authorize('admin.users'), asyncHandler(controller.exportFarms));";
const MONT_NEW = [
  "/**",
  " * M4 (U-M4-2/RG-M4-1) — modération unifiée des flux métier (listings, avis,",
  " * vérifications) : listes lues en direct, décisions déléguées aux services",
  " * métier existants avec notification de l'acteur concerné (RG-M4-2).",
  " */",
  "router.use('/operations', operationsRouter);",
  "",
  "/** M7 (U-M7-1) — annonces internes ciblées (rôle/pays) et historique d'envois. */",
  "router.use('/notifications', adminNotificationsRouter);",
  "",
  "router.get('/export/farms', authorize('admin.users'), asyncHandler(controller.exportFarms));",
].join(NL);

const TEST_ANC = "tests/adminMonitoring.test.mjs tests/adminSecurity.test.mjs";
const TEST_NEW = "tests/adminMonitoring.test.mjs tests/adminNotifications.test.mjs tests/adminOperations.test.mjs tests/adminSecurity.test.mjs";

const E2E_ANC = "tests/e2e/adminMonitoring.e2e.test.mjs tests/e2e/adminSecurity.e2e.test.mjs";
const E2E_NEW = "tests/e2e/adminMonitoring.e2e.test.mjs tests/e2e/adminNotifications.e2e.test.mjs tests/e2e/adminOperations.e2e.test.mjs tests/e2e/adminSecurity.e2e.test.mjs";

const travaux = [
  {
    chemin: "backend/src/modules/admin/admin.routes.js",
    avant: "b2a83ef0e789afe1426f778c1bf93f70",
    apres: "570f8b0a84ffc1df2379784b62e7e843",
    paires: [[IMPORT_ANC, IMPORT_NEW], [MONT_ANC, MONT_NEW]],
  },
  {
    chemin: "backend/package.json",
    avant: "4374f257775b8bcd8a4accdc7bf7b5ed",
    apres: "916def14d45d19fc54d8d00f0284b7e4",
    paires: [[TEST_ANC, TEST_NEW, 3], [E2E_ANC, E2E_NEW, 4]],
  },
];
if (process.env.DUMP_PAIRES) { console.log(JSON.stringify(travaux)); process.exit(0); }
for (const t of travaux) {
  let s = fs.readFileSync(t.chemin, "utf8");
  const m0 = md5(s);
  if (m0 === t.apres) { console.log(t.chemin + " : deja a jour"); continue; }
  if (m0 !== t.avant) { console.error("ARRET_MD5 " + t.chemin + " : " + m0 + " inattendu"); process.exit(1); }
  let n = 0;
  for (const [a, b, attendu] of t.paires) {
    const prevu = attendu ?? 1;
    const na = s.split(a).length - 1;
    if (na === prevu) { s = s.split(a).join(b); n += prevu; }
    else if (na === 0 && s.split(b).length - 1 === prevu) { }
    else { console.error("ARRET_PAIRE " + t.chemin + " : " + a.slice(0, 50)); process.exit(1); }
  }
  fs.writeFileSync(t.chemin, s);
  const m1 = md5(s);
  console.log(t.chemin + " : " + n + " paires, md5 = " + m1 + (m1 === t.apres ? " OK" : " MAUVAIS"));
  if (m1 !== t.apres) process.exit(1);
}
console.log("FIX_I6_OK");
