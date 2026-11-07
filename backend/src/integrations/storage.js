/**
 * Interface de stockage des fichiers déposés.
 *
 * Deux pilotes derrière la même interface :
 *
 *  - **`local`** — écrit sur le disque. Utilisé par les tests et le
 *    développement. Aucun service externe requis.
 *  - **`object`** — stockage objet (Supabase Storage). Utilisé en production.
 *
 * Le service métier ne connaît que l'interface : il ne sait pas où vont les
 * octets. C'est ce qui permet de tester le dépôt de fichier sans compte cloud,
 * et de changer de fournisseur sans réécrire le module.
 *
 * ## Emplacement — hors de tout dossier public
 *
 * Le pilote local écrit sous `GEOSPATIAL_STORAGE_DIR`, qui doit pointer
 * **hors** de toute racine servie statiquement. Un fichier déposé par un
 * utilisateur n'est jamais une ressource web : s'il tombait dans un dossier
 * public, il serait téléchargeable par quiconque connaît son URL, sans
 * authentification ni contrôle d'organisation. Le pilote refuse de démarrer si
 * le chemin résolu se trouve sous l'un des dossiers publics connus.
 *
 * ## Ce qui n'est pas vérifié
 *
 * Le pilote `object` n'est **pas testé** dans cette livraison : il n'y a ni
 * compte Supabase ni réseau de stockage accessible depuis l'environnement de
 * test. Son code suit l'API de `@supabase/supabase-js` telle qu'elle est déjà
 * utilisée dans `src/modules/media/media.service.js`, mais il n'a jamais
 * rencontré un vrai panier. À valider avant tout usage réel.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { env } from '../config/env.js';

/** Dossiers servis statiquement : le stockage local doit rester en dehors. */
const DOSSIERS_PUBLICS = ['public', 'dist', 'build', 'static', 'www'];

export class StockageInterdit extends Error {
  constructor(message) {
    super(message);
    this.name = 'StockageInterdit';
  }
}

const estSousDossierPublic = (racine) => {
  const normalise = path.resolve(racine);
  const segments = normalise.split(path.sep);
  return segments.some((segment) => DOSSIERS_PUBLICS.includes(segment.toLowerCase()));
};

/* ─────────────────────────── pilote local ─────────────────────────── */

export const creerStockageLocal = ({ racine }) => {
  if (!racine) throw new StockageInterdit('GEOSPATIAL_STORAGE_DIR est requis pour le pilote local');
  const absolue = path.resolve(racine);
  if (estSousDossierPublic(absolue)) {
    throw new StockageInterdit(
      `Le stockage local refuse un dossier public (${absolue}). `
      + `Un fichier déposé n'est pas une ressource web.`,
    );
  }

  return {
    pilote: 'local',
    racine: absolue,

    async ecrire(cle, tampon) {
      const cible = this.chemin(cle);
      await fs.mkdir(path.dirname(cible), { recursive: true });
      await fs.writeFile(cible, tampon);
      return { cle, taille: tampon.length };
    },

    async lire(cle) {
      return fs.readFile(this.chemin(cle));
    },

    async lireEnTete(cle, nombre) {
      const handle = await fs.open(this.chemin(cle), 'r');
      try {
        const tampon = Buffer.alloc(nombre);
        const { bytesRead } = await handle.read(tampon, 0, nombre, 0);
        return tampon.subarray(0, bytesRead);
      } finally {
        await handle.close();
      }
    },

    async existe(cle) {
      try {
        await fs.access(this.chemin(cle));
        return true;
      } catch {
        return false;
      }
    },

    async supprimer(cle) {
      await fs.rm(this.chemin(cle), { force: true });
    },

    /**
     * Empêche l'évasion de la racine : `../../etc/passwd` résolu hors de
     * `racine` est refusé, pas suivi.
     */
    chemin(cle) {
      const cible = path.resolve(this.racine, String(cle));
      if (!cible.startsWith(this.racine + path.sep) && cible !== this.racine) {
        throw new StockageInterdit(`Clé de stockage hors racine : ${cle}`);
      }
      return cible;
    },
  };
};

