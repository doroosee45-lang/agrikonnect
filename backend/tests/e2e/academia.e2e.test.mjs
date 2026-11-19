/**
 * ACADEMIA — lot L1 « Fondations » de bout en bout (**base réelle**).
 *
 * Scénarios CDC-ACADEMIA-01 §15.2 / instruction §19 couverts ici :
 *   1. un nouveau compte s'inscrit (compte unique AGRIKONNECT) ;
 *   2. il demande une affiliation universitaire ;
 *   3. l'université (son responsable) la valide ;
 *   4. il accède à son espace (profil + affiliation vérifiée) ;
 *   5. il consulte les universités publiques sans session ;
 *  14. l'université gère ses informations et ses facultés ;
 *  17. les API centrales continuent de fonctionner ;
 * plus les contre-épreuves de sécurité :
 *   - module désactivé par défaut (403 module_disabled) ;
 *   - création d'établissement réservée à ACADEMIA_ADMIN ;
 *   - pas d'auto-validation ; le responsable d'une AUTRE université ne voit rien ;
 *   - un étudiant-producteur ne garde pas ses droits producteur dans l'université (R2) ;
 *   - suspension → rôle retiré ; demande en double → 409 ; journal d'audit écrit.
 *
 * Seul service remplacé : Supabase Auth (stub GoTrue respectant son contrat).
 */
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';

import { startHarness } from './support/harness.mjs';

let h;
// Chargé APRÈS startHarness : le module lit l'environnement que le banc définit.
let invalidateSettingsCache;
const PASSWORD = 'MotDePasse!2026';
const comptes = {};

const inscrire = async (cle, email, accountType = 'FARMER') => {
  const res = await h.request('POST', '/auth/register', {
    body: { accountType, firstName: cle, lastName: 'Academia', email, password: PASSWORD, countryCode: 'CD', locale: 'fr' },
  });
  assert.equal(res.status, 201, `inscription ${email} : ${JSON.stringify(res.body)}`);
  comptes[cle] = { id: res.body.data.user.id, token: res.body.data.session.accessToken, email };
  return comptes[cle];
};

const activerModule = async (valeur) => {
  await h.prisma.setting.upsert({
    where: { key: 'modules.academia' },
    create: { key: 'modules.academia', value: valeur },
    update: { value: valeur },
  });
  invalidateSettingsCache();
};

let uniA;
let uniB;
let faculte;
let affiliationEtudiant;

before(async () => {
  h = await startHarness();
  ({ invalidateSettingsCache } = await import('../../src/middleware/settingsEffects.js'));
  await inscrire('gouvernance', 'gouvernance-academia@agrikonnect.test');
  await inscrire('responsableA', 'responsable-a@agrikonnect.test', 'BUYER');
  await inscrire('responsableB', 'responsable-b@agrikonnect.test', 'BUYER');
  // L'étudiant est AUSSI producteur : sert la contre-épreuve R2.
  await inscrire('etudiant', 'etudiant@agrikonnect.test', 'FARMER');
  // Rôle de plateforme attribué directement en base (semis de test).
  const m = await h.prisma.membership.findFirst({ where: { userId: comptes.gouvernance.id } });
  await h.prisma.membership.update({ where: { id: m.id }, data: { roles: ['ACADEMIA_ADMIN'] } });
});

after(async () => {
  await h?.stop();
});

test('module désactivé par défaut : 403 module_disabled, même en lecture', async () => {
  invalidateSettingsCache();
  const res = await h.request('GET', '/academia/institutions');
  assert.equal(res.status, 403);
  assert.equal(res.body.details?.code ?? res.body.code, 'module_disabled', JSON.stringify(res.body));
  await activerModule(true);
  const ok = await h.request('GET', '/academia/institutions');
  assert.equal(ok.status, 200, JSON.stringify(ok.body));
});

test('§11.4 — création d\'établissement : refusée hors gouvernance, acceptée pour ACADEMIA_ADMIN', async () => {
  const corps = { name: 'Université de Kinshasa', kind: 'UNIVERSITY', countryCode: 'CD', city: 'Kinshasa', shortName: 'UNIKIN', disciplines: ['geomatique', 'agronomie'] };
  const refus = await h.request('POST', '/academia/institutions', { token: comptes.etudiant.token, body: corps });
  assert.equal(refus.status, 403);

  const creeA = await h.request('POST', '/academia/institutions', { token: comptes.gouvernance.token, body: corps });
  assert.equal(creeA.status, 201, JSON.stringify(creeA.body));
  uniA = creeA.body.data;
  assert.equal(uniA.slug, 'universite-de-kinshasa');

  const org = await h.prisma.organization.findUnique({ where: { id: uniA.organizationId } });
  assert.equal(org.type, 'UNIVERSITY', 'une université EST une organisation');

  const creeB = await h.request('POST', '/academia/institutions', {
    token: comptes.gouvernance.token,
    body: { name: 'Centre de recherche Lubumbashi', kind: 'RESEARCH_CENTER', countryCode: 'CD' },
  });
  assert.equal(creeB.status, 201);
  uniB = creeB.body.data;
  assert.equal((await h.prisma.organization.findUnique({ where: { id: uniB.organizationId } })).type, 'RESEARCH_CENTER');
});

