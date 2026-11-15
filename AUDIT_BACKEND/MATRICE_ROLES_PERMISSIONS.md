# Matrice des rôles et permissions — Backend AGRIKONNECT AFRICA

Analyse des rôles et permissions **réellement implémentés** (et non tels que décrits par la documentation).

- Source de vérité : `backend/src/shared/permissions.js` (objet `PERMISSIONS`, fonction `can`).
- Rôles : enum `Role` de `backend/prisma/schema.prisma` (lignes 23-45).
- Application : `middleware/authorize.js` (`authorize`, `requireRole`, `requireAdmin`, `requireMfa`, `requireSuperAdmin`), `middleware/tenant.js` (`resolveTenant`), contrôles complémentaires dans les services.
- Le tableau §4 est **généré par script** à partir du module `permissions.js` importé tel quel (aucune recopie manuelle).

---

## 1. Modèle d'autorisation effectif

```
JWT Supabase ──► authenticate (auth.js) ──► req.user.roles = ∪ rôles de TOUTES les adhésions ACTIVE
                                            │
X-Organization-Id ──► resolveTenant (tenant.js) ──► req.tenant.effectiveRoles =
                                            rôles de l'organisation active ∪ req.user.roles   ⚠ H-03
                                            │
authorize('ressource.action') ──► can(effectiveRoles, permission)  (OU logique si plusieurs permissions)
                                            │
service ──► filtre organizationId = req.tenant.organizationId / assertOwnership()
```

Conséquences :

1. **Les rôles ne sont pas cloisonnés par organisation** (`tenant.js:47`) : un rôle détenu dans n'importe quelle organisation s'applique dans l'organisation active. Seule la couche « service » (filtre `organizationId`) continue de cloisonner les **données**.
2. Les routes sans `resolveTenant` utilisent `req.user.roles` (union globale).
3. Les rôles de plateforme (`SUPER_ADMIN`, `ADMIN`…) sont de simples valeurs dans `Membership.roles` d'une organisation quelconque : il n'existe pas d'organisation « plateforme » dédiée.

## 2. Inventaire des rôles

| Rôle | Abr. | Obtention réelle | Preuve | Permissions | Observations |
|---|---|---|---|:-:|---|
| SUPER_ADMIN | SA | SQL d'amorçage puis `POST /admin/users/:id/roles` (SUPER_ADMIN + MFA + mot de passe) | `bootstrap-super-admin.sql`, `admin.service.js:721-735` | 103 | N'a pas les écritures producteur (séparation voulue). MFA contournable (C-03) |
| ADMIN | AD | Attribué par SUPER_ADMIN | `admin.routes.js:96-102` | 98 | Peut suspendre/vérifier tout compte non SUPER_ADMIN |
| MODERATOR | MO | Attribué par SUPER_ADMIN | idem | 32 | Lecture des exploitations/parcelles/sol de **tous** les tenants ? Non : les services filtrent par tenant → permissions `farms.read`… sans effet utile (cf. §5) |
| SUPPORT_AGENT | SU | **Inscription libre** | `auth.schema.js:25` | **94** | ⚠ H-01 : membre du groupe PRODUCER + `fx.write` + `prices.write` |
| FARMER | FA | Inscription libre ; `sync-profile` | `auth.schema.js:22`, `auth.service.js:642` | 95 | Rôle par défaut |
| COOPERATIVE_ADMIN | CA | Inscription libre ; **`POST /organizations` type COOPERATIVE** | `organizations.service.js:65` | 97 | ⚠ H-02 auto-attribution |
| COOPERATIVE_MEMBER | CM | Ajout par un CA | `cooperatives.service.js` | 92 | Hérite de tout le groupe PRODUCER |
| AGRICULTURAL_COMPANY | AC | Inscription libre ; **`POST /organizations` type COMPANY** | `organizations.service.js:65` | 95 | ⚠ H-02 |
| BUYER | BU | Inscription libre | `auth.schema.js:26` | 36 | |
| SUPPLIER | SP | Inscription libre | `auth.schema.js:27` | 34 | |
| TRANSPORTER | TR | Inscription libre | `auth.schema.js:28` | 17 | `orders.read` sans être partie à la commande → lecture filtrée par le service (voit 0 commande) |
| AGRONOMIST | AG | **Inscription libre** | `auth.schema.js:29` | 39 | ⚠ H-01 : valide plages et règles agronomiques, revue d'anomalies, modèles IA |
| INVESTOR | IN | Inscription libre | `auth.schema.js:30` | 20 | MFA auto-déclarée (H-05) |
| LAB_PARTNER | LP | Attribué par SUPER_ADMIN | `permissions.js:262-270` | 14 | Workflow inopérant (F-03) |
| API_CLIENT | API | Aucun chemin d'attribution trouvé | — | 12 | L'API publique utilise des clés (`apiKey.js`), pas ce rôle : rôle **mort** |
| PUBLIC_USER | PU | Aucun chemin d'attribution trouvé | — | 12 | Rôle **mort** (seulement les permissions `*`) |
| VERIFIER | VE | Attribué par SUPER_ADMIN | `GOVERNANCE_ROLES` | 38 | |
| COUNTRY_ADMIN | CO | Attribué par SUPER_ADMIN | idem | 14 | ⚠ M-10 : aucun rattachement à un pays |
| DATA_STEWARD | DS | Attribué par SUPER_ADMIN | idem | 13 | |
| VISITOR | — | **N'existe pas dans l'enum `Role`** | `permissions.js:133` | — | Référence morte (F-07) |

