#!/usr/bin/env node
// fix-ui6-api.mjs — I6 UI (M4 moderation + M7 notifications) : coutures API
// web et mobile (endpoints + cles de requete), blocs definis une seule fois.
// RACINE uniquement. Insertions split/join, arret si empreinte ou ancre absente.
// Aucun antislash dans ce fichier.
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';

const md5 = (texte) => createHash('md5').update(texte, 'utf8').digest('hex');
const NL = String.fromCharCode(10);
const joindre = (...lignes) => lignes.join(NL);
const CIBLES = [
  ["apps/web/src/services/endpoints.ts", "a1947c18476db4a5ec185fa582ae1152"],
  ["apps/web/src/services/query.ts", "1cf7a17afcdb3c7740f3263ca0baf144"],
  ["apps/Mobile/src/services/api/endpoints.ts", "abaa215635021e770d04a37c3158fe40"],
  ["apps/Mobile/src/services/query.ts", "cee2a4c30ca35f218acc890ae67066f6"],
];
const API_AVANT = [
  "    api.put<Record<string, unknown>>('/admin/security/policy', payload),",
  "  settings: () => api.get<Record<string, unknown>>('/admin/settings'),",
];
const API_AJOUT = [
  "  /** M4 U-M4-2 — file de modération unifiée (listings, avis, vérifications). */",
  "  operationsList: (entity: string, params: { limit?: number; page?: number; status?: string } = {}) =>",
  "    api.get<Array<Record<string, unknown>>>(`/admin/operations/${entity}`, { params: cleanQuery(params) }),",
  "  /** M4 U-M4-2 — fiche détail d'un élément à modérer. */",
  "  operationsDetail: (entity: string, id: string) =>",
  "    api.get<Record<string, unknown>>(`/admin/operations/${entity}/${id}`),",
  "  /** M4 U-M4-2 / RG-M4-1 — décision motivée, déléguée aux services métier. */",
  "  moderateOperation: (entity: string, id: string, payload: { decision: 'approve' | 'reject' | 'suspend'; reason: string }) =>",
  "    api.post<Record<string, unknown>>(`/admin/operations/${entity}/${id}/moderate`, payload),",
  "  /** M7 U-M7-1 — annonce interne ciblée (rôle et/ou pays). */",
  "  broadcastAnnouncement: (payload: { title: string; body: string; role?: string; country?: string; channels?: string[] }) =>",
  "    api.post<Record<string, unknown>>('/admin/notifications/broadcast', payload),",
  "  /** M7 U-M7-1 — historique d'envois et taux de délivrance SMS. */",
  "  notificationsHistory: (params: { limit?: number } = {}) =>",
  "    api.get<Record<string, unknown>>('/admin/notifications/history', { params: cleanQuery(params) }),",
];
const Q_AVANT = "    settings: ['admin', 'settings'] as const,";
const Q_AJOUT = [
  "    /** M4 — file de modération unifiée (listings, avis, vérifications). */",
  "    operations: (entity: string, params?: unknown) => ['admin', 'operations', entity, params] as const,",
  "    /** M7 — historique des annonces internes. */",
  "    notificationsHistory: ['admin', 'notifications', 'history'] as const,",
];
const avantApi = joindre(...API_AVANT);
const apresApi = joindre(API_AVANT[0], ...API_AJOUT, API_AVANT[1]);
const avantCles = Q_AVANT;
const apresCles = joindre(...Q_AJOUT, Q_AVANT);
const misesAJour = {
  "apps/web/src/services/endpoints.ts": [[avantApi, apresApi]],
  "apps/Mobile/src/services/api/endpoints.ts": [[avantApi, apresApi]],
  "apps/web/src/services/query.ts": [[avantCles, apresCles]],
  "apps/Mobile/src/services/query.ts": [[avantCles, apresCles]],
};
const appliquer = (chemin, attenduMD5, liste) => {
  let texte = readFileSync(chemin, "utf8");
  const initial = md5(texte);
  if (initial !== attenduMD5) {
    console.log("ARRET_MD5 " + chemin + " : " + initial + " au lieu de " + attenduMD5);
    process.exit(1);
  }
  for (const [avant, apres] of liste) {
    if (!texte.includes(avant)) {
      console.log("ARRET_ABSENCE " + chemin + " : ancre introuvable");
      process.exit(1);
    }
    if (texte.split(avant).length !== 2) {
      console.log("ARRET_DOUBLE " + chemin + " : ancre non unique");
      process.exit(1);
    }
    texte = texte.split(avant).join(apres);
  }
  writeFileSync(chemin, texte);
  console.log(chemin + " mis a jour — md5 : " + md5(texte));
};
for (const [chemin, attenduMD5] of CIBLES) appliquer(chemin, attenduMD5, misesAJour[chemin]);
console.log('FIN fix-ui6-api OK');
