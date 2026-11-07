# AGRIKONNECT AFRICA — application mobile (Expo)

Application React Native / Expo Router qui consomme l'API AGRIKONNECT (backend Express + Prisma,
`backend/`, base `/api/v1`). Aucune donnée n'est inventée côté client : chaque écran affiche soit
une donnée réelle de l'API, soit un état vide / erreur explicite.

## Démarrage

```bash
npm ci                 # ou : npx expo install
npm run start          # Expo Dev Server (web / iOS / Android)
npm run typecheck      # tsc --noEmit
npm run verify         # typecheck + export web
```

Configuration de l'API (variables d'environnement Expo) :

| Variable | Défaut | Rôle |
| --- | --- | --- |
| `EXPO_PUBLIC_API_BASE_URL` | `http://localhost:4000/api/v1` | Base HTTP de l'API |
| `EXPO_PUBLIC_REALTIME_URL` | `http://localhost:4000` | Socket.IO (path `/realtime`) |

Sans backend démarré, les écrans authentifiés affichent leurs états d'erreur réels (401/403/404) et
les écrans publics affichent l'état vide : rien n'est simulé.

## Stack

Expo SDK 58 · React Native 0.88 · Expo Router · Reanimated 4 + worklets · Gesture Handler ·
TanStack Query (état serveur) · Zustand + SecureStore (session, tokens jamais en clair) ·
Axios (enveloppe `success/data/meta`, `Idempotency-Key` ULID sur les écritures) · Socket.IO client ·
i18n fr/en · palette du CDC (forestGreen #174D35, livingGreen #65A64B, gold #D6A64F…).

## Contenu livré

- **70 fichiers de routes** (`src/app`) + 37 composants + 23 modules `lib/services/hooks/theme`.
- **Site public** : accueil (13 sections), services, FAQ, à propos, actualités, producteurs, explorer,
  marchés, prix, appels d'offres, projets, météo, contact, fiche exploitation `/public-site/farm/[slug]`,
  fiche lot par QR `/public-site/lot/[code]`, statistiques de sol, mentions, confidentialité, conditions, 404.
- **Auth** : login (branche MFA), register (rôles en self-service), mot de passe oublié, MFA
  (setup/confirm/verify/disable), vérification de téléphone.
- **Espace producteur** (`/farmer`, onglets animés) : pilotage, exploitations, parcelles, récoltes, sol ;
  fiche parcelle + 8 modules : sol, compatibilité (règles versionnées), rotation, plan agricole,
  rapport de précision + fourchettes de rendement, zones de gestion, capteurs IoT, satellite/diagnostic.
- **Marché** : annonces (liste, publication, fiche + contact par messagerie), demandes d'achat
  (correspondances, offres, décision), commandes (transitions, paiement, litige, journal), stock et mouvements.
- **Messagerie & notifications** : conversations rattachées à un objet métier, fil en temps réel,
  signalement/blocage ; boîte de réception et préférences par type × canal.
- **Organisation & coopérative** : identité, membres, vérifications, certifications ; coopérative,
  membres et consentement.
- **Espaces rôles** : producteur, ventes, agent de terrain, vérificateur (file, escalades IA, litiges,
  certifications), administration (tableau de bord, comptes, audit, tâches), développeurs (clients API,
  finalité, clés, usage), IA (consentement, escalade), insights (k-anonymat), investissement (projets,
  data room, rapports, financement), international (appels d'offres, couverture pays), profil.

## Règles produit respectées côté UI

- Provenance affichée partout : `✔ mesuré` / `≈ déclaré`, source, méthode, date (composant `ProvenanceTag`).
- Aucun total inventé : unités non convertibles exclues des cumuls, agrégats sous seuil de k-anonymat
  affichés `null` avec leur motif.
- Sorties IA et géospatiales toujours accompagnées de leur avertissement ; escalade humaine possible ;
  recommandations automatiques désactivées (`allowRecommendations = false`).
- Coordonnées masquées par défaut : le contact passe par une conversation ou une demande acceptée.
- Rapports de précision « proposition non validée » tant qu'aucun agronome identifié n'a validé (PRE-03).
- Clés d'appareil et clés API affichées une seule fois, à la création ou à la rotation.

## État du chantier

Implémenté et vérifié (`npm run typecheck` + `npm run bundle:web` : 0 erreur) : site public, auth,
espace producteur complet, marché, messagerie, notifications, organisation/coopérative, espaces rôles
listés ci-dessus.

Reste à couvrir dans les prochains lots : écrans de détail secondaires de certaines arborescences
(ex. transport `/transport`, exports `/exports`, data product `/data`, canaux USSD/WhatsApp), et le
portail web React (`apps/web`) demandé après le mobile.