Le minimum de 12 permissions (API_CLIENT, PUBLIC_USER) correspond aux permissions ouvertes à tous (`*`) : `crops.read`, `countries.read`, `fx.read`, `sms.consent`, `listings.read`, `notifications.read/write`, `reviews.read`, `weather.read`, `prices.read`, `tenders.read`, `data.read`.

## 3. Gardes spéciales (hors matrice)

| Garde | Contrôle réel | Routes | Constat |
|---|---|---|---|
| `requireSuperAdmin` | `SUPER_ADMIN` ∈ effectiveRoles **et** `profile.mfaEnabled` | `POST/DELETE /admin/users/:id/roles`, `DELETE /admin/users/:id`, `GET /admin/users/:id/export`, `/admin/flags`, `/admin/security/policy`, `/admin/jobs/:name/pause|resume`, `POST /admin/settings/:key/reset` | Le drapeau ne prouve pas que la **session** a passé la MFA (C-03) |
| `assertMfa(code)` | Code TOTP/secours vérifié à l'appel | `grantRole` | Correct (contrôle effectif) |
| Palier 2 des paramètres | `SUPER_ADMIN` ∈ `req.user.roles` | `PUT /admin/settings` (sections `security`, `integrations`) | Pas de MFA exigée (M-04) |
| `assertActorMayTouch` | Un ADMIN ne peut pas agir sur un SUPER_ADMIN ; pas sur soi-même | Actions M2 | Correct |
| `assertNotLastSuperAdmin` | Empêche de retirer/suspendre le dernier SUPER_ADMIN | révocation, suspension | `DELETE /me` ne l'applique pas (F-10) |
| `requireVerified` | E-mail ou téléphone vérifié | **Aucune** | Jamais branchée (H-07) |
| `apiKeyAuth(scope)` | Clé hachée, portée, contrat de finalité, quota | `/public-api/v1/*`, alias `/` | Quota contournable (M-14) |
| Signature Twilio | HMAC obligatoire | `/webhooks/twilio/status` | Correct |
| Signature WhatsApp | HMAC **si** secret défini | `/channels/whatsapp/webhook` | Optionnelle (M-05) |
| Aucune | — | `POST /channels/ussd`, `POST /public/farms/:slug/contact` | M-05, M-06 |

