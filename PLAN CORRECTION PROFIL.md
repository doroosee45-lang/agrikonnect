# MISSION PRIORITAIRE : CORRECTION, RESTRUCTURATION ET IMPLÉMENTATION COMPLÈTE DES MODULES PROFILE & SETTINGS — AGRIKONNECT AFRICA

## 1. CONTEXTE ET DOCUMENTS DE RÉFÉRENCE

Je te transmets trois rapports d'audit détaillés concernant les modules PROFILE et SETTINGS d'AgriKonnect Africa :

1. `AUDIT_PROFILE_SETTINGS_FULLSTACK_PART1.md`
2. `AUDIT_PROFILE_SETTINGS_FULLSTACK_PART2.md`
3. `AUDIT_PROFILE_SETTINGS_MOBILE.md`

Tu dois impérativement lire et analyser les trois documents dans leur intégralité avant de commencer les modifications.

Ces audits couvrent :
- L'application Web.
- L'application Mobile React Native.
- Le Backend et ses API.
- Les routes et les systèmes de navigation.
- Les fonctionnalités existantes et manquantes.
- Les problèmes d'architecture, les doublons et les dysfonctionnements.
- Les propositions d'amélioration et les critères d'acceptation.

**IMPORTANT : Les rapports constituent la base de référence de cette mission. Il ne faut pas simplement proposer des solutions : il faut réellement les développer, les intégrer, les connecter au Backend et vérifier leur fonctionnement.**

## 2. OBJECTIF GÉNÉRAL

Je demande une véritable refonte fonctionnelle et structurelle des espaces PROFILE et SETTINGS.

Le résultat attendu est une architecture professionnelle, moderne, cohérente et harmonisée sur le Web et le Mobile.

Il faut notamment :

- Corriger toutes les fonctionnalités défectueuses.
- Compléter les fonctionnalités inachevées.
- Implémenter les fonctionnalités absentes prévues dans les audits.
- Corriger les routes et les liens de navigation.
- Supprimer les doublons et les interfaces contradictoires.
- Harmoniser les données entre Web, Mobile et Backend.
- Différencier clairement les profils individuels des profils d'organisations et d'entreprises.
- Garantir que chaque bouton, formulaire, lien et action fonctionne réellement.

Ne te limite pas à modifier les composants visuels. Il faut assurer le fonctionnement réel de chaque fonctionnalité.

## 3. DISTINCTION FONDAMENTALE ENTRE LES TYPES DE PROFILS

C'est l'un des points les plus importants de cette mission.

Je ne veux surtout pas que le profil d'une organisation ou d'une entreprise utilise la même structure que celui d'un professionnel indépendant.

Il faut concevoir des expériences distinctes, avec des champs, des informations, des formulaires et des fonctionnalités adaptés à chaque type de compte.

### A. PROFIL D'UN PROFESSIONNEL INDÉPENDANT

Il s'agit du profil d'une personne physique qui exerce une activité professionnelle en son propre nom, sans représenter obligatoirement une entreprise ou une organisation.

Exemples :
- Consultant indépendant.
- Agronome.
- Expert agricole.
- Technicien.
- Entrepreneur individuel.
- Prestataire de services.
- Professionnel indépendant.
- Producteur individuel.

Ce profil doit comporter les sections suivantes :

**1. Identité personnelle**
- Photo de profil.
- Prénom et nom.
- Adresse e-mail.
- Numéro de téléphone.
- WhatsApp.
- Pays et localisation.
- Statuts de vérification.

**2. Identité professionnelle**
- Profession.
- Poste ou fonction.
- Domaine d'activité.
- Secteur d'expertise.
- Spécialités.
- Années d'expérience.
- Biographie professionnelle.
- Compétences.
- Certifications et qualifications.
- Diplômes, lorsque pertinents.

**3. Activité professionnelle**
- Services proposés.
- Types de prestations.
- Zones géographiques d'intervention.
- Projets et réalisations.
- Portfolio professionnel.
- Disponibilité professionnelle, si cette fonctionnalité est pertinente.

