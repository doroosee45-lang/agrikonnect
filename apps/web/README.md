# AGRIKONNECT AFRICA — application web (React)

Portail web React qui consomme la même API AGRIKONNECT que l'application mobile
(backend Express + Prisma, base `/api/v1`). Aucune donnée n'est inventée côté
client : chaque page affiche soit une donnée réelle de l'API, soit un état
vide / erreur explicite.

## Démarrage

```bash
npm ci                 # ou : npm install --legacy-peer-deps
npm run dev            # Vite dev server (http://localhost:5173)
npm run build          # typecheck + build de production (dist/)
npm run typecheck      # tsc --noEmit
npm run verify         # typecheck + build
```

Configuration de l'API (variables d'environnement Vite) :

| Variable | Défaut | Rôle |
| --- | --- | --- |
| `VITE_API_BASE_URL` | `http://localhost:4000/api/v1` | Base HTTP de l'API |
| `VITE_REALTIME_URL` | `http://localhost:4000` | Socket.IO (path `/realtime`) |

Sans backend démarré, les pages authentifiées affichent leurs états d'erreur
réels (401/403/404) et les pages publiques affichent l'état vide : rien n'est
simulé.

## Stack

Vite 8 · React 19 · TypeScript 6 · React Router 7 · Framer Motion 14 ·
TanStack Query (état serveur) · Zustand + sessionStorage/localStorage (session,
jetons jamais dans le state React) · Axios (enveloppe `success/data/meta`,
`Idempotency-Key` ULID sur les écritures) · Socket.IO client · i18n fr/en ·
palette du CDC (forestGreen #174D35, livingGreen #65A64B, gold #D6A64F…).

## Structure de `src/pages`

156 pages, organisées par espace. Les éléments partagés (socles de tableau,
module de parcelle, 404) vivent dans `src/components/pages/`, pas dans
`src/pages/` : ce dernier ne contient que des routes.

| Dossier | Contenu |
| --- | --- |
| `admin/` | 33 écrans d'administration (tableau de bord, comptes, audit, conformité, modération, supervision, référentiels, réglages) |
| `agent/` | Agent de terrain : consentement, enregistrement |
| `ai/` | Analyses, détail d'analyse, assistant, documents |
| `app/` | 21 écrans de l'espace connecté (tableau de bord, exploitations, parcelles, commandes, messagerie, stock, transport, vérification) |
| `auth/` | Login (branche MFA), register, mot de passe oublié, réinitialisation, vérification email et téléphone |
| `developers/` | Documentation API, clients, clés, usage |
| `farmer/` | Espace producteur : `Export/`, `Farms/`, `Lots/`, `Plots/` (liste, création, détail + 8 modules), `Projects/` (data room, rapports, journal d'accès), plus certifications, galerie, sol, sync, enquêtes |
| `insights/` | Indicateurs agrégés par pays et par région |
| `international/` | Documents d'export, commandes, appels d'offres |
| `investment/` | Projets suivis, profil investisseur, détail de projet, demandes de contact |
| `market/` | Marketplace : annonces, demandes d'achat, correspondances, avis, transporteurs |
| `organization/` | Organisation : vue d'ensemble, membres, invitations, import, exploitations, production, vérification |
| `public/` | Surface anonyme : accueil, carte, producteurs, coopératives, lots, projets, appels d'offres, données, agriculture par pays, mentions |
| `reviewer/` | Vérificateur : missions, checklist |
| racine | `CropPrices`, `Prices`, `Weather` |

## Surface anonyme réelle

Le backend n'expose que six routes sans authentification. Tout le reste renvoie
403 en anonyme, et les pages concernées passent par `AuthGate` :

```
GET  /public/map
GET  /public/farms
GET  /public/farms/:slug
POST /public/farms/:slug/contact
GET  /public/farms/:slug/qr.{png|svg}
GET  /public/soil-stats          (k-anonymat ≥ 10)
```

Il n'existe **pas** de formulaire de contact générique : la seule mise en
relation anonyme est `POST /public/farms/:slug/contact`, rattachée à une
exploitation précise.

## Règles produit respectées côté UI

- Provenance affichée partout : `✔ mesuré` / `≈ déclaré`, source, méthode, date
  (composant `ProvenanceTag`). Une valeur déclarée n'est jamais présentée comme
  vérifiée.
- Aucun total inventé : un agrégat sous le seuil de k-anonymat est affiché
  `null` avec son motif, jamais arrondi ni remplacé par zéro.
- Sorties IA toujours accompagnées de leur avertissement ; escalade humaine
  possible ; consentement explicite requis avant tout traitement.
- Coordonnées masquées par défaut : le contact passe par la plateforme.
- Jetons stockés hors du state React, refresh rotatif, un seul refresh en vol.
- Conflits de synchronisation jamais résolus en silence : ils restent à arbitrer.

## État

`npm run verify` (typecheck + build) : **0 erreur**. Les 156 pages sont
déclarées dans `src/App.tsx` et le build les émet toutes.

Ce qui n'est pas couvert par la vérification : aucune page n'est exercée contre
un backend live. Les appels sont typés contre les contrats de l'API, mais le
rendu avec données réelles n'est pas testé ici.
