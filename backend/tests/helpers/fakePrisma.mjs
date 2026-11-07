/**
 * Prisma simulé en mémoire — pour tester les **services** (et pas seulement
 * les fonctions pures) sans PostgreSQL.
 *
 * Il n'implémente que ce dont les services V2 ont besoin : filtres scalaires,
 * opérateurs `in/gte/lte/lt/gt/startsWith/not`, filtres de listes
 * (`has/hasEvery/hasSome`), `OR`/`NOT`, `orderBy`, `take/skip`, `select`
 * (ignoré : on renvoie la ligne complète) et incréments (`increment`).
 *
 * Volontairement simple : ce n'est **pas** un moteur SQL, seulement un double
 * de test permettant de vérifier les invariants métier (machine à états,
 * réservation de stock, participants de messagerie).
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Modèles dont l'identifiant est `id String @id` **sans** `@default`.
 *
 * Pour ceux-là, le vrai Prisma refuse une création sans `id` et lève
 * « Argument `id` is missing ». Le double de test doit faire pareil : un double
 * plus permissif que la base réelle laisse passer en test ce qui échouera en
 * production. C'est exactement ce qui s'est produit pour le journal `ApiUsage`.
 *
 * La liste est **dérivée du schéma à l'import**, pas recopiée : un nouveau
 * modèle sans `@default` est couvert sans que personne ait à y penser. Si le
 * schéma est illisible, on retombe sur une liste vide plutôt que de faire
 * échouer toute la suite de tests.
 */
const lireModelesSansDefaut = () => {
  try {
    const ici = dirname(fileURLToPath(import.meta.url));
    const schema = readFileSync(join(ici, '..', '..', 'prisma', 'schema.prisma'), 'utf8');
    const trouves = new Set();
    for (const [, nom, corps] of schema.matchAll(/model (\w+) \{([\s\S]*?)\n\}/g)) {
      const id = corps.match(/^\s*id\s+(\S+)(.*)$/m);
      if (id && id[1] === 'String' && !id[2].includes('@default')) {
        // `ApiUsage` → `apiUsage` : le nom du délégué Prisma est en camelCase.
        trouves.add(nom[0].toLowerCase() + nom.slice(1));
      }
    }
    return trouves;
  } catch {
    return new Set();
  }
};

const STRICT_ID_MODELS = lireModelesSansDefaut();

/**
 * Valeurs par défaut normalement posées par Prisma (schéma). Le double de test
 * doit les reproduire, sinon les services lisent des champs `undefined`.
 */
/**
 * Défauts **dynamiques** du schéma : ceux que Prisma évalue à chaque création.
 * `DEFAULTS` ci-dessous est statique (évalué une fois à l'import), il ne peut
 * pas porter un `@default(now())` — sans quoi la date serait figée au chargement
 * du module et tout filtre `gte`/`lte` sur ce champ donnerait un résultat faux.
 */
const DYNAMIC_DEFAULTS = {
  /** `at DateTime @default(now())` — horodatage de la ligne de journal. */
  apiUsage: () => ({ at: new Date() }),
};

const DEFAULTS = {
  order: { status: 'PENDING', paymentStatus: 'DECLARED_UNPAID', currency: 'USD', version: 1, deletedAt: null },
  conversation: { status: 'OPEN' },
  message: { attachments: [], readBy: [] },
  notification: { channel: 'IN_APP', readAt: null },
  dispute: { status: 'OPEN', evidence: [] },
  listing: { version: 1, status: 'PUBLISHED', deletedAt: null, certifications: [] },
  // Valeurs par défaut du schéma Prisma que le double doit reproduire.
  offer: { status: 'PENDING', currency: 'USD' },
  purchaseRequest: { status: 'OPEN', deletedAt: null },
  inventoryItem: { deletedAt: null },
  transportRequest: { status: 'REQUESTED' },
  orderEvent: { at: new Date() },
  media: { position: 0, deletedAt: null },
  // Valeurs par défaut du schéma que le service d'alertes relit après écriture.
  thresholdAlert: {
    status: 'NEW', severity: 'WARNING', sourceType: 'MEASUREMENT', predictive: false,
    notificationCount: 0, channelsSent: [], plotId: null, recommendationId: null,
    deviceId: null, replacementRecommendationId: null, notifiedAt: null,
    lastNotifiedAt: null, observedAt: null, predictedBreachAt: null,
    observedValue: null, deviation: null, confidence: null, message: null,
  },
};

/**
 * Contraintes d'unicité réellement utilisées par les services pour éviter les
 * doublons (déduplication d'événements). Les `null` multiples restent permis,
 * comme en SQL.
 */
