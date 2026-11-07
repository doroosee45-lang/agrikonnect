/**
 * Le script de démonstration fonctionne — vérifié, pas supposé.
 *
 * `scripts/seed-demo.mjs` est livré comme point d'entrée du parcours local. S'il
 * échoue chez celui qui l'exécute, c'est la première impression du dépôt qui est
 * cassée. Cette recette le pilote donc **réellement**, contre le harnais e2e
 * (PostgreSQL + stub GoTrue), au lieu de se contenter de vérifier sa syntaxe.
 *
 * Elle vérifie aussi le point de méthode posé par le commanditaire : **aucune
 * plage agronomique validée n'existe**, donc toute recommandation produite sur
 * ces données doit se déclarer `indicative` et porter le rappel d'adéquation.
 */
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';

import { startHarness } from './support/harness.mjs';
import {
  ANALYSE_SOL,
  COMPTES,
  MOT_DE_PASSE,
  PARCELLE,
  executerDemo,
} from '../../scripts/seed-demo.mjs';

let h;
let resultat;
const lignes = [];

before(async () => {
  h = await startHarness();
  resultat = await executerDemo({ baseUrl: h.urls.baseUrl, log: (ligne) => lignes.push(ligne) });
});

after(async () => {
  await h.stop();
});

/* ─────────────────────── les deux comptes ─────────────────────── */

test('démo — un compte agriculteur et un compte agronome sont créés, avec un jeton', () => {
  assert.equal(resultat.comptes.length, 2);
  for (const session of resultat.comptes) {
    assert.ok(session.jeton, `aucun jeton pour ${session.compte.email}`);
    assert.equal(session.cree, true, `${session.compte.email} aurait dû être créé`);
  }
  const roles = resultat.comptes.map((s) => s.compte.accountType).sort();
  assert.deepEqual(roles, ['AGRONOMIST', 'FARMER']);
});

test('démo — les deux comptes existent en base, avec leur rôle et leur organisation', async () => {
  for (const compte of COMPTES) {
    const profil = await h.prisma.profile.findFirst({
      where: { email: compte.email },
      /* `Membership.roles` est un tableau d'**enum**, pas une relation :
       * `include: { roles: true }` est refusé par Prisma. */
      include: { memberships: true },
    });
    assert.ok(profil, `${compte.email} absent de la base`);
    assert.equal(profil.countryCode, 'CD');
    assert.ok(profil.memberships?.length > 0, `${compte.email} : aucune appartenance`);

    /*
     * Les rôles sont portés par l'**appartenance** (`Membership.roles`, enum
     * `Role[]`), pas par le profil : c'est ce qui permet à une même personne
     * d'avoir un rôle différent selon l'organisation.
     */
    const roles = profil.memberships.flatMap((m) => m.roles ?? []);
    assert.ok(
      roles.includes(compte.accountType),
      `${compte.email} : rôles ${JSON.stringify(roles)}, attendu ${compte.accountType}`,
    );
  }
});

test('démo — les identifiants sont clairement fictifs', () => {
  /*
   * Le domaine `.test` est réservé (RFC 6761) : il ne résout jamais. Un compte
   * de démonstration sur un domaine réel pourrait recevoir du courrier, et une
   * adresse réelle copiée-collée dans un dépôt public est une fuite.
   */
  for (const compte of COMPTES) {
    assert.match(compte.email, /\.test$/, `${compte.email} doit utiliser le domaine réservé .test`);
  }
  assert.match(PARCELLE.name, /fictive/i, 'le nom de la parcelle doit dire qu’elle est fictive');
  assert.match(ANALYSE_SOL.notes, /FICTIVE/, 'l’analyse de sol doit porter la mention FICTIVE');
  // Provenance honnête : déclarée, ni laboratoire ni capteur.
  for (const parametre of ANALYSE_SOL.parameters) {
    assert.equal(parametre.source, 'declared', `${parametre.key} ne doit pas se dire mesuré`);
  }
});

/* ─────────────────────── parcelle et analyse ─────────────────────── */

