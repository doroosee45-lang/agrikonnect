# AGRIKONNECT AFRICA — Pages publiques ajoutées (Web + Mobile)

Document de référence enregistrant les pages du site public ajoutées au projet
(à-propos, services, détail service), leurs routes et leurs fichiers, sur les
deux plateformes. Mis à jour le 2026-11-02.

## 1. Web — `apps/web` (React Router)

| Route | Composant | Fichier |
|---|---|---|
| `/services` | `PublicServices` | `src/pages/public/Services.tsx` |
| `/services/:serviceId` | `PublicServiceDetail` | `src/pages/public/ServiceDetail.tsx` |
| `/a-propos` | `PublicAbout` | `src/pages/public/About.tsx` |

Déclarées dans `src/App.tsx` (imports paresseux `lazy` + routes publiques).
Ces trois composants sont maintenus sur la machine de développement ; le reste
des pages publiques (`Home`, `Farmers`, `FarmProfile`, `LotProfile`, `MapPage`,
`Cooperatives`, `CooperativeProfile`, `Projects`, `ProjectProfile`, `Tenders`,
`DataCatalog`, `AgricultureCountry`, `CountryLanguageSelector`, `Legal`) est
inchangé.

## 2. Mobile — `apps/Mobile` (Expo Router, le fichier crée la route)

| Route | Écran |
|---|---|
| `/services` | `src/app/services.tsx` |
| `/services/[id]` | `src/app/services/[id].tsx` (détail du service) |
| `/a-propos` | `src/app/a-propos.tsx` |

- Le détail lit le catalogue partagé `src/lib/service-catalog.ts` (`SERVICE_CATALOG`).
- Miroir complet du site public dans `src/app/public-site/` (accueil, a-propos,
  services, producteurs, projets, lots, fermes, coopératives, agriculture,
  données, carte, marchés, appels d'offres, transporteurs, ventes, actualités,
  annonces, FAQ, contact, conditions, confidentialité, mentions, sélecteur
  pays/langue, création de profil, sols, profil) avec la coquille commune
  `src/components/public-site/` (`PublicShell`, sections d'accueil).
- Les textes sont alignés mot pour mot sur les pages web correspondantes.

## 3. Correspondance des trois pages

| Page | Web (route) | Mobile (route) |
|---|---|---|
| Services (liste) | `/services` | `/services` |
| Détail service | `/services/:serviceId` | `/services/[id]` |
| À propos | `/a-propos` | `/a-propos` |

Le paramètre de détail porte le même identifiant de service des deux côtés
(`:serviceId` web ↔ `[id]` mobile), servi par le même catalogue de services.