const UNIQUE_FIELDS = {
  notification: ['dedupeKey'],
  apiKey: ['prefix'],
};

/**
 * Relations `include` minimales : sans elles, un service qui lit
 * `item.movements` recevrait `undefined` (le vrai Prisma les joint).
 */
const RELATIONS = {
  inventoryItem: { movements: { model: 'inventoryMovement', fk: 'itemId' } },
  soilAssessment: { parameters: { model: 'soilParameter', fk: 'assessmentId' } },
  traceabilityLot: { events: { model: 'lotEvent', fk: 'lotId' } },
  order: { events: { model: 'orderEvent', fk: 'orderId' } },
  conversation: { messages: { model: 'message', fk: 'conversationId' } },
  apiClient: { keys: { model: 'apiKey', fk: 'clientId' } },
  /*
   * Relation inverse : `apiKey.findUnique({ include: { client: true } })` doit
   * rendre l'objet client, sans quoi `key.client.scopes` explose dans le
   * middleware. Absente jusqu'ici parce qu'aucun test ne passait par ce chemin.
   */
  apiKey: { client: { model: 'apiClient', fk: 'id', localKey: 'clientId', toOne: true } },
  project: { reports: { model: 'projectReport', fk: 'projectId' } },
  membership: {
    organization: { model: 'organization', fk: 'id', localKey: 'organizationId' },
    /** Les alertes résolvent les destinataires via le profil du membre. */
    user: { model: 'profile', fk: 'id', localKey: 'userId', toOne: true },
  },
  iotDevice: { plot: { model: 'plot', fk: 'id', localKey: 'plotId', toOne: true } },
  /**
   * La province vit sur la ferme, pas sur la parcelle : le moteur de
   * recommandation fait `include: { farm: ... }` pour résoudre le calendrier.
   */
  plot: { farm: { model: 'farm', fk: 'id', localKey: 'farmId', toOne: true } },
};

const clone = (value) => (value === undefined ? value : structuredClone(value));

const getPath = (row, path) => path.split('.').reduce((acc, key) => (acc == null ? acc : acc[key]), row);

const matchesScalar = (value, condition) => {
  if (condition === null) return value === null || value === undefined;
  if (typeof condition !== 'object' || condition instanceof Date) return value === condition;

  if ('equals' in condition && value !== condition.equals) return false;
  if ('in' in condition && !condition.in.includes(value)) return false;
  if ('notIn' in condition && condition.notIn.includes(value)) return false;
  if ('not' in condition && matchesScalar(value, condition.not)) return false;

  // Sémantique SQL : NULL ne satisfait aucun comparateur d'intervalle
  const comparable = value !== null && value !== undefined;
  if (('gte' in condition || 'lte' in condition || 'gt' in condition || 'lt' in condition) && !comparable) return false;

  if ('gte' in condition && !(value >= condition.gte)) return false;
  if ('lte' in condition && !(value <= condition.lte)) return false;
  if ('gt' in condition && !(value > condition.gt)) return false;
  if ('lt' in condition && !(value < condition.lt)) return false;

  if ('startsWith' in condition) {
    if (typeof value !== 'string' || !value.startsWith(condition.startsWith)) return false;
  }
  if ('contains' in condition) {
    const haystack = String(value ?? '').toLowerCase();
    if (!haystack.includes(String(condition.contains).toLowerCase())) return false;
  }

  // Filtres de listes (String[])
  if ('has' in condition && !(Array.isArray(value) && value.includes(condition.has))) return false;
  if ('hasEvery' in condition && !condition.hasEvery.every((v) => value?.includes(v))) return false;
  if ('hasSome' in condition && !condition.hasSome.some((v) => value?.includes(v))) return false;

  return true;
};