/* ─────────────────────────── pilote objet ─────────────────────────── */

/**
 * Stockage objet via Supabase Storage.
 *
 * ⚠ **Non testé.** Aucun panier réel n'est accessible depuis l'environnement
 * de test. L'implémentation suit l'API utilisée ailleurs dans le dépôt
 * (`media.service.js`), mais elle n'a jamais été exécutée contre un vrai
 * stockage. À valider avant usage réel.
 */
export const creerStockageObjet = ({ client, panier }) => {
  if (!client) throw new StockageInterdit('Un client Supabase admin est requis pour le pilote objet');
  if (!panier) throw new StockageInterdit('GEOSPATIAL_BUCKET est requis pour le pilote objet');
  const stockage = client.storage.from(panier);

  const lever = (erreur, operation) => {
    if (erreur) {
      const e = new Error(`Stockage objet — ${operation} : ${erreur.message}`);
      e.code = erreur.code ?? 'STORAGE_ERROR';
      throw e;
    }
  };

  return {
    pilote: 'object',
    panier,

    async ecrire(cle, tampon) {
      const { error } = await stockage.upload(cle, tampon, {
        contentType: 'application/octet-stream',
        upsert: false,
      });
      lever(error, 'upload');
      return { cle, taille: tampon.length };
    },

    async lire(cle) {
      const { data, error } = await stockage.download(cle);
      lever(error, 'download');
      return Buffer.from(await data.arrayBuffer());
    },

    async lireEnTete(cle, nombre) {
      // Le stockage objet ne propose pas de lecture partielle par octets :
      // on télécharge puis on tronque. Coûteux pour les gros fichiers, mais
      // ce pilote n'est pas celui des tests et la lecture d'en-tête sert à la
      // vérification à la réception, avant écriture.
      const tout = await this.lire(cle);
      return tout.subarray(0, Math.min(nombre, tout.length));
    },

    async existe(cle) {
      const { data, error } = await stockage.list(path.dirname(cle), {
        search: path.basename(cle),
        limit: 1,
      });
      if (error) return false;
      return (data ?? []).length > 0;
    },

    async supprimer(cle) {
      const { error } = await stockage.remove([cle]);
      lever(error, 'remove');
    },
  };
};

/* ─────────────────────────── choix du pilote ─────────────────────────── */

/**
 * Renvoie le pilote demandé par la configuration.
 *
 * `GEOSPATIAL_STORAGE_DRIVER` vaut `local` (défaut, tests et développement) ou
 * `object` (production). Un pilote inconnu est une erreur de configuration, pas
 * un repli silencieux sur le local : en production, écrire sur le disque d'un
 * conteneur éphémère ferait perdre les fichiers au redémarrage.
 */
export const creerStockage = async ({ pilote, racine, client, panier, s3 } = {}) => {
  const choix = pilote ?? env.GEOSPATIAL_STORAGE_DRIVER ?? 'local';
  if (choix === 'local') return creerStockageLocal({ racine: racine ?? env.GEOSPATIAL_STORAGE_DIR });
  if (choix === 'object') return creerStockageObjet({ client, panier: panier ?? env.GEOSPATIAL_BUCKET });
  /*
   * `s3` : API S3 signée en SigV4, sans dépendance. Fonctionne avec AWS, MinIO,
   * Cloudflare R2, Scaleway, Wasabi — tout service parlant S3. Préféré à
   * `object` en production : il accepte la lecture partielle par `Range`, ce
   * qui permet de vérifier l'en-tête d'un fichier de 64 Mo sans le télécharger.
   */
  if (choix === 's3') {
    /*
     * Import **dynamique** : `s3.js` importe `StockageInterdit` depuis ce
     * module. Un import statique dans les deux sens produirait un module à
     * moitié initialisé, où `StockageInterdit` vaudrait `undefined` au moment
     * où `s3.js` en aurait besoin.
     */
    const { creerStockageS3 } = await import('./s3.js');
    return creerStockageS3({ panier, ...(s3 ?? {}) });
  }
  throw new StockageInterdit(
    `Pilote de stockage inconnu : « ${choix} ». Valeurs acceptées : local, object, s3.`,
  );
};