## 4. Matrice complète (générée depuis le code)

Légende : ✔ autorisé · ★ ouvert à tous (`'*'`) · vide = refusé.
Abréviations : SA SUPER_ADMIN · AD ADMIN · MO MODERATOR · SU SUPPORT_AGENT · FA FARMER · CA COOPERATIVE_ADMIN · CM COOPERATIVE_MEMBER · AC AGRICULTURAL_COMPANY · BU BUYER · SP SUPPLIER · TR TRANSPORTER · AG AGRONOMIST · IN INVESTOR · LP LAB_PARTNER · API API_CLIENT · PU PUBLIC_USER · VE VERIFIER · CO COUNTRY_ADMIN · DS DATA_STEWARD.

| Permission | SA | AD | MO | SU | FA | CA | CM | AC | BU | SP | TR | AG | IN | LP | API | PU | VE | CO | DS |
|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| `crops.read` | ★ | ★ | ★ | ★ | ★ | ★ | ★ | ★ | ★ | ★ | ★ | ★ | ★ | ★ | ★ | ★ | ★ | ★ | ★ |
| `crops.write` | ✔ | ✔ |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| `countries.read` | ★ | ★ | ★ | ★ | ★ | ★ | ★ | ★ | ★ | ★ | ★ | ★ | ★ | ★ | ★ | ★ | ★ | ★ | ★ |
| `countries.write` | ✔ |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| `fx.read` | ★ | ★ | ★ | ★ | ★ | ★ | ★ | ★ | ★ | ★ | ★ | ★ | ★ | ★ | ★ | ★ | ★ | ★ | ★ |
| `fx.write` | ✔ | ✔ |  | ✔ |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| `farms.read` | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |  |  |  |  |  |  |  |  |  |  |  |
| `farms.write` |  |  |  | ✔ | ✔ | ✔ | ✔ | ✔ |  |  |  |  |  |  |  |  |  |  |  |
| `farms.delete` |  |  |  | ✔ | ✔ | ✔ | ✔ | ✔ |  |  |  |  |  |  |  |  |  |  |  |
| `plots.read` | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |  |  |  |  |  |  |  |  |  |  |  |
| `plots.write` |  |  |  | ✔ | ✔ | ✔ | ✔ | ✔ |  |  |  |  |  |  |  |  |  |  |  |
| `plots.delete` |  |  |  | ✔ | ✔ | ✔ | ✔ | ✔ |  |  |  |  |  |  |  |  |  |  |  |
| `history.read` | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |  |  |  |  |  |  |  |  |  |  |  |
| `history.write` |  |  |  | ✔ | ✔ | ✔ | ✔ | ✔ |  |  |  |  |  |  |  |  |  |  |  |
| `productions.read` | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |  |  |  |  |  |  |  |  |  |  |  |
| `productions.write` |  |  |  | ✔ | ✔ | ✔ | ✔ | ✔ |  |  |  |  |  |  |  |  |  |  |  |
| `soil.read` | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |  |  |  |  |  |  |  |  |  |  |  |
| `soil.write` |  |  |  | ✔ | ✔ | ✔ | ✔ | ✔ |  |  |  |  |  |  |  |  |  |  |  |
| `soil.recommend` | ✔ | ✔ |  | ✔ | ✔ | ✔ | ✔ | ✔ |  |  |  | ✔ |  |  |  |  | ✔ |  |  |
| `recommendation.read` | ✔ | ✔ |  | ✔ | ✔ | ✔ | ✔ | ✔ |  |  |  | ✔ |  |  |  |  | ✔ |  |  |
| `recommendation.write` |  |  |  | ✔ | ✔ | ✔ | ✔ | ✔ |  |  |  |  |  |  |  |  |  |  |  |
| `seasons.read` | ✔ | ✔ |  | ✔ | ✔ | ✔ | ✔ | ✔ |  |  |  | ✔ |  |  |  |  | ✔ |  |  |
| `seasons.write` |  |  |  | ✔ | ✔ | ✔ | ✔ | ✔ |  |  |  |  |  |  |  |  |  |  |  |
| `rules.read` | ✔ | ✔ |  | ✔ | ✔ | ✔ | ✔ | ✔ |  |  |  | ✔ |  |  |  |  | ✔ |  |  |
| `rules.write` | ✔ | ✔ |  |  |  |  |  |  |  |  |  | ✔ |  |  |  |  |  |  |  |
| `rules.validate` | ✔ | ✔ |  |  |  |  |  |  |  |  |  | ✔ |  |  |  |  |  |  |  |
| `ranges.read` | ✔ | ✔ |  | ✔ | ✔ | ✔ | ✔ | ✔ |  |  |  | ✔ |  |  |  |  | ✔ |  |  |
| `ranges.write` | ✔ | ✔ |  |  |  |  |  |  |  |  |  | ✔ |  |  |  |  |  |  |  |
| `ranges.validate` | ✔ | ✔ |  |  |  |  |  |  |  |  |  | ✔ |  |  |  |  |  |  |  |
| `sms.consent` | ★ | ★ | ★ | ★ | ★ | ★ | ★ | ★ | ★ | ★ | ★ | ★ | ★ | ★ | ★ | ★ | ★ | ★ | ★ |
| `sms.read` | ✔ | ✔ |  | ✔ | ✔ | ✔ | ✔ | ✔ |  |  |  | ✔ |  |  |  |  | ✔ |  |  |
| `sms.send` | ✔ | ✔ |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| `alerts.read` | ✔ | ✔ |  | ✔ | ✔ | ✔ | ✔ | ✔ |  |  |  | ✔ |  |  |  |  | ✔ |  |  |
| `alerts.write` | ✔ | ✔ |  |  | ✔ | ✔ |  | ✔ |  |  |  | ✔ |  |  |  |  |  |  |  |
| `forecast.read` | ✔ | ✔ |  | ✔ | ✔ | ✔ | ✔ | ✔ |  |  |  | ✔ |  |  |  |  | ✔ |  |  |
| `forecast.write` | ✔ | ✔ |  | ✔ | ✔ | ✔ | ✔ | ✔ |  |  |  | ✔ |  |  |  |  |  |  |  |
| `models.read` | ✔ | ✔ |  |  |  |  |  |  |  |  |  | ✔ |  |  |  |  | ✔ |  |  |
| `models.write` | ✔ | ✔ |  |  |  |  |  |  |  |  |  | ✔ |  |  |  |  |  |  |  |
| `models.promote` | ✔ | ✔ |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| `satellite.read` | ✔ | ✔ |  | ✔ | ✔ | ✔ | ✔ | ✔ |  |  |  | ✔ |  |  |  |  | ✔ |  |  |
| `satellite.write` | ✔ | ✔ |  |  | ✔ | ✔ |  | ✔ |  |  |  | ✔ |  |  |  |  |  |  |  |
| `anomaly.read` | ✔ | ✔ |  | ✔ | ✔ | ✔ | ✔ | ✔ |  |  |  | ✔ |  |  |  |  | ✔ |  |  |
| `anomaly.write` | ✔ | ✔ |  |  | ✔ | ✔ |  | ✔ |  |  |  | ✔ |  |  |  |  |  |  |  |
| `anomaly.review` | ✔ | ✔ |  |  |  |  |  |  |  |  |  | ✔ |  |  |  |  |  |  |  |
| `flags.write` | ✔ | ✔ |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| `cooperatives.read` | ✔ | ✔ |  | ✔ | ✔ | ✔ | ✔ | ✔ |  |  |  |  |  |  |  |  |  |  |  |
| `cooperatives.write` | ✔ | ✔ |  |  |  | ✔ |  |  |  |  |  |  |  |  |  |  |  |  |  |
| `cooperatives.members` | ✔ | ✔ |  |  |  | ✔ |  |  |  |  |  |  |  |  |  |  |  |  |  |
| `media.upload` |  |  |  | ✔ | ✔ | ✔ | ✔ | ✔ |  |  |  |  |  |  |  |  |  |  |  |
| `media.delete` |  |  |  | ✔ | ✔ | ✔ | ✔ | ✔ |  |  |  |  |  |  |  |  |  |  |  |
| `verifications.create` |  |  |  | ✔ | ✔ | ✔ | ✔ | ✔ |  |  |  |  |  |  |  |  |  |  |  |
| `verifications.read` | ✔ | ✔ |  | ✔ | ✔ | ✔ | ✔ | ✔ |  |  |  |  |  |  |  |  |  |  |  |
| `verifications.review` | ✔ | ✔ |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| `reports.create` |  |  |  | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |  |  |  |  |  |  |  |  |  |  |
| `reports.review` | ✔ | ✔ | ✔ |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| `admin.users` | ✔ | ✔ |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| `admin.audit` | ✔ | ✔ |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| `admin.content` | ✔ | ✔ |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| `admin.settings` | ✔ | ✔ |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| `admin.dashboard` | ✔ | ✔ | ✔ |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| `admin.jobs` | ✔ | ✔ |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| `listings.read` | ★ | ★ | ★ | ★ | ★ | ★ | ★ | ★ | ★ | ★ | ★ | ★ | ★ | ★ | ★ | ★ | ★ | ★ | ★ |
| `listings.write` |  |  |  | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |  |  |  |  |  |  |  |  |  |
| `listings.moderate` | ✔ | ✔ | ✔ |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| `listings.media` |  |  |  | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |  |  |  |  |  |  |  |  |  |
| `requests.read` | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |  |  |  |  |  |  |  |  |  |
| `requests.write` | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |  |  |  |  |  |  |  |  |  |
| `offers.read` |  |  |  | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |  |  |  |  |  |  |  |  |  |
| `offers.write` |  |  |  | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |  |  |  |  |  |  |  |  |  |
| `orders.read` | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |  |  |  |  |  |  |  |  |
| `orders.write` |  |  |  | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |  |  |  |  |  |  |  |  |  |
| `orders.review` | ✔ | ✔ | ✔ |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| `inventory.read` | ✔ | ✔ |  | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |  |  |  |  |  |  |  |  |  |
| `inventory.write` |  |  |  | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |  |  |  |  |  |  |  |  |  |
| `transport.read` |  |  |  | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |  |  |  |  |  |  |  |  |
| `transport.write` |  |  |  | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |  |  |  |  |  |  |  |  |
| `messages.read` | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |  |  |  |  |  |  |  |  |
| `messages.write` | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |  |  |  |  |  |  |  |  |
| `messages.moderate` | ✔ | ✔ | ✔ |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| `notifications.read` | ★ | ★ | ★ | ★ | ★ | ★ | ★ | ★ | ★ | ★ | ★ | ★ | ★ | ★ | ★ | ★ | ★ | ★ | ★ |
| `notifications.write` | ★ | ★ | ★ | ★ | ★ | ★ | ★ | ★ | ★ | ★ | ★ | ★ | ★ | ★ | ★ | ★ | ★ | ★ | ★ |
| `invoices.read` | ✔ | ✔ |  | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |  |  |  |  |  |  |  |  |  |
| `invoices.write` |  |  |  | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |  |  |  |  |  |  |  |  |  |
| `reviews.read` | ★ | ★ | ★ | ★ | ★ | ★ | ★ | ★ | ★ | ★ | ★ | ★ | ★ | ★ | ★ | ★ | ★ | ★ | ★ |
| `reviews.write` |  |  |  | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |  |  |  |  |  |  |  |  |  |
| `reviews.moderate` | ✔ | ✔ | ✔ |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| `disputes.read` | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |  |  |  |  |  |  |  |  |  |
| `disputes.review` | ✔ | ✔ | ✔ |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| `sync.write` |  |  |  | ✔ | ✔ | ✔ | ✔ | ✔ |  |  |  |  |  |  |  |  |  |  |  |
| `ai.read` | ✔ | ✔ |  | ✔ | ✔ | ✔ | ✔ | ✔ |  |  |  | ✔ |  |  |  |  | ✔ |  |  |
| `ai.write` |  |  |  | ✔ | ✔ | ✔ | ✔ | ✔ |  |  |  |  |  |  |  |  |  |  |  |
| `ai.review` | ✔ | ✔ |  |  |  |  |  |  |  |  |  | ✔ |  |  |  |  | ✔ |  |  |
| `weather.read` | ★ | ★ | ★ | ★ | ★ | ★ | ★ | ★ | ★ | ★ | ★ | ★ | ★ | ★ | ★ | ★ | ★ | ★ | ★ |
| `prices.read` | ★ | ★ | ★ | ★ | ★ | ★ | ★ | ★ | ★ | ★ | ★ | ★ | ★ | ★ | ★ | ★ | ★ | ★ | ★ |
| `prices.write` | ✔ | ✔ |  | ✔ |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| `lots.read` | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |  |  |  |  |  |  |  |  |  |  |  |
| `lots.write` |  |  |  | ✔ | ✔ | ✔ | ✔ | ✔ |  |  |  |  |  |  |  |  |  |  |  |
| `certifications.read` | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |  |  |  |  |  |  |  |  |  |  |
| `certifications.write` |  |  |  | ✔ | ✔ | ✔ | ✔ | ✔ |  |  |  |  |  |  |  |  |  |  |  |
| `certifications.verify` | ✔ | ✔ |  |  |  |  |  |  |  |  |  |  |  |  |  |  | ✔ |  |  |
| `iot.read` | ✔ | ✔ |  | ✔ | ✔ | ✔ | ✔ | ✔ |  |  |  |  |  |  |  |  |  |  |  |
| `iot.write` |  |  |  | ✔ | ✔ | ✔ | ✔ | ✔ |  |  |  |  |  |  |  |  |  |  |  |
| `geodata.read` | ✔ | ✔ |  | ✔ | ✔ | ✔ | ✔ | ✔ |  |  |  | ✔ |  |  |  |  | ✔ |  |  |
| `geodata.write` |  |  |  | ✔ | ✔ | ✔ | ✔ | ✔ |  |  |  |  |  |  |  |  |  |  |  |
| `channels.read` | ✔ | ✔ |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| `lab.read` | ✔ | ✔ |  | ✔ | ✔ | ✔ | ✔ | ✔ |  |  |  |  |  | ✔ |  |  |  |  |  |
| `lab.write` | ✔ | ✔ |  |  |  |  |  |  |  |  |  |  |  | ✔ |  |  |  |  |  |
| `projects.read` | ✔ | ✔ |  | ✔ | ✔ | ✔ | ✔ | ✔ |  |  |  |  | ✔ |  |  |  | ✔ |  |  |
| `projects.write` |  |  |  | ✔ | ✔ | ✔ | ✔ | ✔ |  |  |  |  |  |  |  |  |  |  |  |
| `projects.review` | ✔ | ✔ |  |  |  |  |  |  |  |  |  |  |  |  |  |  | ✔ |  |  |
| `investors.read` | ✔ | ✔ |  |  |  |  |  |  |  |  |  |  | ✔ |  |  |  | ✔ |  |  |
| `investors.write` | ✔ | ✔ |  |  |  |  |  |  |  |  |  |  | ✔ |  |  |  |  |  |  |
| `investors.verify` | ✔ | ✔ |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| `dataroom.read` | ✔ | ✔ |  | ✔ | ✔ | ✔ | ✔ | ✔ |  |  |  |  | ✔ |  |  |  | ✔ |  |  |
| `dataroom.write` |  |  |  | ✔ | ✔ | ✔ | ✔ | ✔ |  |  |  |  |  |  |  |  |  |  |  |
| `dataroom.request` | ✔ | ✔ |  |  |  |  |  |  |  |  |  |  | ✔ |  |  |  | ✔ |  |  |
| `dataroom.decide` |  |  |  | ✔ | ✔ | ✔ | ✔ | ✔ |  |  |  |  |  |  |  |  |  |  |  |
| `duediligence.read` | ✔ | ✔ |  | ✔ | ✔ | ✔ | ✔ | ✔ |  |  |  |  | ✔ |  |  |  | ✔ |  |  |
| `duediligence.write` | ✔ | ✔ |  | ✔ | ✔ | ✔ | ✔ | ✔ |  |  |  |  |  |  |  |  | ✔ |  |  |
| `reporting.read` | ✔ | ✔ |  | ✔ | ✔ | ✔ | ✔ | ✔ |  |  |  |  | ✔ |  |  |  | ✔ |  |  |
| `reporting.write` |  |  |  | ✔ | ✔ | ✔ | ✔ | ✔ |  |  |  |  |  |  |  |  |  |  |  |
| `funding.read` | ✔ | ✔ |  | ✔ | ✔ | ✔ | ✔ | ✔ |  |  |  |  |  |  |  |  |  |  |  |
| `funding.write` |  |  |  | ✔ | ✔ | ✔ | ✔ | ✔ |  |  |  |  |  |  |  |  |  |  |  |
| `precision.read` | ✔ | ✔ |  | ✔ | ✔ | ✔ | ✔ | ✔ |  |  |  | ✔ |  |  |  |  | ✔ |  |  |
| `precision.write` |  |  |  | ✔ | ✔ | ✔ | ✔ | ✔ |  |  |  |  |  |  |  |  |  |  |  |
| `geospatial.read` | ✔ | ✔ |  | ✔ | ✔ | ✔ | ✔ | ✔ |  |  |  | ✔ | ✔ |  |  |  | ✔ |  |  |
| `geospatial.write` | ✔ | ✔ |  | ✔ | ✔ | ✔ | ✔ | ✔ |  |  |  | ✔ |  |  |  |  | ✔ |  |  |
| `tenders.read` | ★ | ★ | ★ | ★ | ★ | ★ | ★ | ★ | ★ | ★ | ★ | ★ | ★ | ★ | ★ | ★ | ★ | ★ | ★ |
| `tenders.write` |  |  |  | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |  |  |  |  |  |  |  |  |  |
| `tenders.respond` |  |  |  | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |  |  |  |  |  |  |  |  |  |
| `export.read` | ✔ | ✔ |  | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |  |  |  |  |  |  |  |  |  |
| `export.write` |  |  |  | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |  |  |  |  |  |  |  |  |  |
| `apiclients.read` | ✔ | ✔ |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  | ✔ |  |
| `apiclients.manage` | ✔ | ✔ |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| `insights.read` | ✔ | ✔ |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  | ✔ |  |
| `dataproducts.manage` | ✔ | ✔ |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  | ✔ |
| `data.read` | ★ | ★ | ★ | ★ | ★ | ★ | ★ | ★ | ★ | ★ | ★ | ★ | ★ | ★ | ★ | ★ | ★ | ★ | ★ |
| `admin.roles` | ✔ |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| `admin.security` | ✔ |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| `admin.flags` | ✔ |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| `admin.maintenance` | ✔ |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |

