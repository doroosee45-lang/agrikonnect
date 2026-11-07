/**
 * Identification d'un fichier par ses **octets d'en-tête**, et assainissement
 * des noms de fichier.
 *
 * ## Pourquoi l'extension ne suffit pas
 *
 * Une extension est une déclaration du client, pas une propriété du fichier.
 * Renommer `malware.exe` en `releve.jpg` coûte une seconde. Vérifier le type
 * sur l'extension seule revient à faire confiance à l'expéditeur sur le point
 * précis qu'on cherche à contrôler.
 *
 * Ici on lit les premiers octets et on les compare aux signatures connues. Ce
 * n'est **pas** une analyse de contenu : on ne décode rien, on n'interprète
 * aucune donnée métier. On répond à une seule question — « ce fichier
 * commence-t-il comme le type déclaré ? ».
 *
 * ## Limite assumée : SEG-Y
 *
 * Le format SEG-Y (répandu en géoradar) n'a **pas de signature magique en tête
 * de fichier**. Ses 3 200 premiers octets sont un en-tête textuel EBCDIC libre.
 * La convention exploitable est le marqueur de révision aux octets 3 255-3 256
 * (« 01 » pour la révision 1.0, « 02 » pour 2.0), en EBCDIC ou en ASCII selon
 * l'outil émetteur. C'est un contrôle **plus faible** que pour JPEG ou PNG : un
 * fichier construit pour passer ce test y passera. Il est documenté comme tel,
 * et le statut reste `RECEIVED` — aucun traitement ne s'appuie sur ce contrôle.
 */

/**
 * Signature : position, octets attendus, format identifié, et solidité.
 *
 * `faible: true` marque un contrôle qui identifie un **conteneur** sans rien
 * garantir de son contenu. Il est accepté — certains formats géoradar sont
 * effectivement distribués en archive — mais la réponse le signale, exactement
 * comme pour SEG-Y.
 */
const SIGNATURES = [
  { format: 'image/jpeg', kind: 'DRONE_IMAGE', offset: 0, bytes: [0xff, 0xd8, 0xff] },
  {
    format: 'image/png',
    kind: 'DRONE_IMAGE',
    offset: 0,
    bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
  },
  // TIFF « little endian » (II*\0) puis « big endian » (MM\0*) : les deux
  // ordres existent sur le terrain, un GeoTIFF peut être dans l'un ou l'autre.
  { format: 'image/tiff', kind: 'DRONE_IMAGE', offset: 0, bytes: [0x49, 0x49, 0x2a, 0x00] },
  { format: 'image/tiff', kind: 'DRONE_IMAGE', offset: 0, bytes: [0x4d, 0x4d, 0x00, 0x2a] },
  /*
   * ZIP : certains formats géoradar sont livrés en archive. Mais `PK\3\4`
   * identifie une **archive**, pas un relevé — n'importe quel ZIP du monde
   * passe ce contrôle, y compris un `.zip` sans aucun rapport avec la
   * géophysique. Contrôle faible, au même titre que SEG-Y.
   */
  {
    format: 'application/zip',
    kind: 'GPR',
    offset: 0,
    bytes: [0x50, 0x4b, 0x03, 0x04],
    faible: true,
  },
];

/**
 * Marqueur de révision SEG-Y, aux octets 3 255-3 256.
 * Accepté en EBCDIC (0xf0 0xf1 / 0xf0 0xf2) et en ASCII (0x30 0x31 / 0x30 0x32),
 * parce que les outils du marché écrivent dans l'un ou l'autre.
 */
const SEGY_REV_OFFSET = 3254;
const SEGY_MARKERS = [
  [0xf0, 0xf1], // EBCDIC « 01 » — révision 1.0
  [0xf0, 0xf2], // EBCDIC « 02 » — révision 2.0
  [0x30, 0x31], // ASCII « 01 »
  [0x30, 0x32], // ASCII « 02 »
];

/** Nombre d'octets à lire en tête pour trancher. SEG-Y impose 3 256. */
export const HEADER_BYTES = 3256;

const memePrefixe = (tampon, offset, attendu) => {
  if (tampon.length < offset + attendu.length) return false;
  return attendu.every((octet, i) => tampon[offset + i] === octet);
};

/**
 * Identifie le format à partir des octets d'en-tête.
 *
 * @param {Buffer|Uint8Array} tampon Les `HEADER_BYTES` premiers octets.
 * @returns {{ format: string, kind: 'GPR'|'DRONE_IMAGE', faible: boolean } | null}
 *   `null` si aucune signature connue ne correspond. `faible: true` signale un
 *   contrôle moins fiable que les signatures magiques (cas SEG-Y).
 */
