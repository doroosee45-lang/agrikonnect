import fs from "node:fs";
import crypto from "node:crypto";
const NL = String.fromCharCode(10);
const md5 = (t) => crypto.createHash("md5").update(t, "utf8").digest("hex");

const IMPORT_ANC = "import { api, cleanQuery } from './http';";
const IMPORT_NEW = "import { api, cleanQuery, http } from './http';";

const QUEUE_ANC = [
  "  audit: (params: { limit?: number; action?: string } = {}) =>",
  "    api.get<Array<Record<string, unknown>>>('/admin/audit', { params: cleanQuery(params) }),",
  "  jobs: () => api.get<Array<Record<string, unknown>>>('/admin/jobs'),",
  "  runJob: (name: string) => api.post<Record<string, unknown>>(`/admin/jobs/${name}/run`, {}, { idempotent: true }),",
].join(NL);

const QUEUE_NEW = [
  "  /** M6 U-M6-1 — recherche avancée du journal (acteur, action, ressource, date, gravité). */",
  "  audit: (",
  "    params: {",
  "      limit?: number;",
  "      action?: string;",
  "      actor?: string;",
  "      actorId?: string;",
  "      resource?: string;",
  "      from?: string;",
  "      to?: string;",
  "      severity?: string;",
  "    } = {},",
  "  ) => api.get<Array<Record<string, unknown>>>('/admin/audit', { params: cleanQuery(params) }),",
  "  /** M6 U-M6-1 — export CSV/JSON du journal (audité côté serveur, RG-S2). */",
  "  auditExport: async (",
  "    params: { format?: 'csv' | 'json'; limit?: number; action?: string; actor?: string; actorId?: string; resource?: string; from?: string; to?: string; severity?: string } = {},",
  "  ) => {",
  "    const response = await http.get<unknown>('/admin/audit/export', {",
  "      params: cleanQuery(params),",
  "      responseType: 'text',",
  "      transformResponse: [(data: unknown) => data],",
  "    });",
  "    const disposition = String(response.headers['content-disposition'] ?? '');",
  "    const brut = disposition.split('filename=')[1] ?? '';",
  "    const filename = brut.split(String.fromCharCode(34)).join('').trim() || `audit.${params.format ?? 'csv'}`;",
  "    return { content: String(response.data ?? ''), filename };",
  "  },",
  "  /** M5 U-M5-2 — console des jobs : état, cadence, derniers passages. */",
  "  jobs: () => api.get<Array<Record<string, unknown>>>('/admin/jobs'),",
  "  /** M5 U-M5-2 / RG-M5-2 — exécution manuelle (audité `admin.job.run`, verrou anti double-exécution). */",
  "  runJob: (name: string, payload: { reason?: string } = {}) =>",
  "    api.post<Record<string, unknown>>(`/admin/jobs/${name}/run`, payload, { idempotent: true }),",
  "  /** M5 U-M5-2 — pause/reprise : palier 2 (SUPER_ADMIN + MFA). */",
  "  pauseJob: (name: string) => api.post<Record<string, unknown>>(`/admin/jobs/${name}/pause`, {}, { idempotent: true }),",
  "  resumeJob: (name: string) => api.post<Record<string, unknown>>(`/admin/jobs/${name}/resume`, {}, { idempotent: true }),",
  "  /** M5 U-M5-1 — services externes, réévalués à chaque appel (RG-M5-1). */",
  "  monitoringServices: () => api.get<Record<string, unknown>>('/admin/monitoring/services'),",
  "  /** M5 U-M5-3/U-M5-4 — santé technique et alertes de supervision. */",
  "  monitoringHealth: () => api.get<Record<string, unknown>>('/admin/monitoring/health'),",
  "  /** M6 U-M6-2 — vue sécurité consolidée (connexions, verrous, MFA, clés, sessions). */",
  "  securityOverview: () => api.get<Record<string, unknown>>('/admin/security/overview'),",
  "  /** M6 U-M6-3 — politique de sécurité : palier 2 (SUPER_ADMIN + MFA). */",
  "  securityPolicy: () => api.get<Record<string, unknown>>('/admin/security/policy'),",
  "  updateSecurityPolicy: (payload: { values: Record<string, unknown>; reason?: string }) =>",
  "    api.put<Record<string, unknown>>('/admin/security/policy', payload),",
].join(NL);

const JOBS_ANC = "    jobs: ['admin', 'jobs'] as const,";
const JOBS_NEW = [
  "    jobs: ['admin', 'jobs'] as const,",
  "    monitoringServices: ['admin', 'monitoring', 'services'] as const,",
  "    monitoringHealth: ['admin', 'monitoring', 'health'] as const,",
  "    securityOverview: ['admin', 'security', 'overview'] as const,",
  "    securityPolicy: ['admin', 'security', 'policy'] as const,",
].join(NL);

const travaux = [
  {
    chemin: "apps/web/src/services/endpoints.ts",
    avant: "6a90796ee0a15efd40d38384bf590219",
    apres: "a1947c18476db4a5ec185fa582ae1152",
    paires: [[IMPORT_ANC, IMPORT_NEW], [QUEUE_ANC, QUEUE_NEW]],
  },
  {
    chemin: "apps/web/src/services/query.ts",
    avant: "c488ef6e1e1b55346e66cf462cc9ab00",
    apres: "1cf7a17afcdb3c7740f3263ca0baf144",
    paires: [[JOBS_ANC, JOBS_NEW]],
  },
  {
    chemin: "apps/Mobile/src/services/api/endpoints.ts",
    avant: "ba3cb478b41ae36808bbbefeed8b6f8a",
    apres: "abaa215635021e770d04a37c3158fe40",
    paires: [[IMPORT_ANC, IMPORT_NEW], [QUEUE_ANC, QUEUE_NEW]],
  },
  {
    chemin: "apps/Mobile/src/services/query.ts",
    avant: "9b953b17cb9e38ff22de344ce404004a",
    apres: "cee2a4c30ca35f218acc890ae67066f6",
    paires: [[JOBS_ANC, JOBS_NEW]],
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
console.log("FIX_UI_API_OK");