test('désignation des responsables (gouvernance uniquement)', async () => {
  const refus = await h.request('POST', `/academia/institutions/${uniA.id}/admins`, {
    token: comptes.responsableA.token, body: { email: comptes.responsableA.email },
  });
  assert.equal(refus.status, 403, 'on ne se désigne pas soi-même');

  for (const [uni, cle] of [[uniA, 'responsableA'], [uniB, 'responsableB']]) {
    const res = await h.request('POST', `/academia/institutions/${uni.id}/admins`, {
      token: comptes.gouvernance.token, body: { email: comptes[cle].email },
    });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.deepEqual(res.body.data.roles, ['UNIVERSITY_ADMIN']);
  }
});

test('§14 — l\'université gère sa fiche et ses facultés ; pas celle d\'une autre', async () => {
  const maj = await h.request('PATCH', `/academia/institutions/${uniA.id}`, {
    token: comptes.responsableA.token, body: { website: 'https://www.unikin.ac.cd', description: 'Université publique' },
  });
  assert.equal(maj.status, 200, JSON.stringify(maj.body));
  assert.equal(maj.body.data.website, 'https://www.unikin.ac.cd');

  const intrusion = await h.request('PATCH', `/academia/institutions/${uniA.id}`, {
    token: comptes.responsableB.token, body: { website: 'https://pirate.example' },
  });
  assert.equal(intrusion.status, 403, 'responsable de B, pas de A');

  const fac = await h.request('POST', `/academia/institutions/${uniA.id}/units`, {
    token: comptes.responsableA.token, body: { kind: 'FACULTY', name: 'Faculté des sciences agronomiques' },
  });
  assert.equal(fac.status, 201, JSON.stringify(fac.body));
  faculte = fac.body.data;
  const dep = await h.request('POST', `/academia/institutions/${uniA.id}/units`, {
    token: comptes.responsableA.token, body: { kind: 'DEPARTMENT', name: 'Géomatique', parentId: faculte.id },
  });
  assert.equal(dep.status, 201);
});

test('§3.6 — annuaire public sans session ; aucune donnée personnelle exposée', async () => {
  const liste = await h.request('GET', '/academia/institutions?country=CD&q=kinshasa');
  assert.equal(liste.status, 200);
  assert.equal(liste.body.data.length, 1);
  const fiche = await h.request('GET', `/academia/institutions/${uniA.slug}`);
  assert.equal(fiche.status, 200);
  assert.equal(fiche.body.data.units.length, 2);
  assert.equal(JSON.stringify(fiche.body).includes('@agrikonnect.test'), false, 'aucun e-mail personnel');
});