**4. Coordonnées professionnelles**
- Adresse professionnelle, si applicable.
- E-mail professionnel.
- Téléphone professionnel.
- Liens vers les plateformes professionnelles.

**5. Visibilité publique**
- Informations visibles publiquement.
- Présentation professionnelle.
- Services publiés.
- Portfolio visible.
- Gestion des informations privées et publiques.

Le professionnel doit pouvoir construire une véritable identité professionnelle indépendante.

### B. PROFIL D'UNE ORGANISATION OU D'UNE ENTREPRISE

Ce profil représente une personne morale ou une structure collective.

Exemples :
- Entreprise.
- Société commerciale.
- Coopérative agricole.
- Association.
- ONG.
- Organisation agricole.
- Institution.
- Groupement professionnel.

Il ne faut pas utiliser les champs personnels du profil individuel pour représenter une organisation.

Le profil doit comprendre :

**1. Identité de l'organisation**
- Nom officiel.
- Nom commercial.
- Logo.
- Image de couverture.
- Type de structure.
- Secteur d'activité.
- Description institutionnelle.
- Date de création.
- Pays d'enregistrement.
- Adresse du siège social.

**2. Informations juridiques et administratives**
- Forme juridique.
- Numéro d'immatriculation, si applicable.
- Identifiant fiscal, si applicable.
- Documents administratifs.
- Statut de vérification.
- Informations du représentant légal.

Ne jamais inventer ou rendre obligatoires des identifiants juridiques qui ne sont pas applicables au type de structure.

**3. Coordonnées de l'organisation**
- Adresse professionnelle.
- Téléphone officiel.
- E-mail institutionnel.
- Site Internet.
- Réseaux sociaux.
- Coordonnées des différents établissements, si nécessaire.

**4. Direction et administration**
- Fondateur ou responsable.
- Directeur général ou président.
- Représentant légal.
- Administrateurs.
- Membres.
- Collaborateurs.
- Responsabilités et rôles.

**5. Activités de l'organisation**
- Domaines d'intervention.
- Produits et services.
- Projets.
- Réalisations.
- Implantations géographiques.
- Partenaires.
- Certifications institutionnelles.

**6. Présentation publique**
- Présentation institutionnelle.
- Logo et couverture.
- Informations publiques.
- Services et activités.
- Coordonnées publiques.
- Projets et réalisations publiés.

**7. Gestion des membres et permissions**
- Invitation de membres.
- Gestion des rôles.
- Permissions.
- Administration des accès.
- Gestion des responsables.

Attention : les informations et fonctionnalités administratives doivent dépendre des permissions de l'utilisateur connecté.

### C. PROFIL AGRICULTEUR ET PROFIL INVESTISSEUR

Il faut également respecter les spécificités des rôles existants dans AgriKonnect Africa.

**Agriculteur (FARMER)** :
- Identité personnelle.
- Activité agricole.
- Type d'exploitation.
- Cultures principales.
- Expérience agricole.
- Certifications.
- Exploitations associées.
- Organisations auxquelles il appartient.
- Projets agricoles.
- Biographie et présentation publique.

**Investisseur (INVESTMENT)** :
- Identité personnelle.
- Coordonnées.
- Profil d'investissement.
- Secteurs d'intérêt.
- Pays d'investissement.
- Fourchette de financement.
- Devise préférée.
- Accès à la Data Room.
- Consentements et préférences.

Un investisseur individuel ne doit pas être automatiquement assimilé à une entreprise d'investissement.

Si un investisseur représente une société, il doit pouvoir disposer d'un profil personnel distinct et accéder au profil de son organisation selon ses permissions.

## 4. RESTRUCTURATION DU MODULE PROFILE

Chaque rôle doit disposer d'un espace PROFILE clairement identifiable.

### FARMER
Route principale : `/farmer/profile`

