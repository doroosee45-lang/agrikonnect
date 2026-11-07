#!/usr/bin/env node
/**
 * Données de démonstration — **toutes fictives**.
 *
 *   node scripts/seed-demo.mjs [--base-url http://localhost:4000/api/v1] [--force]
 *
 * ## Ce que ce script crée
 *
 *   • un compte **agriculteur** ;
 *   • un compte **agronome** ;
 *   • une ferme et une parcelle fictives ;
 *   • une analyse de sol fictive, pour que l'écran de recommandations ait de
 *     quoi calculer.
 *
 * ## Ce que ce script ne fait PAS
 *
 * Il ne crée **aucune plage agronomique validée**. Les plages proviennent
 * uniquement de la route de validation explicite, réservée à l'agronome. Sans
 * formulaire rempli, toutes les plages restent `PROVISIONAL` et toute
 * recommandation est donc **indicative** — c'est l'état réel, pas un manque du
 * script.
 *
 * Il n'ajoute rien au seed de référentiels (`npm run seed`) : pays, cultures et
 * unités restent des données publiques vérifiables, et ce script ne les touche
 * pas.
 *
 * ## Prérequis
 *
 * Le backend doit tourner **et** Supabase être joignable : la création d'un
 * compte passe par `POST /auth/register`, qui appelle
 * `supabaseAdmin.auth.admin.createUser`. Sans `SUPABASE_SERVICE_ROLE_KEY`, le
 * script échoue en le disant, plutôt que de créer des profils orphelins
 * incapables de se connecter.
 *
 * ## Idempotence
 *
 * Un compte existant n'est pas dupliqué : le conflit (409) bascule sur une
 * connexion. `--force` ne supprime rien, il recrée seulement la parcelle et
 * l'analyse.
 */
import process from 'node:process';
import { pathToFileURL } from 'node:url';