test('§2.4 — demande → vérification → droits ; contre-épreuves', async () => {
  await h.request('PUT', '/academia/me/profile', {
    token: comptes.etudiant.token, body: { headline: 'Étudiant en géomatique', disciplines: ['geomatique', 'teledetection'] },
  });

  const demande = await h.request('POST', '/academia/affiliations', {
    token: comptes.etudiant.token,
    body: { organizationId: uniA.organizationId, unitId: faculte.id, role: 'STUDENT', studyLevel: 'Master 1', academicYear: '2026-2027' },
  });
  assert.equal(demande.status, 201, JSON.stringify(demande.body));
  affiliationEtudiant = demande.body.data;
  assert.equal(affiliationEtudiant.status, 'PENDING');

  // Aucun privilège avant vérification.
  const avant = await h.prisma.membership.findUnique({
    where: { userId_organizationId: { userId: comptes.etudiant.id, organizationId: uniA.organizationId } },
  });
  assert.equal(avant, null, 'PENDING n\'accorde aucun rôle');

  const doublon = await h.request('POST', '/academia/affiliations', {
    token: comptes.etudiant.token, body: { organizationId: uniA.organizationId, role: 'STUDENT' },
  });
  assert.equal(doublon.status, 409);

  const notifs = await h.prisma.notification.count({ where: { userId: comptes.responsableA.id, type: 'academia.affiliation.requested' } });
  assert.equal(notifs, 1, 'le responsable est prévenu');

  // Le responsable d'une AUTRE université ne voit ni ne décide rien.
  const listeB = await h.request('GET', `/academia/institutions/${uniA.id}/affiliations`, { token: comptes.responsableB.token });
  assert.equal(listeB.status, 403);
  const decisionB = await h.request('POST', `/academia/affiliations/${affiliationEtudiant.id}/decision`, {
    token: comptes.responsableB.token, body: { status: 'VERIFIED' },
  });
  assert.equal(decisionB.status, 404);

  const listeA = await h.request('GET', `/academia/institutions/${uniA.id}/affiliations?status=PENDING`, { token: comptes.responsableA.token });
  assert.equal(listeA.status, 200);
  assert.equal(listeA.body.data.length, 1);

  const ok = await h.request('POST', `/academia/affiliations/${affiliationEtudiant.id}/decision`, {
    token: comptes.responsableA.token, body: { status: 'VERIFIED' },
  });
  assert.equal(ok.status, 200, JSON.stringify(ok.body));

  const apres = await h.prisma.membership.findUnique({
    where: { userId_organizationId: { userId: comptes.etudiant.id, organizationId: uniA.organizationId } },
  });
  assert.deepEqual(apres.roles, ['STUDENT']);
  assert.equal(apres.status, 'ACTIVE');

  const espace = await h.request('GET', '/academia/me', { token: comptes.etudiant.token });
  assert.equal(espace.status, 200);
  assert.equal(espace.body.data.profile.headline, 'Étudiant en géomatique');
  assert.equal(espace.body.data.affiliations[0].status, 'VERIFIED');

  const fiche = await h.request('GET', `/academia/institutions/${uniA.id}`);
  assert.equal(fiche.body.data.stats.STUDENT, 1, 'statistique agrégée');

  const audits = await h.prisma.auditLog.findMany({ where: { resource: 'academic_affiliation', resourceId: affiliationEtudiant.id } });
  assert.deepEqual(audits.map((a) => a.action).sort(), ['academia.affiliation.request', 'academia.affiliation.verified']);
});

test('pas d\'auto-validation, même pour un responsable', async () => {
  const demande = await h.request('POST', '/academia/affiliations', {
    token: comptes.responsableA.token, body: { organizationId: uniA.organizationId, role: 'PROFESSOR' },
  });
  assert.equal(demande.status, 201);
  const auto = await h.request('POST', `/academia/affiliations/${demande.body.data.id}/decision`, {
    token: comptes.responsableA.token, body: { status: 'VERIFIED' },
  });
  assert.equal(auto.status, 403);
});

test('non-régression R2 — l\'étudiant-producteur n\'a pas de droits producteur dans l\'université', async () => {
  const dansUniversite = await h.request('GET', '/farms', {
    token: comptes.etudiant.token, headers: { 'x-organization-id': uniA.organizationId },
  });
  assert.equal(dansUniversite.status, 403, JSON.stringify(dansUniversite.body));

  // §19.17 — API centrale inchangée dans sa propre organisation.
  const chezLui = await h.request('GET', '/farms', { token: comptes.etudiant.token });
  assert.equal(chezLui.status, 200, JSON.stringify(chezLui.body));
});

test('suspension → rôle retiré ; transition invalide refusée', async () => {
  const suspendre = await h.request('POST', `/academia/affiliations/${affiliationEtudiant.id}/decision`, {
    token: comptes.responsableA.token, body: { status: 'SUSPENDED', reason: 'Inscription non renouvelée' },
  });
  assert.equal(suspendre.status, 200);
  const m = await h.prisma.membership.findUnique({
    where: { userId_organizationId: { userId: comptes.etudiant.id, organizationId: uniA.organizationId } },
  });
  assert.deepEqual(m.roles, []);
  assert.equal(m.status, 'REMOVED');

  const invalide = await h.request('POST', `/academia/affiliations/${affiliationEtudiant.id}/decision`, {
    token: comptes.responsableA.token, body: { status: 'REJECTED' },
  });
  assert.equal(invalide.status, 409);

  const retrait = await h.request('POST', `/academia/affiliations/${affiliationEtudiant.id}/withdraw`, { token: comptes.etudiant.token });
  assert.equal(retrait.status, 200);
  assert.equal(retrait.body.data.status, 'ENDED');
});

test('module redésactivé : l\'espace ACADEMIA se ferme immédiatement', async () => {
  await activerModule(false);
  const res = await h.request('GET', '/academia/me', { token: comptes.etudiant.token });
  assert.equal(res.status, 403);
  // Le reste de la plateforme n'est pas affecté.
  const farms = await h.request('GET', '/farms', { token: comptes.etudiant.token });
  assert.equal(farms.status, 200);
});
