/**
 * Mesure — **pas un test** : combien de destinataires l'option « numéros
 * vérifiés seulement » exclurait-elle ?
 *
 * Lancé sur le harnais e2e (base vide + quelques inscriptions), donc les
 * chiffres ne décrivent **aucune donnée réelle**. Ce qui compte ici n'est pas le
 * nombre, c'est la **règle** qu'il révèle : l'inscription ne pose jamais
 * `phoneVerifiedAt`, donc sur une base issue uniquement d'inscriptions,
 * l'option stricte exclurait tout le monde.
 */
process.env.AGRONOMIC_DATASET = 'mesureconsentement';

const { startHarness } = await import('../tests/e2e/support/harness.mjs');

const h = await startHarness();
const PASSWORD = 'MotDePasse!2026';

const register = async (email, phone) => {
  const response = await h.request('POST', '/auth/register', {
    body: {
      accountType: 'FARMER',
      firstName: 'Mesure',
      lastName: email,
      email,
      password: PASSWORD,
      countryCode: 'CD',
      locale: 'fr',
      ...(phone ? { phone } : {}),
    },
  });
  if (response.status !== 201) throw new Error(`${email} : ${response.status}`);
};

await register('m-avec-numero@agrikonnect.test', '+243810000111');
await register('m-sans-numero@agrikonnect.test', null);

const { prisma } = await import('../src/config/prisma.js');

const [total, withPhone, verified, unverifiedWithPhone] = await Promise.all([
  prisma.profile.count(),
  prisma.profile.count({ where: { phone: { not: null } } }),
  prisma.profile.count({ where: { phoneVerifiedAt: { not: null } } }),
  prisma.profile.count({ where: { phone: { not: null }, phoneVerifiedAt: null } }),
]);

const pct = (n) => (total === 0 ? '0 %' : `${((n / total) * 100).toFixed(1)} %`);

console.log('── Mesure sur base de test (aucune donnée réelle) ──');
console.log(`profils                       : ${total}`);
console.log(`avec un numéro                : ${withPhone} (${pct(withPhone)})`);
console.log(`numéro vérifié                : ${verified} (${pct(verified)})`);
console.log(`numéro NON vérifié            : ${unverifiedWithPhone} (${pct(unverifiedWithPhone)})`);
console.log('');
console.log(
  unverifiedWithPhone === withPhone
    ? "⇒ Tous les numéros enregistrés sont non vérifiés : l'option stricte exclurait 100 % des destinataires."
    : `⇒ L'option stricte exclurait ${unverifiedWithPhone} destinataire(s) sur ${withPhone}.`,
);

await h.stop();
process.exit(0);