const args = process.argv.slice(2);
const argDe = (nom, defaut) => {
  const i = args.indexOf(`--${nom}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : defaut;
};

const BASE_URL = argDe('base-url', process.env.API_BASE_URL ?? 'http://localhost:4000/api/v1');
const ATTENTE_MAX_S = Number(argDe('attente', '60'));

/*
 * ── Données fictives ──────────────────────────────────────────────
 *
 * Le domaine `.test` est réservé (RFC 6761) : il ne résout jamais. Aucun de ces
 * comptes ne peut recevoir de message réel, et aucune de ces coordonnées ne
 * désigne une exploitation existante.
 */
const MOT_DE_PASSE = 'Demonstration!2026';

const COMPTES = [
  {
    role: 'agriculteur',
    accountType: 'FARMER',
    firstName: 'Josué',
    lastName: 'Mbala',
    email: 'agriculteur.demo@agrikonnect.test',
  },
  {
    role: 'agronome',
    accountType: 'AGRONOMIST',
    firstName: 'Naomi',
    lastName: 'Kalala',
    email: 'agronome.demo@agrikonnect.test',
  },
];

/**
 * Ferme fictive.
 *
 * L'inscription crée une **organisation**, pas une ferme : la ferme est une
 * exploitation rattachée à l'organisation, et c'est à elle que les parcelles se
 * rattachent. Le script la crée donc, ou réutilise celle qui existe déjà.
 */
const FERME = {
  name: 'Ferme de démonstration (fictive)',
  description:
    'Exploitation FICTIVE créée par scripts/seed-demo.mjs. Ne correspond à aucune '
    + 'exploitation réelle. À supprimer avant tout usage sérieux.',
  countryCode: 'CD',
  /*
   * **Équateur, pas Kongo-Central.**
   *
   * Le moteur refuse toute recommandation hors des provinces qui ont un
   * calendrier cultural : `Aucun calendrier cultural pour la province
   * « Kongo-Central ». Provinces couvertes : Equateur, Bandundu.` Une ferme de
   * démonstration placée ailleurs produirait un écran vide, et on conclurait à
   * tort que les recommandations sont cassées.
   *
   * Ces calendriers restent **provisoires** : ils ne sont pas validés, et les
   * recommandations qui en découlent sont indicatives.
   */
  province: 'Equateur',
  territory: 'Territoire de démonstration',
  village: 'Village de démonstration',
  totalAreaHa: 12.5,
  /*
   * `visibility` est un **objet** par canal (`{ phone, email, whatsapp }`), pas
   * une chaîne : passer `'PRIVATE'` donne 422 « Expected object, received
   * string ». Tout en privé — une ferme de démonstration n'a pas à être
   * découvrable.
   */
  visibility: { phone: 'private', email: 'private', whatsapp: 'private' },
};

/**
 * Parcelle fictive : un carré d'environ 2 ha dans la région de Mbandaka.
 *
 * Coordonnées choisies pour tomber dans une zone agricole plausible de la
 * province de l'Équateur — la seule, avec le Bandundu, à disposer d'un
 * calendrier cultural — **sans** correspondre à une parcelle cadastrée réelle.
 */
const PARCELLE = {
  name: 'Parcelle de démonstration (fictive)',
  areaHa: 2.1,
  status: 'FALLOW',
  geometry: {
    type: 'Polygon',
    coordinates: [
      [
        [18.2600, 0.0480],
        [18.2615, 0.0480],
        [18.2615, 0.0495],
        [18.2600, 0.0495],
        [18.2600, 0.0480],
      ],
    ],
  },
};

/**
 * Analyse de sol fictive.
 *
 * `source: 'declared'` : ces valeurs sont **déclarées pour la démonstration**,
 * ni mesurées en laboratoire ni issues d'un capteur. Le moteur les traite comme
 * telles, et la provenance reste visible dans la décomposition.
 */
const ANALYSE_SOL = {
  assessedAt: new Date().toISOString(),
  notes:
    'Analyse FICTIVE créée par scripts/seed-demo.mjs pour illustrer les écrans. '
    + 'Aucune mesure de terrain : valeurs déclarées, à remplacer par une vraie analyse.',
  parameters: [
    { key: 'ph', value: '6,1', numericValue: 6.1, unit: 'pH', source: 'declared' },
    { key: 'organicMatter', value: '2,4', numericValue: 2.4, unit: '%', source: 'declared' },
    { key: 'texture', value: 'limono-argileux', source: 'declared' },
    { key: 'n', value: '18', numericValue: 18, unit: 'mg/kg', source: 'declared' },
    { key: 'p', value: '7', numericValue: 7, unit: 'mg/kg', source: 'declared' },
    { key: 'k', value: '142', numericValue: 142, unit: 'mg/kg', source: 'declared' },
  ],
};

/* ─────────────────────────── outillage HTTP ─────────────────────────── */

const attendre = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const appel = async (methode, chemin, { jeton, corps } = {}, baseUrl = BASE_URL) => {
  const reponse = await fetch(`${baseUrl}${chemin}`, {
    method: methode,
    headers: {
      'content-type': 'application/json',
      ...(jeton ? { authorization: `Bearer ${jeton}` } : {}),
    },
    body: corps === undefined ? undefined : JSON.stringify(corps),
  });
  let payload = null;
  try {
    payload = await reponse.json();
  } catch {
    /* corps non JSON : le statut suffit */
  }
  return { status: reponse.status, body: payload };
};

/** Attend que `/health` réponde, avec un compte à rebours lisible. */
const attendreLeBackend = async (baseUrl = BASE_URL) => {
  const debut = Date.now();
  let dernierErreur = null;
  while (Date.now() - debut < ATTENTE_MAX_S * 1000) {
    try {
      const reponse = await fetch(`${baseUrl}/health`);
      if (reponse.ok) return true;
      dernierErreur = `statut ${reponse.status}`;
    } catch (erreur) {
      dernierErreur = erreur.cause?.code ?? erreur.message;
    }
    process.stdout.write('.');
    await attendre(1000);
  }
  throw new Error(
    `le backend n'a pas répondu sur ${baseUrl}/health après ${ATTENTE_MAX_S} s (${dernierErreur}).\n`
    + 'Lancez-le d’abord : cd backend && npm run dev',
  );
};

/* ─────────────────────────── déroulé ─────────────────────────── */

