# E-mails d'authentification Supabase — configuration local / production

Les liens de vérification d'adresse et de mot de passe oublié doivent ramener
l'utilisateur sur **le site qui a fait la demande** : `https://agrikonnectweb.onrender.com`
en production, `http://localhost:5173` en local. Jamais l'un à la place de l'autre.

## Comment le lien est construit

1. L'API passe une adresse de retour à Supabase Auth :
   `PUBLIC_WEB_URL` + `/auth/verify-email` (vérification) ou `/auth/reset`
   (mot de passe oublié). Voir `src/shared/links.js`.
2. Supabase **n'accepte** cette adresse que si elle figure dans la liste
   **Redirect URLs** du projet. Sinon il la remplace silencieusement par le
   **Site URL** — c'est ainsi qu'un lien finit sur `localhost`.
3. Le modèle d'e-mail du projet met dans le lien le `token_hash` attendu par les
   pages `/auth/verify-email` et `/auth/reset`, qui le transmettent à l'API.

## 1. Variables d'environnement de l'API

| Environnement | `PUBLIC_WEB_URL` |
| --- | --- |
| Local (`backend/.env`) | `http://localhost:5173` |
| Production (Render, service `agrikonnect-api`) | `https://agrikonnectweb.onrender.com` |

En production, l'API **refuse de démarrer** si `PUBLIC_WEB_URL` est absente,
locale, en `http` ou porte un chemin (`src/config/publicWebUrl.js`).

## 2. Supabase — Authentication → URL Configuration

**Site URL** (adresse de repli, et racine des liens) :

```
https://agrikonnectweb.onrender.com
```

**Redirect URLs** (liste d'autorisation, une ligne par adresse) :

```
https://agrikonnectweb.onrender.com/auth/verify-email
https://agrikonnectweb.onrender.com/auth/reset
http://localhost:5173/auth/verify-email
http://localhost:5173/auth/reset
```

Les deux lignes `localhost` permettent de tester en local avec le même projet
Supabase ; l'adresse de retour choisie dépend alors du `PUBLIC_WEB_URL` de l'API
qui envoie l'e-mail, si bien que les deux environnements ne se mélangent pas.

## 3. Supabase — Authentication → Emails → Templates

**Confirm signup** — remplacer le lien par :

```html
<h2>Confirmez votre adresse e-mail</h2>
<p>Bienvenue sur AGRIKONNECT AFRICA. Cliquez sur le lien ci-dessous pour confirmer votre adresse :</p>
<p><a href="{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=email">Confirmer mon adresse</a></p>
```

**Reset Password** — remplacer le lien par :

```html
<h2>Réinitialiser votre mot de passe</h2>
<p>Cliquez sur le lien ci-dessous pour choisir un nouveau mot de passe :</p>
<p><a href="{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=recovery">Choisir un nouveau mot de passe</a></p>
```

Pourquoi pas `{{ .ConfirmationURL }}` (modèle par défaut) : ce lien fait
confirmer l'adresse par Supabase lui-même puis renvoie avec des jetons de session
dans l'URL, sans `token_hash`. La page `/auth/verify-email` le reconnaît quand
même (adresse confirmée, ou lien expiré) et la connexion suivante reporte la
confirmation sur le profil, mais la réinitialisation de mot de passe, elle,
exige le `token_hash`.

## 4. Supabase — Authentication → Sign In / Providers → Email

- **Confirm email** : activé. Un compte non confirmé ne peut pas se connecter ;
  l'API répond alors `403` « Adresse e-mail non vérifiée » (et non
  « Identifiants incorrects »), sans décompter de tentative.

## 5. Parcours vérifié

1. Inscription sur le site : l'API crée le compte puis envoie aussitôt le lien
   de vérification (`admin.createUser` n'en envoie aucun), et le site affiche
   `/auth/verify-email?email=…`.
2. « Renvoyer le lien » si l'e-mail n'est pas arrivé.
3. Clic sur le lien de l'e-mail → `/auth/verify-email?token_hash=…&type=email`
   sur le site d'origine → bouton « Vérifier mon adresse » → `emailVerifiedAt`
   posé sur le profil, adresse confirmée chez Supabase.
4. Connexion normale.

Le bouton reste nécessaire (pas de vérification automatique à l'ouverture) : les
antivirus et clients de messagerie qui pré-ouvrent les liens consommeraient
sinon le jeton à usage unique.

## Recommandation

Un projet Supabase séparé pour le développement éviterait que les comptes créés
en local arrivent dans la base de production.
