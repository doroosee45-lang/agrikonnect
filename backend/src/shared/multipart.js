/**
 * Analyseur `multipart/form-data` sans dépendance.
 *
 * ## Pourquoi pas `multer`
 *
 * Le dépôt n'installe aucune dépendance de téléversement, et en ajouter une
 * pour un seul endpoint élargit la surface d'attaque et la chaîne
 * d'approvisionnement pour un besoin étroit : lire **un** fichier et quelques
 * champs texte. Ce module fait exactement cela, et rien d'autre.
 *
 * ## Ce qui est contrôlé pendant la lecture, pas après
 *
 * La limite de taille est appliquée **octet par octet pendant la lecture du
 * flux**, pas sur le tampon final. Un analyseur qui lit tout puis mesure
 * accepte d'abord 10 Go en mémoire avant de les refuser : le processus meurt
 * avant que la validation ne s'exécute. Ici la lecture s'arrête dès que le
 * plafond est franchi.
 *
 * ## Limites assumées
 *
 *  - Le fichier est mis en mémoire, pas écrit en flux sur disque. Pour 64 Mo
 *    c'est acceptable ; au-delà il faudrait un flux vers le stockage, ce que ce
 *    module ne fait pas. C'est dit plutôt que caché.
 *  - Les parties `filename*=` (RFC 5987, noms non-ASCII encodés) ne sont pas
 *    décodées : le nom est assaini par `assainirNom`, qui retire tout ce qui
 *    n'est pas lettre, chiffre, point, tiret ou souligné.
 */

/** Une partie du corps dépasse ce qui est attendu d'un formulaire. */
export class CorpsTropVolumineux extends Error {
  constructor(message) {
    super(message);
    this.name = 'CorpsTropVolumineux';
    this.statusCode = 413;
  }
}

/** Le corps n'est pas un `multipart/form-data` exploitable. */
export class MultipartInvalide extends Error {
  constructor(message) {
    super(message);
    this.name = 'MultipartInvalide';
    this.statusCode = 400;
  }
}

/** Nombre maximal de parties : un formulaire n'en a pas des milliers. */
const MAX_PARTIES = 32;
/** Un nom de champ ou de fichier au-delà de cette longueur n'est pas légitime. */
const MAX_ENTETE_OCTETS = 8 * 1024;

const CRLF = Buffer.from('\r\n');
const DEUX_CRLF = Buffer.from('\r\n\r\n');

/**
 * Extrait le `boundary` de l'en-tête `Content-Type`.
 *
 * La valeur peut être entre guillemets (`boundary="abc"`) ou non. Un corps
 * annoncé `multipart` sans frontière est refusé : sans elle, rien n'est
 * découpageable, et tenter de deviner reviendrait à accepter un corps arbitraire.
 */
export const extraireBoundary = (contentType) => {
  if (!contentType) return null;
  const correspondance = /;\s*boundary=("?)([^";]+)\1/i.exec(String(contentType));
  if (!correspondance) return null;
  const brut = correspondance[2].trim();
  // RFC 2046 : 1 à 70 caractères, pas d'espace final.
  if (brut.length === 0 || brut.length > 70) return null;
  return brut;
};

/** Analyse les en-têtes d'une partie en paires `nom: valeur` en minuscules. */
const analyserEntetes = (bloc) => {
  const entetes = {};
  for (const ligne of bloc.toString('latin1').split('\r\n')) {
    const sep = ligne.indexOf(':');
    if (sep < 1) continue;
    entetes[ligne.slice(0, sep).trim().toLowerCase()] = ligne.slice(sep + 1).trim();
  }
  return entetes;
};

/**
 * Lit `content-disposition` et en tire le nom du champ et le nom de fichier.
 *
 * Un `filename=` présent — même vide — marque une partie fichier : c'est ainsi
 * que les navigateurs signalent un champ de téléversement dont l'utilisateur
 * n'a rien choisi.
 */
const lireDisposition = (valeur) => {
  const texte = String(valeur ?? '');
  const nom = /;\s*name="([^"]*)"/i.exec(texte) ?? /;\s*name=([^;]+)/i.exec(texte);
  const fichier = /;\s*filename="([^"]*)"/i.exec(texte) ?? /;\s*filename=([^;]+)/i.exec(texte);
  return {
    champ: nom ? nom[1].trim() : null,
    filename: fichier ? fichier[1].trim() : undefined,
  };
};

/**
 * Lit le corps de la requête en imposant un plafond **pendant** la lecture.
 *
 * @returns {Promise<Buffer>}
 */
export const lireCorpsPlafonne = (req, limiteOctets) =>
  new Promise((resolve, reject) => {
    const morceaux = [];
    let total = 0;
    let termine = false;

    const echouer = (erreur) => {
      if (termine) return;
      termine = true;
      // Détruire le flux : sans cela le client continue d'écrire un corps que
      // plus personne ne lit, et la connexion reste occupée.
      req.destroy?.();
      reject(erreur);
    };

    req.on('data', (morceau) => {
      total += morceau.length;
      if (total > limiteOctets) {
        echouer(
          new CorpsTropVolumineux(
            `Corps trop volumineux : plus de ${limiteOctets} octets. `
            + `Le fichier est refusé avant d'être entièrement lu.`,
          ),
        );
        return;
      }
      morceaux.push(morceau);
    });
    req.on('end', () => {
      if (termine) return;
      termine = true;
      resolve(Buffer.concat(morceaux, total));
    });
    req.on('error', (erreur) => echouer(erreur));
  });