const banner = () => {
  console.log('');
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║  DONNÉES DE DÉMONSTRATION — TOUTES FICTIVES                  ║');
  console.log('║  Aucune mesure réelle, aucune parcelle cadastrée, aucun      ║');
  console.log('║  destinataire joignable. Ne pas utiliser en production.      ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log('');
  console.log(`  API : ${BASE_URL}`);
  console.log('');
};

const creerOuRejoindre = async (compte, baseUrl = BASE_URL) => {
  const inscrit = await appel(
    'POST',
    '/auth/register',
    { corps: { ...compte, password: MOT_DE_PASSE, countryCode: 'CD', locale: 'fr' } },
    baseUrl,
  );

  if (inscrit.status === 201 || inscrit.status === 200) {
    const session = inscrit.body?.data?.session;
    return { compte, jeton: session?.accessToken ?? null, cree: true, session };
  }

  if (inscrit.status === 409) {
    // Compte déjà présent : on se connecte au lieu de le recréer.
    const connexion = await appel(
      'POST',
      '/auth/login',
      { corps: { identifier: compte.email, password: MOT_DE_PASSE } },
      baseUrl,
    );
    if (connexion.status !== 200) {
      throw new Error(
        `${compte.email} existe déjà mais la connexion échoue (${connexion.status}) : `
        + JSON.stringify(connexion.body?.message ?? connexion.body),
      );
    }
    return {
      compte,
      jeton: connexion.body?.data?.session?.accessToken ?? null,
      cree: false,
      organisationId: connexion.body?.data?.user?.organizationId ?? null,
    };
  }

  /*
   * 422 ici vient presque toujours d'une clé de service Supabase manquante :
   * `register` appelle `supabaseAdmin.auth.admin.createUser`. Le dire évite de
   * faire chercher du côté du script.
   */
  const detail = inscrit.body?.message ?? JSON.stringify(inscrit.body);
  if (inscrit.status === 422 || inscrit.status === 500) {
    throw new Error(
      `création de ${compte.email} impossible (${inscrit.status}) : ${detail}\n`
      + '  → vérifiez SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY dans backend/.env',
    );
  }
  throw new Error(`création de ${compte.email} refusée (${inscrit.status}) : ${detail}`);
};

/**
 * Déroulé complet, paramétrable.
 *
 * Exporté plutôt qu'exécuté à l'import : `tests/e2e/seedDemo.e2e.test.mjs` le
 * pilote contre le harnais e2e (PostgreSQL réel + stub GoTrue), ce qui prouve
 * que le script fonctionne au lieu de le supposer.
 *
 * @param {object} [options]
 * @param {string} [options.baseUrl] — origine de l'API, préfixe compris.
 * @param {(ligne: string) => void} [options.log] — sortie, pour capturer en test.
 * @returns {Promise<{ comptes: Array, parcelleId: string|null }>}
 */
export const executerDemo = async ({ baseUrl = BASE_URL, log = console.log } = {}) => {
  const dire = (ligne) => log(ligne);

  dire(`  Attente du backend sur ${baseUrl}/health`);
  await attendreLeBackend(baseUrl);
  dire('  Backend joignable.');
  dire('');

  const sessions = [];
  for (const compte of COMPTES) {
    const resultat = await creerOuRejoindre(compte, baseUrl);
    sessions.push(resultat);
    dire(
      `  ${resultat.cree ? '+' : '='} compte ${resultat.compte.role.padEnd(12)} `
      + `${resultat.compte.email} ${resultat.cree ? '(créé)' : '(déjà présent)'}`,
    );
  }

  const agriculteur = sessions.find((s) => s.compte.role === 'agriculteur');
  if (!agriculteur?.jeton) {
    throw new Error('aucun jeton pour le compte agriculteur : impossible de créer la parcelle');
  }

  /*
   * L'inscription crée une **organisation**, pas une ferme. On réutilise la
   * première ferme existante (second passage du script), sinon on la crée.
   */
  const listeFermes = await appel('GET', '/farms', { jeton: agriculteur.jeton }, baseUrl);
  let ferme = listeFermes.body?.data?.items?.[0] ?? listeFermes.body?.data?.[0] ?? null;
  if (ferme?.id) {
    dire(`  = ferme                ${ferme.name ?? ferme.id} (déjà présente)`);
  } else {
    const creee = await appel('POST', '/farms', { jeton: agriculteur.jeton, corps: FERME }, baseUrl);
    if (creee.status !== 201 && creee.status !== 200) {
      throw new Error(
        `création de la ferme refusée (${creee.status}) : `
        + JSON.stringify(creee.body?.errors ?? creee.body?.message ?? creee.body),
      );
    }
    /*
     * `POST /farms` renvoie `{ farm, warnings }`, pas la ferme à plat. Lire
     * `data` directement donne un objet sans `id` et le script échoue en
     * croyant la création ratée.
     */
    ferme = creee.body?.data?.farm ?? null;
    if (!ferme?.id) throw new Error('la ferme créée ne porte aucun identifiant');
    dire(`  + ferme                ${FERME.name}`);
  }

  const parcelle = await appel(
    'POST',
    '/plots',
    { jeton: agriculteur.jeton, corps: { ...PARCELLE, farmId: ferme.id } },
    baseUrl,
  );
  if (parcelle.status !== 201 && parcelle.status !== 200) {
    throw new Error(
      `création de la parcelle refusée (${parcelle.status}) : `
      + JSON.stringify(parcelle.body?.errors ?? parcelle.body?.message ?? parcelle.body),
    );
  }
  const parcelleId = parcelle.body?.data?.id ?? parcelle.body?.data?.plot?.id ?? null;
  dire(`  + parcelle             ${PARCELLE.name} (${PARCELLE.areaHa} ha)`);

  let analyseOk = false;
  if (parcelleId) {
    const analyse = await appel(
      'POST',
      `/plots/${parcelleId}/soil-assessments`,
      { jeton: agriculteur.jeton, corps: ANALYSE_SOL },
      baseUrl,
    );
    if (analyse.status !== 201 && analyse.status !== 200) {
      /*
       * Une analyse refusée ne doit pas faire échouer tout le script : les
       * comptes et la parcelle existent, et l'écran de recommandations reste
       * atteignable (il affichera « données insuffisantes », ce qui est aussi
       * un état réel).
       */
      dire(
        `  ! analyse de sol refusée (${analyse.status}) : `
        + JSON.stringify(analyse.body?.errors ?? analyse.body?.message ?? analyse.body),
      );
      dire('    Les comptes et la parcelle sont créés ; les recommandations diront « données insuffisantes ».');
    } else {
      analyseOk = true;
      dire(`  + analyse de sol       ${ANALYSE_SOL.parameters.length} paramètres déclarés (fictifs)`);
    }
  }

  return { comptes: sessions, parcelleId, analyseOk };
};

const main = async () => {
  banner();

  const { comptes } = await executerDemo();

  console.log('');
  console.log('  ┌─ Identifiants de connexion ────────────────────────────────');
  for (const { compte } of comptes) {
    console.log(`  │  ${compte.role.padEnd(12)} ${compte.email}`);
    console.log(`  │  ${''.padEnd(12)} ${MOT_DE_PASSE}`);
  }
  console.log('  └────────────────────────────────────────────────────────────');
  console.log('');
  console.log('  ⚠ Ces identifiants sont publics et fictifs. Ne renseignez jamais');
  console.log('    de donnée réelle sur un compte de démonstration.');
  console.log('');
  console.log('  Les recommandations calculées sur ces données seront INDICATIVES :');
  console.log('  aucune plage agronomique n’est validée tant que le formulaire');
  console.log('  agronome n’a pas été rempli.');
  console.log('');
};

/*
 * Exécution uniquement en ligne de commande.
 *
 * Sans cette garde, importer le module pour le tester lancerait aussitôt une
 * création de comptes contre `http://localhost:4000` — et le test ne prouverait
 * rien d'autre que son propre isolement.
 */
const lanceEnCli = Boolean(process.argv[1])
  && import.meta.url === pathToFileURL(process.argv[1]).href;
if (lanceEnCli) {
  main().catch((erreur) => {
    console.error('');
    console.error(`  ✗ Échec : ${erreur.message}`);
    console.error('');
    process.exit(1);
  });
}

export { COMPTES, FERME, PARCELLE, ANALYSE_SOL, MOT_DE_PASSE };
