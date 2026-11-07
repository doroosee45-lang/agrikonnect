/**
 * État des services externes au démarrage.
 *
 * ## Pourquoi
 *
 * L'application démarre **sans aucun service externe configuré** : SMS et
 * e-mail tombent sur leur fournisseur `console`, le satellite sur `simulated`,
 * le dépôt géospatial sur le disque local. C'est voulu pour le développement
 * local, mais c'est aussi exactement la configuration qui, en production, ferait
 * tourner une plateforme qui n'envoie rien à personne.
 *
 * Un `logger.info` noyé dans les lignes de démarrage ne suffit pas : ce module
 * produit une **liste explicite** que `server.js` affiche en avertissement, et
 * que `scripts/check-startup-report.mjs` peut relire.
 *
 * ## Règle de fond
 *
 * Chaque finding indique ce qui **ne fonctionnera pas**, pas seulement ce qui
 * est « en mode démo ». « SMS en console » ne dit rien à un exploitant ;
 * « aucune alerte SMS ne sera délivrée » lui dit ce qu'il perd.
 */

/**
 * @typedef {object} Finding
 * @property {string} service — nom court (`sms`, `email`, …).
 * @property {'degrade'|'incomplet'|'ok'} niveau
 * @property {string} mode — valeur réellement en vigueur.
 * @property {string} consequence — ce qui ne marche pas dans cet état.
 * @property {string} [pourRetablir] — variable(s) à renseigner.
 */

/**
 * Évalue l'état des services à partir d'une configuration **déjà résolue**.
 *
 * Prendre un objet plutôt que `env` directement rend la fonction testable sans
 * charger `config/env.js` — qui valide l'environnement et lèverait sur une
 * configuration incomplète, précisément le cas qu'on veut décrire.
 *
 * @param {object} cfg
 * @returns {Finding[]}
 */
