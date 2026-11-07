import crypto from 'node:crypto';
import path from 'node:path';

import { env } from '../config/env.js';
import { StockageInterdit } from './storage.js';

/**
 * Pilote de stockage objet **compatible S3**, sans dépendance.
 *
 * ## Pourquoi ne pas installer le SDK AWS
 *
 * Le SDK pèse plusieurs dizaines de mégaoctets et des centaines de modules pour
 * cinq opérations. La signature SigV4 est une spécification publique et stable ;
 * l'implémenter avec `node:crypto` tient en moins de cent lignes et ne ajoute
 * rien à la chaîne d'approvisionnement. Ce choix est assumé et testé contre un
 * serveur qui vérifie la signature.
 *
 * ## Compatible avec quoi
 *
 * Tout service parlant l'API S3 : AWS S3, MinIO, Cloudflare R2, Scaleway
 * Object Storage, Wasabi, OVH, et le endpoint S3 de Supabase Storage.
 * L'`endpoint` est configurable, donc rien n'attache ce pilote à AWS.
 *
 * ## Ce que ce pilote apporte de plus que le pilote Supabase Storage
 *
 * La **lecture partielle** : S3 accepte un en-tête `Range`, ce qui permet de
 * lire les 3 256 premiers octets d'un fichier de 64 Mo sans le télécharger
 * entier. Le pilote Supabase Storage télécharge tout puis tronque — coûteux
 * exactement là où la vérification d'en-tête doit être bon marché.
 */

const SERVICE = 's3';
const ALGORITHME = 'AWS4-HMAC-SHA256';

const hmac = (cle, donnees) => crypto.createHmac('sha256', cle).update(donnees).digest();
const sha256Hex = (donnees) => crypto.createHash('sha256').update(donnees).digest('hex');

/** Date au format SigV4 : `20261028T210000Z`. */
const dateAmz = (date) => date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
/** Jour au format SigV4 : `20261028`. */
const jourAmz = (date) => dateAmz(date).slice(0, 8);

/**
 * Encode un segment de chemin selon la RFC 3986.
 *
 * S3 signe le chemin **encodé**, et n'encode pas `/`. `encodeURIComponent`
 * encode `/` en `%2F` et laisserait `%2F` là où S3 attend `/` : la signature ne
 * correspondrait plus. C'est l'erreur classique de toute implémentation maison.
 */
