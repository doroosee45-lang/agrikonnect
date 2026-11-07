/**
 * Rapport d'état des services externes au démarrage.
 *
 * Le démarrage local sans service externe est **voulu**, mais silencieux : SMS
 * et e-mail tombent sur `console`, le satellite sur `simulated`. Un opérateur
 * qui ne lit pas les journaux découvre des semaines plus tard qu'aucune alerte
 * n'a jamais été délivrée.
 *
 * Ces tests vérifient que l'état dégradé est **nommé**, avec sa conséquence, et
 * qu'une configuration complète ne déclenche aucune alerte — sinon le rapport
 * finirait ignoré comme un bruit permanent.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  evaluerServicesExternes,
  formaterRapport,
} from '../src/shared/startup/degradedServices.js';

/** Valeurs par défaut réelles de `config/env.js`, vérifiées une à une. */
const CONFIG_LOCAL = {
  NODE_ENV: 'development',
  SMS_PROVIDER: 'console',
  EMAIL_PROVIDER: 'console',
  SATELLITE_PROVIDER: 'simulated',
  GEOAI_URL: 'http://127.0.0.1:8100',
  GEOSPATIAL_STORAGE_DRIVER: 'local',
  GEOSPATIAL_STORAGE_DIR: 'storage/',
  SUPABASE_SERVICE_ROLE_KEY: 'cle-de-service',
  simulationAllowed: true,
  hardwareMode: 'SIMULATION',
  mfaKeyFournie: false,
};

const CONFIG_PRODUCTION = {
  NODE_ENV: 'production',
  SMS_PROVIDER: 'twilio',
  TWILIO_ACCOUNT_SID: 'AC…',
  TWILIO_AUTH_TOKEN: 'secret',
  EMAIL_PROVIDER: 'resend',
  EMAIL_API_KEY: 're_…',
  SATELLITE_PROVIDER: 'sentinelhub',
  SATELLITE_API_KEY: 'sh_…',
  GEOSPATIAL_STORAGE_DRIVER: 'object',
  SUPABASE_SERVICE_ROLE_KEY: 'cle-de-service',
  simulationAllowed: false,
  hardwareMode: 'REAL',
  mfaKeyFournie: true,
};

const parService = (findings) =>
  Object.fromEntries(findings.map((f) => [f.service, f]));

test('démarrage — la configuration locale par défaut signale chaque service dégradé', () => {
  const findings = evaluerServicesExternes(CONFIG_LOCAL);
  const par = parService(findings);

  for (const service of ['sms', 'email', 'satellite', 'capteurs', 'geospatial', 'mfa']) {
    assert.ok(par[service], `le service « ${service} » doit être signalé`);
    assert.notEqual(par[service].niveau, 'ok', `« ${service} » ne doit pas être annoncé opérationnel`);
  }
});

test('démarrage — chaque finding nomme la conséquence, pas seulement le mode', () => {
  const findings = evaluerServicesExternes(CONFIG_LOCAL);
  for (const f of findings) {
    assert.ok(
      f.consequence && f.consequence.length > 20,
      `${f.service} : la conséquence doit être explicite, reçu « ${f.consequence} »`,
    );
    /*
     * « SMS en console » ne dit rien ; « aucune alerte SMS ne sera délivrée »
     * dit ce qui est perdu. Le texte doit parler de l'effet, pas du réglage.
     */
    assert.notEqual(f.consequence, f.mode, `${f.service} : la conséquence répète le mode`);
  }
});

test('démarrage — le mode console dit explicitement que rien n’est délivré', () => {
  const par = parService(evaluerServicesExternes(CONFIG_LOCAL));
  assert.match(par.sms.consequence, /aucun SMS ne part/i);
  assert.match(par.sms.consequence, /alertes de seuil/);
  assert.match(par.email.consequence, /aucun e-mail ne part/i);
  // Les deux pointent vers les journaux, seule voie de secours en local.
  assert.match(par.sms.consequence, /\[SMS:console\]/);
  assert.match(par.email.consequence, /\[EMAIL:console\]/);
});