## 5. Incohérences et risques relevés

| # | Constat | Preuve | Sévérité | Correction |
|---|---|---|---|---|
| R-1 | `SUPPORT_AGENT` (inscription libre) ∈ PRODUCER → 94 permissions, dont `fx.write` et `prices.write` | `permissions.js:8-14, 40, 178` ; `auth.schema.js:25` | Élevée (H-01) | Liste dédiée, attribution administrative |
| R-2 | `AGRONOMIST` (inscription libre) : `rules.write/validate`, `ranges.write/validate`, `anomaly.review`, `models.write`, `ai.review` | `permissions.js:76-86, 112, 123, 175` | Élevée (H-01) | Vérification professionnelle préalable |
| R-3 | Rôles producteur obtenus par `POST /organizations` | `organizations.routes.js:14`, `organizations.service.js:65` | Élevée (H-02) | Permission + validation |
| R-4 | Union des rôles inter-organisations | `tenant.js:47` | Élevée (H-03) | Cloisonnement |
| R-5 | `MODERATOR`/`ADMIN` ont `farms.read`, `plots.read`, `soil.read`… mais les services filtrent par **leur** tenant : permission sans effet, aucune vue de modération transverse de ces données | `permissions.js:41-52` ; `farms.service.js` (filtre `organizationId`) | Faible (fonctionnel) | Clarifier : retirer, ou créer des routes de modération dédiées |
| R-6 | `INVESTOR` a `geospatial.read` mais ne peut lire que les parcelles de **sa propre** organisation | `permissions.js:213` ; `geospatial.service.js:76-78` | Faible | Accès via data room/projet ou retrait |
| R-7 | `TRANSPORTER` a `orders.read` sans lien avec les commandes qu'il transporte | `permissions.js:151` ; `orders.service.js:360-371` | Faible | Filtrer par transport assigné |
| R-8 | `COUNTRY_ADMIN` sans périmètre pays | `insights.service.js:80` | Moyenne (M-10) | Rattachement pays |
| R-9 | `LAB_PARTNER` : la saisie teste `organization.type === 'LAB_PARTNER'` (inexistant) et `roles[0]` | `geodata.service.js:159-161` | Faible (F-03) | Utiliser `can(effectiveRoles,'lab.write')` |
| R-10 | `investors.read` liste `ADMIN_ROLES` deux fois (`INVEST` les contient déjà) ; `tenders.write` contient BUYER deux fois ; doublons de clés `dataproducts.manage`, `data.read` | `permissions.js:196, 218, 225-229` | Cosmétique | Nettoyage |
| R-11 | Permissions définies jamais utilisées : `admin.roles`, `admin.security`, `admin.maintenance` (les routes utilisent `requireSuperAdmin`) | `permissions.js:233-239` | Cosmétique | Supprimer ou brancher |
| R-12 | Rôles `API_CLIENT`, `PUBLIC_USER` sans chemin d'attribution ; `VISITOR` hors enum | §2 | Cosmétique | Supprimer de la matrice |
| R-13 | `notifications.write` ouvert à tous (★) | `permissions.js:162` | À vérifier | Vérifier que le service limite aux notifications du destinataire |
| R-14 | `GET /me/permissions` renvoie la liste calculée sur l'union des rôles (reflète H-03) | `users.service.js:114-117` | Faible | Suivra P2.1 |

## 6. Routes dont l'accès ne passe pas par la matrice

| Route | Contrôle effectif |
|---|---|
| `GET/PATCH/DELETE /me`, `GET /me/permissions`, `POST /me/password` | Authentification seule (soi-même) — H-04 sur le mot de passe |
| `GET/POST /organizations`, `GET/PATCH /organizations/:id` | Authentification + appartenance ; **aucune permission** (H-02) |
| `GET /dashboard` | Authentification + tenant |
| `GET /media` | Authentification + tenant |
| `GET /sms/settings` | Authentification + tenant (lecture de configuration SMS non sensible) |
| `/auth/*` | Publique (limiteur `authLimiter`) ou authentifiée |
| `/public/*`, `/public/blog-posts*`, `/public/lots/:code` | Publique (seule `/public/lots/:code` a `publicRateLimit`) |
| `POST /iot/ingest` | Clé d'appareil hachée |
| `/public-api/v1/*` | Clé d'API |
| `/channels/*`, `/webhooks/twilio/status` | Voir §3 |