/**
 * Découpe un corps `multipart/form-data`.
 *
 * @param {Buffer} corps
 * @param {string} boundary
 * @returns {{ champs: Record<string,string>, fichiers: Array<object> }}
 */
export const decouperMultipart = (corps, boundary) => {
  const separateur = Buffer.from(`--${boundary}`);
  const champs = {};
  const fichiers = [];

  let position = corps.indexOf(separateur);
  if (position === -1) {
    throw new MultipartInvalide('Aucune frontière trouvée dans le corps.');
  }

  let parties = 0;
  while (position !== -1) {
    parties += 1;
    if (parties > MAX_PARTIES) {
      throw new MultipartInvalide(`Trop de parties dans le formulaire (plus de ${MAX_PARTIES}).`);
    }

    const debutPartie = position + separateur.length;
    // `--` après la frontière : dernière partie, le corps se termine.
    if (corps.subarray(debutPartie, debutPartie + 2).equals(Buffer.from('--'))) break;

    const finPartie = corps.indexOf(separateur, debutPartie);
    if (finPartie === -1) break;

    // Le séparateur est précédé de CRLF, qui appartient au délimiteur et non
    // aux données : le garder ajouterait deux octets à chaque fichier.
    const brut = corps.subarray(debutPartie, Math.max(debutPartie, finPartie - CRLF.length));

    const finEntetes = brut.indexOf(DEUX_CRLF);
    if (finEntetes === -1) {
      position = finPartie;
      continue;
    }

    const blocEntetes = brut.subarray(0, finEntetes);
    if (blocEntetes.length > MAX_ENTETE_OCTETS) {
      throw new MultipartInvalide('En-têtes de partie trop volumineux.');
    }
    const contenu = brut.subarray(finEntetes + DEUX_CRLF.length);
    // Le bloc commence par CRLF (fin de la ligne de frontière) : on le retire.
    const donnees = contenu.subarray(0, 2).equals(CRLF) ? contenu.subarray(2) : contenu;

    const entetes = analyserEntetes(blocEntetes);
    const { champ, filename } = lireDisposition(entetes['content-disposition']);
    if (!champ) {
      position = finPartie;
      continue;
    }

    if (filename !== undefined) {
      fichiers.push({
        champ,
        filename,
        contentType: entetes['content-type'] ?? 'application/octet-stream',
        tampon: donnees,
      });
    } else {
      champs[champ] = donnees.toString('utf8');
    }

    position = finPartie;
  }

  return { champs, fichiers };
};

/**
 * Lit et découpe un téléversement `multipart/form-data`.
 *
 * @param {import('http').IncomingMessage} req
 * @param {{ limiteOctets?: number }} options
 */
export const lireMultipart = async (req, { limiteOctets } = {}) => {
  const limite = Number.isFinite(limiteOctets) ? limiteOctets : 64 * 1024 * 1024;
  const boundary = extraireBoundary(req.headers?.['content-type']);
  if (!boundary) {
    throw new MultipartInvalide(
      'Content-Type « multipart/form-data » attendu, avec son paramètre boundary.',
    );
  }
  const corps = await lireCorpsPlafonne(req, limite);
  if (corps.length === 0) throw new MultipartInvalide('Corps vide.');
  return decouperMultipart(corps, boundary);
};

/**
 * Construit un corps `multipart/form-data`.
 *
 * Sert aux tests : sans lui, chaque recette devrait reconstruire les frontières
 * à la main et réinventerait les mêmes erreurs d'alignement CRLF.
 */
export const construireMultipart = (parties) => {
  const boundary = '----agrikonnectTestBoundary7ma49';
  const morceaux = [];
  for (const partie of parties) {
    morceaux.push(Buffer.from(`--${boundary}\r\n`, 'utf8'));
    if (partie.filename !== undefined) {
      morceaux.push(
        Buffer.from(
          `Content-Disposition: form-data; name="${partie.champ}"; filename="${partie.filename}"\r\n`,
          'utf8',
        ),
      );
      morceaux.push(Buffer.from(`Content-Type: ${partie.contentType ?? 'application/octet-stream'}\r\n\r\n`, 'utf8'));
      morceaux.push(Buffer.isBuffer(partie.valeur) ? partie.valeur : Buffer.from(partie.valeur ?? '', 'utf8'));
    } else {
      morceaux.push(Buffer.from(`Content-Disposition: form-data; name="${partie.champ}"\r\n\r\n`, 'utf8'));
      morceaux.push(Buffer.from(String(partie.valeur ?? ''), 'utf8'));
    }
    morceaux.push(CRLF);
  }
  morceaux.push(Buffer.from(`--${boundary}--\r\n`, 'utf8'));
  return { boundary, tampon: Buffer.concat(morceaux) };
};