test('démarrage — une configuration de production complète ne signale rien', () => {
  const findings = evaluerServicesExternes(CONFIG_PRODUCTION);
  const nonOk = findings.filter((f) => f.niveau !== 'ok');
  assert.deepEqual(
    nonOk.map((f) => `${f.service} (${f.niveau} : ${f.mode})`),
    [],
    'une configuration complète ne doit pas produire d’avertissement — sinon le rapport devient du bruit',
  );
});

test('démarrage — twilio sans identifiants est « incomplet », pas « ok »', () => {
  const par = parService(
    evaluerServicesExternes({ ...CONFIG_PRODUCTION, TWILIO_ACCOUNT_SID: undefined, TWILIO_AUTH_TOKEN: undefined }),
  );
  assert.equal(par.sms.niveau, 'incomplet');
  assert.match(par.sms.consequence, /FAILED/);
});

test('démarrage — sans clé de service Supabase, l’inscription est annoncée impossible', () => {
  const par = parService(
    evaluerServicesExternes({ ...CONFIG_LOCAL, SUPABASE_SERVICE_ROLE_KEY: undefined }),
  );
  assert.equal(par.auth.niveau, 'incomplet');
  assert.match(par.auth.consequence, /inscription/i);
  // Le script de démonstration en dépend : il doit être nommé.
  assert.match(par.auth.consequence, /démonstration/);
});

test('démarrage — le stockage local est « incomplet » en production, « dégradé » ailleurs', () => {
  const prod = parService(
    evaluerServicesExternes({ ...CONFIG_PRODUCTION, GEOSPATIAL_STORAGE_DRIVER: 'local' }),
  );
  assert.equal(prod.geospatial.niveau, 'incomplet');

  const dev = parService(evaluerServicesExternes(CONFIG_LOCAL));
  assert.equal(dev.geospatial.niveau, 'degrade');
});

test('démarrage — geoai est annoncé configuré mais sa joignabilité n’est pas testée', () => {
  const par = parService(evaluerServicesExternes(CONFIG_LOCAL));
  assert.equal(par.geoai.niveau, 'ok');
  /*
   * Le module ne peut pas ouvrir de socket sans rendre le démarrage asynchrone
   * et fragile. Il doit donc le **dire**, plutôt que de laisser croire que le
   * service Python a été vérifié.
   */
  assert.match(par.geoai.consequence, /joignabilité n’est pas testée/);
});

/* ─────────────────────────── formatage ─────────────────────────── */

test('formatage — liste les services à signaler et renvoie null si tout va bien', () => {
  const texte = formaterRapport(evaluerServicesExternes(CONFIG_LOCAL));
  assert.ok(texte, 'un rapport doit être produit en configuration locale');
  for (const service of ['sms', 'email', 'satellite', 'geospatial']) {
    assert.ok(texte.includes(service), `« ${service} » doit apparaître dans le rapport`);
  }
  assert.match(texte, /service\(s\) en mode dégradé ou incomplet/);

  assert.equal(
    formaterRapport(evaluerServicesExternes(CONFIG_PRODUCTION)),
    null,
    'aucun texte quand rien n’est à signaler',
  );
  assert.ok(
    formaterRapport(evaluerServicesExternes(CONFIG_PRODUCTION), { verbeux: true }),
    'en mode verbeux, même une configuration complète est listée',
  );
});

test('formatage — les services opérationnels ne sont pas listés par défaut', () => {
  const texte = formaterRapport(evaluerServicesExternes(CONFIG_PRODUCTION), { verbeux: true });
  assert.ok(texte.includes('✓ sms'), 'en verbeux, les services ok sont listés');
  assert.equal(
    formaterRapport(evaluerServicesExternes(CONFIG_LOCAL))?.includes('✓'),
    false,
    'par défaut, seul ce qui ne marche pas est affiché',
  );
});