test('démo — la parcelle et l’analyse de sol existent en base', async () => {
  assert.ok(resultat.parcelleId, 'aucun identifiant de parcelle renvoyé');
  assert.equal(resultat.analyseOk, true, 'l’analyse de sol doit être acceptée');

  const parcelle = await h.prisma.plot.findUnique({ where: { id: resultat.parcelleId } });
  assert.ok(parcelle, 'parcelle absente de la base');
  assert.equal(parcelle.name, PARCELLE.name);

  const analyses = await h.prisma.soilAssessment.findMany({ where: { plotId: resultat.parcelleId } });
  assert.equal(analyses.length, 1);
});

test('démo — relancer le script ne duplique aucun compte', async () => {
  const second = await executerDemo({ baseUrl: h.urls.baseUrl, log: () => {} });

  for (const session of second.comptes) {
    assert.equal(session.cree, false, `${session.compte.email} a été recréé au second passage`);
    assert.ok(session.jeton, 'la reconnexion doit produire un jeton');
  }

  const comptes = await h.prisma.profile.count({
    where: { email: { in: COMPTES.map((c) => c.email) } },
  });
  assert.equal(comptes, COMPTES.length, 'des comptes ont été dupliqués');
});

/* ──────────────── le point de méthode : tout est indicatif ──────────────── */

/**
 * Le commanditaire a précisé qu'aucune plage validée ne sera fournie. Ce test
 * fixe la conséquence dans le code : sur des données de démonstration, la
 * recommandation se déclare **indicative** et porte le rappel d'adéquation.
 *
 * Si quelqu'un valide un jour des plages et que cette assertion échoue, c'est
 * le signal attendu — pas une régression à masquer.
 */
test('démo — la recommandation sur ces données est indicative et porte le rappel', async () => {
  const agriculteur = resultat.comptes.find((s) => s.compte.role === 'agriculteur');
  const debut = new Date();
  const fin = new Date(debut.getTime() + 30 * 86_400_000);

  const reponse = await h.request('POST', `/plots/${resultat.parcelleId}/recommendations`, {
    token: agriculteur.jeton,
    body: { periodStart: debut.toISOString(), periodEnd: fin.toISOString() },
  });

  assert.equal(reponse.status, 201, JSON.stringify(reponse.body));
  const donnees = reponse.body.data;

  /*
   * Le rappel est porté par **l'API** (`scoreNotice`), jamais recopié par un
   * écran. Vérifier sa présence ici garantit que les écrans ont bien quelque
   * chose à afficher sans inventer le texte.
   */
  assert.ok(donnees.scoreNotice, 'la réponse doit porter scoreNotice');
  assert.match(donnees.scoreNotice, /adéquation/i);
  assert.match(donnees.scoreNotice, /ni un rendement attendu/i);
  assert.match(donnees.scoreNotice, /probabilité de réussite/i);

  // Version du moteur et règle de combinaison : sans elles, un score est muet.
  assert.ok(donnees.engineVersion, 'engineVersion absent');
  assert.ok(donnees.combinationRuleLabel, 'combinationRuleLabel absent — un écran ne doit pas le recopier');

  /*
   * Aucune plage validée n'existe dans cette base : la recommandation ne peut
   * pas se présenter comme ferme.
   */
  assert.equal(
    donnees.indicative,
    true,
    `attendu indicative=true, reçu ${donnees.indicative} — raisons : ${JSON.stringify(donnees.indicativeReasons)}`,
  );
  assert.ok(
    Array.isArray(donnees.indicativeReasons) && donnees.indicativeReasons.length > 0,
    'une recommandation indicative doit dire pourquoi',
  );
});

/**
 * Aucune plage ne doit avoir été validée par le script : c'est la réserve
 * explicite du commanditaire (« n'attends aucune plage validée de ma part »).
 */
test('démo — le script ne crée aucune plage agronomique validée', async () => {
  const validees = await h.prisma.cropAgronomicRange.count({ where: { status: 'VALIDATED' } });
  assert.equal(
    validees,
    0,
    `${validees} plage(s) VALIDATED créée(s) par le script de démonstration — `
    + 'seule la route de validation explicite peut en produire',
  );
});