const matches = (row, where) => {
  if (!where) return true;

  for (const [key, condition] of Object.entries(where)) {
    if (key === 'OR') {
      if (!condition.some((sub) => matches(row, sub))) return false;
      continue;
    }
    if (key === 'AND') {
      if (!condition.every((sub) => matches(row, sub))) return false;
      continue;
    }
    if (key === 'NOT') {
      if (Array.isArray(condition) ? condition.some((sub) => matches(row, sub)) : matches(row, condition)) return false;
      continue;
    }
    /**
     * Filtre relationnel (`device: { plotId }`) : **non pris en charge**.
     *
     * Sans cette garde, un tel filtre retombait dans la branche « clé composée »
     * ci-dessous et faisait silencieusement ne correspondre aucune ligne : les
     * tests passaient en ne vérifiant rien. Mieux vaut échouer bruyamment et
     * tester la requête contre une vraie base (recette e2e).
     *
     * La détection s'appuie sur la convention Prisma : une relation `foo`
     * s'accompagne du scalaire `fooId`.
     */
    if (!(key in row) && `${key}Id` in row && condition && typeof condition === 'object' && !Array.isArray(condition)) {
      throw new Error(
        `fakePrisma : le filtre relationnel « ${key}: { … } » n'est pas pris en charge. `
        + 'Il ferait silencieusement échouer la correspondance. Testez cette requête '
        + 'contre PostgreSQL (tests/e2e/).',
      );
    }

    // Clé composée (`orderId_authorOrgId: { orderId, authorOrgId }`) : ce n'est
    // pas un champ de la ligne, mais un groupe d'égalités.
    if (!(key in row) && condition && typeof condition === 'object' && !Array.isArray(condition)) {
      const operators = ['in', 'notIn', 'not', 'gte', 'lte', 'gt', 'lt', 'equals', 'startsWith', 'contains', 'has', 'hasEvery', 'hasSome'];
      const isCompound = !operators.some((operator) => operator in condition);
      if (isCompound && Object.values(condition).every((value) => typeof value !== 'object')) {
        const satisfied = Object.entries(condition).every(([field, value]) => matchesScalar(row[field], value));
        if (!satisfied) return false;
        continue;
      }
    }

    if (!matchesScalar(getPath(row, key), condition)) return false;
  }

  return true;
};

const applyOrder = (rows, orderBy) => {
  if (!orderBy) return rows;
  const clauses = Array.isArray(orderBy) ? orderBy : [orderBy];

  return [...rows].sort((a, b) => {
    for (const clause of clauses) {
      const [field, direction] = Object.entries(clause)[0];
      const av = getPath(a, field);
      const bv = getPath(b, field);
      if (av === bv) continue;
      const factor = direction === 'desc' ? -1 : 1;
      if (av === null || av === undefined) return 1;
      if (bv === null || bv === undefined) return -1;
      return (av > bv ? 1 : -1) * factor;
    }
    return 0;
  });
};

/** Applique `{ increment, decrement, push, set }` sur les champs de données. */
const applyData = (row, data = {}) => {
  const next = { ...row };
  for (const [key, value] of Object.entries(data)) {
    if (value && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
      if ('increment' in value) { next[key] = (next[key] ?? 0) + value.increment; continue; }
      if ('decrement' in value) { next[key] = (next[key] ?? 0) - value.decrement; continue; }
      if ('push' in value) { next[key] = [...(next[key] ?? []), ...(Array.isArray(value.push) ? value.push : [value.push])]; continue; }
      if ('set' in value) { next[key] = value.set; continue; }
    }
    next[key] = value;
  }
  return next;
};