export const evaluerServicesExternes = (cfg) => {
  const findings = [];
  const estProd = cfg.NODE_ENV === 'production';

  /* ── SMS ────────────────────────────────────────────────────── */
  const smsProvider = cfg.SMS_PROVIDER ?? 'console';
  if (smsProvider === 'console') {
    findings.push({
      service: 'sms',
      niveau: 'degrade',
      mode: 'console',
      consequence:
        'Aucun SMS ne part. Les messages sont écrits dans les journaux du backend '
        + '(préfixe `[SMS:console]`) : les alertes de seuil et les codes OTP ne sont '
        + 'pas délivrés aux agriculteurs.',
      pourRetablir:
        "SMS_PROVIDER=twilio + TWILIO_ACCOUNT_SID + TWILIO_AUTH_TOKEN + TWILIO_SENDER_ID "
        + '(voir docs/SMS-TWILIO.md — l’envoi réel en RDC n’a jamais été exécuté ici)',
    });
  } else if (smsProvider === 'twilio' && !(cfg.TWILIO_ACCOUNT_SID && cfg.TWILIO_AUTH_TOKEN)) {
    findings.push({
      service: 'sms',
      niveau: 'incomplet',
      mode: 'twilio sans identifiants',
      consequence:
        'Le fournisseur est twilio mais les identifiants manquent : chaque envoi échouera '
        + 'et sera enregistré en `FAILED` plutôt que délivré.',
      pourRetablir: 'TWILIO_ACCOUNT_SID et TWILIO_AUTH_TOKEN',
    });
  } else {
    findings.push({ service: 'sms', niveau: 'ok', mode: smsProvider, consequence: 'Envoi réel actif.' });
  }

  /* ── E-mail ─────────────────────────────────────────────────── */
  const emailProvider = cfg.EMAIL_PROVIDER ?? 'console';
  if (emailProvider === 'console') {
    findings.push({
      service: 'email',
      niveau: 'degrade',
      mode: 'console',
      consequence:
        'Aucun e-mail ne part. Les liens de vérification d’adresse et de réinitialisation '
        + 'de mot de passe sont écrits dans les journaux (préfixe `[EMAIL:console]`) : '
        + 'l’inscription par e-mail ne peut pas aboutir sans lire ces journaux.',
      pourRetablir: 'EMAIL_PROVIDER=resend (ou sendgrid) + EMAIL_API_KEY + EMAIL_FROM',
    });
  } else if (emailProvider !== 'webhook' && !cfg.EMAIL_API_KEY) {
    findings.push({
      service: 'email',
      niveau: 'incomplet',
      mode: `${emailProvider} sans clé`,
      consequence: 'Le fournisseur est configuré mais la clé manque : les envois échoueront.',
      pourRetablir: 'EMAIL_API_KEY',
    });
  } else {
    findings.push({ service: 'email', niveau: 'ok', mode: emailProvider, consequence: 'Envoi réel actif.' });
  }

  /* ── Satellite ──────────────────────────────────────────────── */
  const satProvider = cfg.SATELLITE_PROVIDER ?? 'simulated';
  if (satProvider === 'simulated') {
    findings.push({
      service: 'satellite',
      niveau: 'degrade',
      mode: 'simulated',
      consequence:
        'Les indices satellitaires (humidité Sentinel-1, végétation) sont GÉNÉRÉS, pas '
        + 'acquis. Toute carte ou analyse qui en dépend reflète une simulation.',
      pourRetablir: 'SATELLITE_PROVIDER=sentinelhub + SATELLITE_API_URL + SATELLITE_API_KEY',
    });
  } else if (!cfg.SATELLITE_API_KEY) {
    findings.push({
      service: 'satellite',
      niveau: 'incomplet',
      mode: `${satProvider} sans clé`,
      consequence: 'Les acquisitions échoueront ; les données resteront celles du dernier cache.',
      pourRetablir: 'SATELLITE_API_KEY',
    });
  } else {
    findings.push({ service: 'satellite', niveau: 'ok', mode: satProvider, consequence: 'Acquisition réelle active.' });
  }

  /* ── Matériel / capteurs ────────────────────────────────────── */
  if (cfg.simulationAllowed !== false && cfg.hardwareMode !== 'REAL') {
    findings.push({
      service: 'capteurs',
      niveau: 'degrade',
      mode: cfg.hardwareMode ?? 'SIMULATION',
      consequence:
        'Les mesures de capteurs peuvent être simulées. Elles sont marquées comme telles en '
        + 'base, mais un tableau de bord lu sans cette distinction mélange réel et généré.',
      pourRetablir: 'SIMULATION_ENABLED=false et mode REAL dans config/hardware.js',
    });
  }

  /* ── Dépôt géospatial ───────────────────────────────────────── */
  if ((cfg.GEOSPATIAL_STORAGE_DRIVER ?? 'local') === 'local') {
    findings.push({
      service: 'geospatial',
      niveau: estProd ? 'incomplet' : 'degrade',
      mode: `local (${cfg.GEOSPATIAL_STORAGE_DIR ?? 'storage/'})`,
      consequence:
        'Les fichiers déposés sont écrits sur le disque du backend. Ils ne survivent pas à un '
        + 'redéploiement éphémère et ne sont partagés entre aucune instance.',
      pourRetablir: 'GEOSPATIAL_STORAGE_DRIVER=object + GEOSPATIAL_BUCKET',
    });
  }

  /* ── Supabase ───────────────────────────────────────────────── */
  if (!cfg.SUPABASE_SERVICE_ROLE_KEY) {
    findings.push({
      service: 'auth',
      niveau: 'incomplet',
      mode: 'clé service absente',
      consequence:
        'L’inscription et toute opération d’administration échoueront : la création de compte '
        + 'passe par `supabaseAdmin.auth.admin.createUser`, qui exige la clé de service. '
        + 'Le script de démonstration ne pourra pas créer ses deux comptes.',
      pourRetablir: 'SUPABASE_SERVICE_ROLE_KEY',
    });
  }

  /* ── MFA ────────────────────────────────────────────────────── */
  if (cfg.mfaKeyFournie === false) {
    findings.push({
      service: 'mfa',
      niveau: estProd ? 'incomplet' : 'degrade',
      mode: 'clé de développement dérivée',
      consequence:
        'Les secrets TOTP sont chiffrés avec une clé dérivée d’une valeur connue du dépôt : '
        + 'quiconque lit la base peut les déchiffrer. Inacceptable hors développement.',
      pourRetablir: 'MFA_ENCRYPTION_KEY (32 octets, aléatoire)',
    });
  }

  /* ── Moteur Python (geoai) ──────────────────────────────────── */
  findings.push({
    service: 'geoai',
    niveau: 'ok',
    mode: cfg.GEOAI_URL ?? 'http://127.0.0.1:8100',
    consequence:
      'URL configurée. **Sa joignabilité n’est pas testée au démarrage** : les analyses '
      + 'géospatiales échoueront à l’appel si le service Python n’est pas lancé.',
    pourRetablir: 'python3 geoai/server.py (port 8100 par défaut)',
  });

  return findings;
};

/**
 * Formate les findings pour les journaux.
 *
 * Les findings `ok` ne sont listés qu'en mode verbeux : au démarrage d'un
 * poste de développement, ce qui compte est ce qui **ne marche pas**.
 */
export const formaterRapport = (findings, { verbeux = false } = {}) => {
  const aSignaler = findings.filter((f) => f.niveau !== 'ok' || verbeux);
  if (aSignaler.length === 0) return null;

  const lignes = [
    '',
    '┌──────────────────────────────────────────────────────────────┐',
    '│  ÉTAT DES SERVICES EXTERNES AU DÉMARRAGE                     │',
    '└──────────────────────────────────────────────────────────────┘',
  ];
  for (const f of aSignaler) {
    const marque = f.niveau === 'ok' ? '✓' : f.niveau === 'degrade' ? '⚠' : '✗';
    lignes.push(`  ${marque} ${f.service} — ${f.mode}`);
    lignes.push(`      ${f.consequence}`);
    if (f.pourRetablir && f.niveau !== 'ok') lignes.push(`      → ${f.pourRetablir}`);
  }
  const degrades = findings.filter((f) => f.niveau !== 'ok').length;
  if (degrades > 0) {
    lignes.push('');
    lignes.push(
      `  ${degrades} service(s) en mode dégradé ou incomplet. `
      + 'Ces fonctionnalités ne produiront aucun effet réel.',
    );
  }
  lignes.push('');
  return lignes.join('\n');
};