Créer une structure complète avec :
- Identité personnelle.
- Identité professionnelle agricole.
- Exploitations et responsabilités.
- Certifications.
- Vérification.
- Complétude du profil.
- Présentation publique.

### PROFESSIONAL INDIVIDUAL
Créer un espace dédié au professionnel indépendant, sans réutiliser abusivement le profil organisation.

Il faut d'abord vérifier si ce type de compte existe déjà dans le modèle de données et le système de rôles. S'il n'existe pas, concevoir son intégration proprement sans inventer un rôle incompatible avec l'architecture actuelle.

### ORGANIZATION
Route cible : `/organization/:id/profile`

Créer un profil institutionnel indépendant comprenant toutes les sections décrites précédemment.

### INVESTMENT
Route principale : `/investment/profile`

Compléter le profil investisseur et permettre la modification de ses informations et préférences.

### PROFIL PUBLIC

Distinguer clairement :
- Mon profil privé.
- Mon profil professionnel public.
- Le profil public d'une organisation.
- Le profil public d'un agriculteur.

Les informations confidentielles ne doivent jamais apparaître dans les profils publics.

## 5. RESTRUCTURATION DU MODULE SETTINGS

Créer une architecture cohérente de paramètres pour chaque type de compte.

Routes cibles :

- `/farmer/settings`
- `/organization/:id/settings`
- `/investment/settings`
- Espace de paramètres du professionnel indépendant, selon le système de rôles retenu.
- `/admin/settings` pour les paramètres administratifs de la plateforme.

Chaque espace SETTINGS doit comporter les sections suivantes, adaptées au contexte du compte :

**A. Préférences de l'application**
- Langue.
- Apparence et thème, si disponible.
- Préférences générales.

**B. Notifications**
- Notifications Push.
- E-mails.
- SMS.
- Préférences par type et par canal.
- Résumé des paramètres actuels.

**C. Sécurité et compte**
- Changement de mot de passe.
- Authentification à deux facteurs (MFA/2FA).
- Sessions actives.
- Gestion des appareils et accès, si le Backend le permet.

**D. Confidentialité et données**
- Consentement SMS.
- Préférences de communication.
- Gestion des consentements.
- Téléchargement des données personnelles.
- Suppression du compte avec confirmation.

Pour une organisation, distinguer les préférences personnelles de chaque membre des paramètres collectifs de l'organisation.

Un administrateur d'organisation ne doit pas modifier les préférences personnelles des membres sans autorisation appropriée.

## 6. CORRECTION OBLIGATOIRE DES ROUTES ET DES LIENS

Il faut effectuer un audit complet de toutes les navigations de l'application.

Le problème actuel est que plusieurs routes se ressemblent, certaines pages sont dupliquées et plusieurs boutons dirigent vers de mauvaises destinations.

Corrections prioritaires :

**Mobile :**
- Le bouton Settings du `FarmerHeader` doit ouvrir `/farmer/settings`, et non `/profil`.
- Les boutons Settings de `AppHeader` doivent diriger vers les paramètres correspondant au rôle et à l'organisation active.
- Le bouton Profile doit ouvrir le profil correspondant au compte actif.
- Le bouton de configuration MFA doit ouvrir la véritable page `/auth/mfa`.
- Le bouton de configuration des notifications doit ouvrir `/notifications/preferences`.
- La page SMS consent doit être accessible depuis les paramètres de confidentialité.

**Web :**
- Harmoniser les accès Profile et Settings.
- Corriger les liens entre les pages principales, les menus et les tableaux de bord.
- Éliminer les destinations obsolètes.
- Éviter les pages Profile concurrentes.

**Routes à examiner particulièrement :**
- `/farmer/profile`
- `/organization/profile`
- `/investment/profile`
- `/app/profile`
- `/profil`
- `/farmer/public-profile`
- `/notifications/preferences`
- `/notifications/sms-consent`
- `/auth/mfa`
- `/farmer/settings`
- `/admin/settings`

Les routes cibles proposées dans cet audit doivent être intégrées en tenant compte de l'architecture réelle.