const encoderChemin = (valeur) =>
  valeur
    .split('/')
    .map((segment) =>
      encodeURIComponent(segment).replace(
        /[!'()*]/g,
        (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
      ))
    .join('/');

/** Encode une valeur de paramètre de requête, espaces en `%20`. */
const encoderValeur = (valeur) =>
  encodeURIComponent(valeur).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);

/**
 * Calcule la chaîne de requête canonique : clés triées, puis valeurs.
 *
 * Le tri se fait sur le nom **encodé**, comme l'exige la spécification. Trier
 * après encodage et avant encodage ne donnent pas le même ordre dès qu'une clé
 * contient un caractère réservé.
 */
const requeteCanonique = (parametres) => {
  const paires = Object.entries(parametres ?? {})
    .filter(([, valeur]) => valeur !== undefined && valeur !== null)
    .map(([cle, valeur]) => [encoderValeur(cle), encoderValeur(String(valeur))])
    .sort((a, b) => (a[0] === b[0] ? a[1].localeCompare(b[1]) : a[0].localeCompare(b[0])));
  return paires.map(([cle, valeur]) => `${cle}=${valeur}`).join('&');
};

/**
 * Signe une requête S3 et renvoie ses en-têtes d'autorisation.
 *
 * @returns {{ authorization: string, amzDate: string, amzContentSha256: string }}
 */
export const signerRequete = ({
  methode,
  hote,
  chemin,
  parametres = {},
  entetes = {},
  corps = Buffer.alloc(0),
  region,
  cleAcces,
  cleSecrete,
  date = new Date(),
  /*
   * Paramétrable — et non figé à `s3` — pour deux raisons : le jeu de tests
   * officiel AWS signe avec le service `service`, et sans ce paramètre il est
   * impossible de vérifier l'algorithme contre un vecteur publié. En production
   * l'appelant ne le passe pas.
   */
  service = SERVICE,
  /*
   * S3 exige l'en-tête `x-amz-content-sha256` et le signe. Le profil générique
   * du jeu de tests AWS, lui, ne le porte pas. Le rendre optionnel permet de
   * vérifier l'algorithme contre un vecteur publié ; en S3 il reste actif.
   */
  signerEmpreinteCorps = true,
}) => {
  const amzDate = dateAmz(date);
  const empreinteCorps = sha256Hex(corps ?? Buffer.alloc(0));

  const tousEntetes = {
    host: hote,
    ...(signerEmpreinteCorps ? { 'x-amz-content-sha256': empreinteCorps } : {}),
    'x-amz-date': amzDate,
    ...Object.fromEntries(
      Object.entries(entetes ?? {}).map(([cle, valeur]) => [cle.toLowerCase(), String(valeur).trim()]),
    ),
  };

  const nomsSignes = Object.keys(tousEntetes).sort();
  const entetesCanoniques = nomsSignes
    .map((nom) => `${nom}:${tousEntetes[nom]}\n`)
    .join('');

  const canonique = [
    methode.toUpperCase(),
    encoderChemin(chemin),
    requeteCanonique(parametres),
    entetesCanoniques,
    nomsSignes.join(';'),
    empreinteCorps,
  ].join('\n');

  const portee = `${jourAmz(date)}/${region}/${service}/aws4_request`;
  const aSigner = [ALGORITHME, amzDate, portee, sha256Hex(canonique)].join('\n');

  const cleDate = hmac(`AWS4${cleSecrete}`, jourAmz(date));
  const cleRegion = hmac(cleDate, region);
  const cleService = hmac(cleRegion, service);
  const cleSignature = hmac(cleService, 'aws4_request');
  const signature = crypto.createHmac('sha256', cleSignature).update(aSigner).digest('hex');

  return {
    authorization:
      `${ALGORITHME} Credential=${cleAcces}/${portee}, `
      + `SignedHeaders=${nomsSignes.join(';')}, Signature=${signature}`,
    amzDate,
    amzContentSha256: empreinteCorps,
    entetesSignes: tousEntetes,
  };
};

/**
 * Construit l'URL et l'hôte selon le style d'adressage.
 *
 * `path-style` (`https://hote/panier/cle`) est ce qu'attendent MinIO et la
 * plupart des serveurs auto-hébergés ; `virtual-host`
 * (`https://panier.hote/cle`) est le comportement AWS par défaut. Le mauvais
 * style ne produit pas une erreur explicite : il signe un autre hôte, donc un
 * `SignatureDoesNotMatch`. C'est pourquoi le style est configurable.
 */
const construireCible = ({ endpoint, panier, cle, styleChemin }) => {
  const url = new URL(endpoint);
  if (styleChemin) {
    const base = url.pathname.replace(/\/$/, '');
    return {
      hote: url.host,
      chemin: `${base}/${panier}/${cle}`,
      url: `${url.origin}${base}/${panier}/${encoderChemin(cle)}`,
    };
  }
  return {
    hote: `${panier}.${url.host}`,
    chemin: `/${cle}`,
    // La barre oblique initiale est explicite : `encoderChemin` n'en ajoute pas,
    // et son absence collerait la clé à l'hôte (`hote.comcle.tif`).
    url: `${url.protocol}//${panier}.${url.host}/${encoderChemin(cle)}`,
  };
};

/**
 * Pilote objet compatible S3.
 *
 * Même contrat que les pilotes de `storage.js` : `ecrire`, `lire`,
 * `lireEnTete`, `existe`, `supprimer`. Il est interchangeable avec le pilote
 * local sans changer un appelant.
 */
export const creerStockageS3 = ({
  endpoint,
  region,
  panier,
  cleAcces,
  cleSecrete,
  styleChemin = true,
  fetchImpl = fetch,
} = {}) => {
  const configuration = {
    endpoint: endpoint ?? env.S3_ENDPOINT,
    region: region ?? env.S3_REGION,
    panier: panier ?? env.S3_BUCKET,
    cleAcces: cleAcces ?? env.S3_ACCESS_KEY_ID,
    cleSecrete: cleSecrete ?? env.S3_SECRET_ACCESS_KEY,
    styleChemin: styleChemin ?? env.S3_PATH_STYLE !== 'false',
  };

  for (const [nom, valeur] of Object.entries(configuration)) {
    if (nom === 'styleChemin') continue;
    if (!valeur) {
      throw new StockageInterdit(
        `Configuration S3 incomplète : « ${nom} » est absent. `
        + 'Renseignez S3_ENDPOINT, S3_REGION, S3_BUCKET, S3_ACCESS_KEY_ID et S3_SECRET_ACCESS_KEY.',
      );
    }
  }

  const envoyer = async (cle, { methode, corps, parametres, entetes } = {}) => {
    const cible = construireCible({ ...configuration, cle });
    const signe = signerRequete({
      methode,
      hote: cible.hote,
      chemin: cible.chemin,
      parametres,
      entetes,
      corps: corps ?? Buffer.alloc(0),
      region: configuration.region,
      cleAcces: configuration.cleAcces,
      cleSecrete: configuration.cleSecrete,
    });

    const url = new URL(cible.url);
    for (const [cleParam, valeur] of Object.entries(parametres ?? {})) {
      if (valeur !== undefined && valeur !== null) url.searchParams.set(cleParam, String(valeur));
    }

    /*
     * Les secrets ne sont jamais journalisés : l'en-tête `authorization`
     * contient la clé d'accès et la signature. Seuls la méthode, le statut et
     * la clé sont tracés, et seulement en cas d'échec.
     */
    const reponse = await fetchImpl(url.toString(), {
      method: methode,
      headers: {
        ...signe.entetesSignes,
        authorization: signe.authorization,
        ...(entetes ?? {}),
      },
      body: corps && methode !== 'HEAD' && methode !== 'GET' ? corps : undefined,
    });

    if (!reponse.ok && reponse.status !== 404) {
      const texte = await reponse.text().catch(() => '');
      // Le corps d'erreur S3 peut reprendre la clé d'accès : on ne garde que
      // le code d'erreur, jamais le corps brut.
      const code = /<Code>([^<]+)<\/Code>/.exec(texte)?.[1];
      throw new Error(
        `Stockage S3 — ${methode} ${cle} : HTTP ${reponse.status}`
        + `${code ? ` (${code})` : ''}`,
      );
    }
    return reponse;
  };

  return {
    pilote: 's3',
    panier: configuration.panier,
    region: configuration.region,
    endpoint: configuration.endpoint,

    async ecrire(cle, tampon) {
      await envoyer(cle, {
        methode: 'PUT',
        corps: tampon,
        entetes: { 'content-type': 'application/octet-stream' },
      });
      return { cle, taille: tampon.length };
    },

    async lire(cle) {
      const reponse = await envoyer(cle, { methode: 'GET' });
      if (reponse.status === 404) throw new Error(`Stockage S3 — objet absent : ${cle}`);
      return Buffer.from(await reponse.arrayBuffer());
    },

    /**
     * Lecture partielle par en-tête `Range`.
     *
     * S3 renvoie `206 Partial Content` ; un serveur qui ignore `Range` renvoie
     * `200` avec tout le corps, ce qui reste correct — seulement plus coûteux.
     */
    async lireEnTete(cle, nombre) {
      const reponse = await envoyer(cle, {
        methode: 'GET',
        entetes: { range: `bytes=0-${Math.max(0, nombre - 1)}` },
      });
      if (reponse.status === 404) throw new Error(`Stockage S3 — objet absent : ${cle}`);
      const tampon = Buffer.from(await reponse.arrayBuffer());
      return tampon.subarray(0, Math.min(nombre, tampon.length));
    },

    async existe(cle) {
      const reponse = await envoyer(cle, { methode: 'HEAD' });
      return reponse.status !== 404;
    },

    async supprimer(cle) {
      await envoyer(cle, { methode: 'DELETE' });
    },
  };
};

/** Chemin de stockage relatif, sans panier : utile aux tests et à l'audit. */
export const cheminRelatif = (cle) => path.posix.normalize(`/${cle}`).replace(/^\//, '');