export const createFakePrisma = (initial = {}) => {
  let counter = 0;
  const newId = (prefix) => `${prefix}_${Date.now().toString(36)}_${(counter += 1)}`;
  const store = {
    order: [],
    orderEvent: [],
    listing: [],
    conversation: [],
    message: [],
    notification: [],
    notificationPreference: [],
    auditLog: [],
    membership: [],
    dispute: [],
    media: [],
    crop: [],
    profile: [],
    ...clone(initial),
  };

  /** Fabrique un délégué CRUD minimal pour une collection. */
  const delegate = (model) => {
    const rows = () => store[model];

    /** Jointures minimales (`include`) configurées dans `RELATIONS`. */
    const withIncludes = (row, include) => {
      if (!row || !include) return row;

      const relations = RELATIONS[model] ?? {};
      const out = { ...row };

      for (const key of Object.keys(include)) {
        const relation = relations[key];
        if (!relation) continue;
        const related = store[relation.model] ?? [];
        const localValue = relation.localKey ? row[relation.localKey] : row.id;
        const matched = related.filter((candidate) => candidate[relation.fk] === localValue);
        // Une relation to-one (`plot.farm`) doit rendre l'objet, pas un tableau :
        // `plot.farm.province` est la forme que le vrai Prisma renvoie.
        out[key] = relation.toOne ? (matched[0] ?? null) : matched;
      }

      return out;
    };

    return {
      async create({ data, include }) {
        /*
         * Le vrai Prisma **refuse** une création sans identifiant quand le
         * modèle déclare `id String @id` sans `@default` : il lève
         * « Argument `id` is missing ». Ce faux inventait un identifiant
         * (`scalarData.id ?? newId(model)`), donc il était **plus permissif que
         * la base réelle** — c'est précisément ce qui a masqué l'échec
         * d'écriture du journal `ApiUsage` : en test tout passait, en
         * production chaque écriture échouait en silence.
         *
         * La liste est dérivée du schéma, pas recopiée à la main, pour qu'un
         * nouveau modèle sans `@default` soit couvert sans qu'on y pense.
         */
        if (STRICT_ID_MODELS.has(model) && (data?.id === undefined || data?.id === null)) {
          const erreur = new Error(
            `Argument \`id\` is missing (modèle ${model} : id String @id sans @default)`,
          );
          erreur.code = 'P2012';
          throw erreur;
        }
        for (const field of UNIQUE_FIELDS[model] ?? []) {
          const value = data[field];
          if (value === null || value === undefined) continue;
          if (rows().some((candidate) => candidate[field] === value)) {
            const error = new Error(`Contrainte d'unicité violée sur ${model}.${field}`);
            error.code = 'P2002';
            error.meta = { target: [field] };
            throw error;
          }
        }

        // Écritures imbriquées (`parameters: { create: [...] }`) : on crée
        // l'enfant avec la clé étrangère du parent, comme le ferait Prisma.
        const nested = [];
        const scalarData = { ...data };
        for (const [key, value] of Object.entries(data)) {
          const relation = (RELATIONS[model] ?? {})[key];
          if (!relation) continue;
          const children = Array.isArray(value?.create) ? value.create : Array.isArray(value) ? value : null;
          if (!children) continue;
          nested.push([relation, children]);
          delete scalarData[key];
        }

        const row = {
          ...(DEFAULTS[model] ?? {}),
          ...(DYNAMIC_DEFAULTS[model] ? DYNAMIC_DEFAULTS[model]() : {}),
          id: scalarData.id ?? newId(model),
          createdAt: scalarData.createdAt ?? new Date(),
          updatedAt: scalarData.updatedAt ?? new Date(),
          ...applyData({}, scalarData),
        };
        rows().push(row);

        for (const [relation, children] of nested) {
          store[relation.model] = store[relation.model] ?? [];
          for (const child of children) {
            store[relation.model].push({ id: newId(relation.model), ...child, [relation.fk]: row.id });
          }
        }

        return withIncludes(row, include);
      },
      async createMany({ data }) {
        const items = Array.isArray(data) ? data : [data];
        for (const item of items) rows().push({ id: newId(model), ...item });
        return { count: items.length };
      },
      async findUnique({ where, include }) {
        const row = rows().find((candidate) => matches(candidate, where));
        return row ? withIncludes(row, include) : null;
      },
      async findFirst({ where, orderBy, include } = {}) {
        const filtered = applyOrder(rows().filter((row) => matches(row, where)), orderBy);
        return filtered[0] ? withIncludes(filtered[0], include) : null;
      },
      async findMany({ where, orderBy, take, skip, include, select } = {}) {
        let filtered = applyOrder(rows().filter((row) => matches(row, where)), orderBy);
        if (skip) filtered = filtered.slice(skip);
        if (take) filtered = filtered.slice(0, take);
        return filtered.map((row) => withIncludes(row, include ?? select));
      },
      async count({ where } = {}) {
        return rows().filter((row) => matches(row, where)).length;
      },
      async update({ where, data }) {
        const index = rows().findIndex((row) => matches(row, where));
        if (index === -1) {
          const error = new Error(`Enregistrement introuvable (${model})`);
          error.code = 'P2025';
          throw error;
        }
        rows()[index] = { ...applyData(rows()[index], data), updatedAt: new Date() };
        return { ...rows()[index] };
      },
      async updateMany({ where, data }) {
        let count = 0;
        store[model] = rows().map((row) => {
          if (!matches(row, where)) return row;
          count += 1;
          return { ...applyData(row, data), updatedAt: new Date() };
        });
        return { count };
      },
      async upsert({ where, create, update }) {
        const existing = rows().find((row) => matches(row, where));
        if (existing) return this.update({ where, data: update });
        return this.create({ data: create });
      },
      async delete({ where }) {
        const index = rows().findIndex((row) => matches(row, where));
        if (index === -1) throw new Error('P2025');
        const [removed] = rows().splice(index, 1);
        return removed;
      },
      async deleteMany({ where } = {}) {
        const before = rows().length;
        store[model] = rows().filter((row) => !matches(row, where));
        return { count: before - store[model].length };
      },
      async groupBy({ by, where, _avg, _max, _min, _sum }) {
        const groups = new Map();
        for (const row of rows().filter((r) => matches(r, where))) {
          const key = by.map((b) => row[b]).join('|');
          if (!groups.has(key)) {
            groups.set(key, {
              ...Object.fromEntries(by.map((b) => [b, row[b]])),
              _count: { _all: 0 },
              ...(_max ? { _max: {} } : {}),
              ...(_min ? { _min: {} } : {}),
              ...(_sum ? { _sum: {} } : {}),
              ...(_avg ? { _avg: {} } : {}),
            });
          }
          const group = groups.get(key);
          group._count._all += 1;
          for (const field of Object.keys(_max ?? {})) {
            const value = row[field];
            if (value === null || value === undefined) continue;
            group._max[field] = !group._max[field] || new Date(value) > new Date(group._max[field])
              ? value
              : group._max[field];
          }
          for (const field of Object.keys(_min ?? {})) {
            const value = row[field];
            if (value === null || value === undefined) continue;
            group._min[field] = !group._min[field] || new Date(value) < new Date(group._min[field])
              ? value
              : group._min[field];
          }
          for (const field of Object.keys(_sum ?? {})) {
            const value = Number(row[field]);
            if (!Number.isFinite(value)) continue;
            group._sum[field] = (group._sum[field] ?? 0) + value;
          }
          for (const field of Object.keys(_avg ?? {})) {
            const value = Number(row[field]);
            if (!Number.isFinite(value)) continue;
            group._avg[field] = group._avg[field] === undefined
              ? value
              : group._avg[field] + value / group._count._all;
          }
        }
        return [...groups.values()];
      },
      async aggregate({ where, _avg, _max, _min, _sum } = {}) {
        const filtered = rows().filter((row) => matches(row, where));
        const result = { _count: { _all: filtered.length } };
        if (_avg) {
          result._avg = {};
          for (const field of Object.keys(_avg)) {
            const values = filtered.map((r) => Number(r[field])).filter((v) => Number.isFinite(v));
            result._avg[field] = values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
          }
        }
        for (const [op, fields] of [['_max', _max], ['_min', _min], ['_sum', _sum]]) {
          if (!fields) continue;
          result[op] = {};
          for (const field of Object.keys(fields)) {
            const values = filtered
              .map((r) => r[field])
              .filter((v) => v !== null && v !== undefined);
            if (op === '_sum') {
              const numbers = values.map(Number).filter((v) => Number.isFinite(v));
              result[op][field] = numbers.length ? numbers.reduce((a, b) => a + b, 0) : null;
            } else if (op === '_max') {
              result[op][field] = values.length
                ? values.reduce((a, b) => (new Date(b) > new Date(a) ? b : a))
                : null;
            } else {
              result[op][field] = values.length
                ? values.reduce((a, b) => (new Date(b) < new Date(a) ? b : a))
                : null;
            }
          }
        }
        return result;
      },
    };
  };

  const models = Object.keys(store);
  const fake = { _store: store };

  for (const model of models) fake[model] = delegate(model);

  // Transactions : dans ce double de test, exécution directe (pas d'isolation).
  // Les deux formes de l'API Prisma sont supportées : tableau de promesses
  // (`$transaction([...])`) et fonction de rappel (`$transaction(async tx => …)`).
  fake.$transaction = async (arg) => (Array.isArray(arg) ? Promise.all(arg) : arg(fake));
  fake.$disconnect = async () => {};
  fake.$connect = async () => {};

  return fake;
};

/**
 * Remplace les délégués du client Prisma réel par ceux du double, puis
 * restaure l'état initial. Permet de tester les services **sans** modifier
 * leur code (ils importent le singleton `prisma`).
 */
let activeRestore = null;

export const withFakePrisma = async (prisma, initial) => {
  // Filet de sécurité : si un test précédent n'a pas restauré le client (échec
  // avant le `finally`), on le fait ici. Sans cela, un double resté monté
  // contamine silencieusement les tests suivants.
  if (activeRestore) {
    try {
      activeRestore();
    } catch {
      /* la restauration précédente a déjà échoué : on remonte le nouveau double */
    }
    activeRestore = null;
  }

  const fake = createFakePrisma(initial);
  const originals = {};

  for (const key of Object.keys(fake)) {
    if (key === '_store') continue;
    // On remplace aussi $transaction / $disconnect : sinon les services
    // tenteraient une vraie connexion PostgreSQL.
    originals[key] = prisma[key];
    prisma[key] = fake[key];
  }

  const restore = () => {
    for (const [key, value] of Object.entries(originals)) prisma[key] = value;
    if (activeRestore === restore) activeRestore = null;
  };
  activeRestore = restore;

  return { fake, restore };
};