Ne supprime pas brutalement une ancienne route si elle est encore utilisée. Prévois des redirections ou des alias compatibles lorsque cela est nécessaire.

**Règle absolue : aucun bouton, lien, menu, raccourci ou action ne doit conduire vers une page inexistante, incorrecte ou sans rapport avec son intitulé.**

## 7. CORRECTIONS FONCTIONNELLES OBLIGATOIRES

Corriger en priorité les problèmes confirmés :

1. Bouton Save vide dans les paramètres Mobile.
2. Notifications qui utilisent uniquement des états locaux sans sauvegarde.
3. Langue Mobile qui n'est pas persistée sur le serveur.
4. MFA affichée avec un simple toggle sans accès à la véritable configuration.
5. Mauvaise destination du bouton Settings dans FarmerHeader.
6. Duplication des pages Profile.
7. Duplication et confusion des paramètres de notifications.
8. Page SMS consent isolée.
9. Profil investisseur Web incomplet.
10. Absence de paramètres Organisation et Investissement.

Il faut également intégrer progressivement les fonctionnalités manquantes :
- Changement de mot de passe.
- Photo de profil et logo d'organisation.
- Informations professionnelles.
- Certifications éditables lorsque leur modèle le permet.
- Gestion des sessions.
- Export des données.
- Suppression du compte avec confirmation.
- Gestion des paramètres propres aux organisations et investisseurs.

## 8. INTÉGRATION BACKEND ET BASE DE DONNÉES

Ne crée pas des interfaces simplement visuelles.

Chaque formulaire doit être connecté à une véritable API.

Avant toute création de nouvel endpoint :

1. Examiner les routes existantes.
2. Examiner les controllers.
3. Examiner les services.
4. Examiner les modèles et schémas de base de données.
5. Examiner les validations.
6. Examiner les permissions.
7. Réutiliser les fonctionnalités déjà disponibles.

API existantes à exploiter et à vérifier :
- `GET /me`
- `PATCH /me`
- `GET /me/permissions`
- `POST /me/password`
- `GET /organizations`
- `GET /organizations/:id`
- `PATCH /organizations/:id`
- `GET /investors/me`
- `PUT /investors/me`
- `GET /notifications/preferences`
- `PUT /notifications/preferences`
- Routes `/auth/mfa/*`

Pour les fonctionnalités absentes, développer les endpoints nécessaires et leurs validations.

Ne modifie pas arbitrairement les modèles existants et ne perds aucune donnée déjà enregistrée.

Il faut notamment garantir :
- La séparation des données individuelles et organisationnelles.
- Le contrôle des permissions.
- La validation des formulaires.
- La persistance réelle des modifications.
- La synchronisation Web/Mobile.
- La mise à jour correcte des données après sauvegarde.

Aucun faux bouton, aucune fausse sauvegarde, aucune donnée fictive et aucun formulaire non connecté ne sont acceptés.

## 9. HARMONISATION WEB ET MOBILE

Les deux applications doivent offrir les mêmes fonctionnalités essentielles, tout en conservant une interface adaptée à chaque support.

Je veux :
- Une architecture cohérente.
- Les mêmes informations métier.
- Les mêmes règles de validation.
- Les mêmes permissions.
- Les mêmes possibilités de modification.
- Les mêmes statuts de vérification.
- Les mêmes résultats après sauvegarde.

Le Web doit être optimisé pour une utilisation professionnelle sur ordinateur.

Le Mobile doit être optimisé pour les smartphones, avec des formulaires ergonomiques, une navigation simple et une excellente gestion du clavier.

Il ne faut pas simplement copier les composants Web dans Mobile.

## 10. MÉTHODE DE TRAVAIL OBLIGATOIRE

Travaille en quatre phases.

### PHASE 1 — CORRECTIONS CRITIQUES

- Corriger les boutons Save.
- Corriger les mutations de notifications.
- Corriger la persistance de la langue.
- Corriger l'accès MFA.
- Corriger les routes et liens.
- Vérifier le fonctionnement des paramètres existants.