export const detecterFormat = (tampon) => {
  const octets = Buffer.isBuffer(tampon) ? tampon : Buffer.from(tampon ?? []);

  for (const signature of SIGNATURES) {
    if (memePrefixe(octets, signature.offset, signature.bytes)) {
      return {
        format: signature.format,
        kind: signature.kind,
        faible: signature.faible === true,
      };
    }
  }

  if (octets.length >= SEGY_REV_OFFSET + 2) {
    for (const marqueur of SEGY_MARKERS) {
      if (memePrefixe(octets, SEGY_REV_OFFSET, marqueur)) {
        return { format: 'application/x-segy', kind: 'GPR', faible: true };
      }
    }
  }

  return null;
};

/**
 * Assainit un nom de fichier fourni par le client.
 *
 * Le nom d'origine n'est **jamais** utilisé comme chemin de stockage : la clé
 * est construite côté serveur (organisation + identifiant + extension). Ce nom
 * assaini ne sert qu'à l'affichage et à l'audit — mais il passe quand même par
 * ici, parce qu'il est enregistré en base et relu plus tard.
 *
 * Sont retirés : séparateurs de chemin (`/`, `\`), remontée de répertoire
 * (`..`), octet nul, caractères de contrôle, et tout ce qui n'est pas lettre,
 * chiffre, point, tiret ou souligné. Les espaces deviennent des soulignés.
 *
 * @returns {string} Un nom sûr, ou `fichier` si rien ne subsiste.
 */
export const assainirNom = (nom) => {
  const brut = String(nom ?? '')
    // Un octet nul tronque silencieusement les chemins en C : retiré d'abord.
    .replace(/\0/g, '')
    /*
     * NFKD et **non** NFKC : NFKC conserve « é » précomposé, qui tombe ensuite
     * dans le filtre « caractères autorisés » et devient un souligné — « relevé »
     * donnerait « relev_ ». NFKD décompose en « e » + accent combinant, ce qui
     * permet de retirer la marque en gardant la lettre. Dans une interface
     * française, détruire les accents d'un nom de fichier n'est pas acceptable.
     */
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .replace(/\s+/g, '_')
    // eslint-disable-next-line no-control-regex
    .replace(/[\x00-\x1f\x7f]/g, '')
    .replace(/[^A-Za-z0-9._-]/g, '_')
    // Remonter de répertoire neutralisée, et longues suites de soulignés
    // réduites pour garder un nom lisible.
    .replace(/\.{2,}/g, '_')
    .replace(/_{2,}/g, '_')
    // Soulignés en bordure retirés : « mon_releve_final.jpg » et non
    // « mon_releve_final_.jpg », où un souligné reste collé à l'extension.
    .replace(/_+(?=\.[A-Za-z0-9]*$)/, '')
    .replace(/_+$/, '')
    .replace(/^\.+/, '');

  /*
   * Un nom dont rien ne subsiste (que des séparateurs, que des caractères
   * interdits) ne doit pas produire une chaîne de soulignés : on retombe sur un
   * nom neutre plutôt que sur un résidu illisible.
   */
  const final = brut.slice(0, 180).replace(/_+$/, '');
  return /[A-Za-z0-9]/.test(final) ? final : 'fichier';
};

/** Extension en minuscules, sans point, ou `''`. Jamais prise du chemin. */
export const extensionDe = (nom) => {
  const assaini = assainirNom(nom);
  const point = assaini.lastIndexOf('.');
  if (point <= 0 || point === assaini.length - 1) return '';
  return assaini.slice(point + 1).toLowerCase().slice(0, 12);
};

/**
 * Vérifie qu'un fichier correspond au type déclaré.
 *
 * @returns {{ ok: boolean, raison?: string, format?: string, faible?: boolean }}
 */
export const verifierType = (tampon, typeDeclare) => {
  const trouve = detecterFormat(tampon);
  if (!trouve) {
    return {
      ok: false,
      raison:
        'Aucune signature connue dans les octets d’en-tête. Le type est vérifié '
        + 'sur le contenu du fichier, pas sur son extension.',
    };
  }
  if (trouve.kind !== typeDeclare) {
    return {
      ok: false,
      raison:
        `Le contenu correspond à ${trouve.format} (${trouve.kind}), pas au type `
        + `déclaré ${typeDeclare}.`,
      format: trouve.format,
    };
  }
  return { ok: true, format: trouve.format, faible: trouve.faible };
};