### PHASE 2 — RESTRUCTURATION DES PROFILS

- Séparer profil individuel et profil organisation.
- Développer le profil professionnel indépendant.
- Compléter FARMER.
- Compléter INVESTMENT.
- Développer ORGANIZATION.
- Harmoniser les profils publics et privés.
- Corriger les doublons.

### PHASE 3 — IMPLÉMENTATION DES SETTINGS

- Créer les paramètres Organisation.
- Créer les paramètres Investissement.
- Adapter les paramètres du professionnel indépendant.
- Développer les formulaires de sécurité.
- Ajouter les fonctionnalités de confidentialité.
- Connecter toutes les interfaces au Backend.

### PHASE 4 — TESTS ET VALIDATION

Effectuer des tests réels sur :

- Web.
- Mobile.
- Backend.
- Base de données.
- Routes.
- Liens internes.
- Permissions.
- Sauvegardes.
- Rechargement des données.
- Synchronisation entre appareils.

Tester au minimum les différents rôles et les droits d'accès.

Un agriculteur ne doit pas pouvoir accéder aux paramètres privés d'une organisation sans autorisation.

Un membre d'organisation ne doit pas pouvoir modifier les informations réservées à son administrateur.

Vérifier également les erreurs réseau, les états de chargement, les messages de confirmation et les erreurs de validation.

## 11. CONTRAINTES IMPORTANTES

- Ne détruis aucune fonctionnalité existante qui fonctionne.
- Ne supprime aucune donnée utilisateur.
- Ne crée pas de doublons supplémentaires.
- Ne remplace pas les API existantes sans justification.
- Ne crée pas de fausses fonctionnalités.
- Ne laisse aucun bouton sans action.
- Ne laisse aucune route sans destination valide.
- Ne contourne jamais les permissions du Backend.
- Ne casse pas les autres modules de l'application.
- Respecte les conventions et technologies déjà utilisées dans le projet.
- Préserve la compatibilité avec les anciennes routes lorsque nécessaire.

Si une fonctionnalité nécessite une modification du Backend, réalise également cette modification. Ne laisse pas une interface attendre une API inexistante.

Si une fonctionnalité ne peut pas être finalisée faute de décision métier ou de dépendance externe, documente précisément le blocage au lieu de simuler son fonctionnement.

## 12. CRITÈRES DE LIVRAISON

À la fin, je veux recevoir :

1. Un rapport des problèmes corrigés.
2. La liste des fonctionnalités réellement implémentées.
3. La liste des nouvelles routes créées.
4. La liste des anciennes routes redirigées ou conservées.
5. La liste des API créées ou modifiées.
6. Les modifications apportées à la base de données.
7. Les tests effectués et leurs résultats.
8. Les éventuels problèmes encore non résolus.
9. La confirmation du fonctionnement sur Web et Mobile.

Ne déclare pas une fonctionnalité terminée simplement parce que son interface est visible. Elle doit être fonctionnelle, connectée au Backend et testée.

# INSTRUCTION FINALE

Je veux une réalisation professionnelle, complète et durable d'AgriKonnect Africa.

La distinction entre un professionnel indépendant, un agriculteur, un investisseur et une organisation ou entreprise doit être respectée dans toute l'architecture.

Chaque profil doit refléter la véritable identité de son propriétaire. Chaque espace Settings doit correspondre au bon compte. Chaque route doit conduire à la bonne page.

**Commence par analyser les trois rapports et le code réel du projet. Ensuite, établis un plan d'exécution précis et passe directement à l'implémentation. Ne t'arrête pas à l'audit, aux recommandations ou à la création de maquettes.**

Je demande des corrections réelles, une intégration complète et des tests de fonctionnement avant toute déclaration de livraison.

L'objectif final est d'obtenir des modules PROFILE et SETTINGS de niveau professionnel, cohérents, sécurisés, complets et parfaitement intégrés à l'ensemble d'AgriKonnect Africa.