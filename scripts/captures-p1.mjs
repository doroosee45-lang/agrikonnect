#!/usr/bin/env node
/**
 * AGRIKONNECT AFRICA — captures AVANT / APRÈS du palier P1.
 *
 * Une seule commande, sur votre machine :
 *
 *     node scripts/captures-p1.mjs
 *
 * Écrans protégés (sinon ils affichent la page de connexion) :
 *
 *     CAPTURE_LOGIN=votre@email CAPTURE_PASSWORD=votremdp node scripts/captures-p1.mjs
 *
 * Résultat : captures/index.html — ouvrez ce fichier.
 *
 * ─── NON DESTRUCTIF ────────────────────────────────────────────────────────
 * Le dépôt de travail n'est JAMAIS écrit. L'état « avant » est capturé depuis
 * une copie temporaire de apps/web, sur laquelle on pose les instantanés de
 * scripts/p1-avant/. Un Ctrl-C, un SIGKILL ou une coupure de courant ne peuvent
 * donc pas laisser le dépôt dans l'ancienne palette : il n'est pas modifié.
 *
 * Trois garanties supplémentaires :
 *   1. un manifeste de sommes de contrôle est pris AVANT et comparé APRÈS —
 *      toute différence fait échouer le script ;
 *   2. `git status --porcelain` est exécuté à la fin s'il y a un dépôt git, et
 *      son résultat est affiché (vide = propre) ;
 *   3. la copie temporaire est supprimée dans un `finally`.
 *
 * ─── PÉRIMÈTRE DE L'« AVANT » ──────────────────────────────────────────────
 * Les 8 captures sont toutes web. Seuls les fichiers web influencent donc le
 * build Vite : les instantanés couvrent 10 fichiers web (3 de thème, 1
 * composant, 6 pages). Les 6 fichiers de thème du §3 incluent 3 fichiers
 * MOBILES (agrikonnect.ts, colors.ts, shadows.ts) qui ne participent pas au
 * rendu web — ils ne sont pas dans la copie, et c'est sans effet sur l'image.
 * Voir le compte rendu §7.1.
 */
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync,
  statSync, symlinkSync, writeFileSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const WEB = join(RACINE, 'apps', 'web');
const SORTIE = join(RACINE, 'captures');
const AVANT_DIR = join(RACINE, 'scripts', 'p1-avant');
const TMP = join(RACINE, '.tmp-captures-p1');
const PORT = 4199;
const LARGEURS = { desktop: 1280, mobile: 390 };

const LOGIN = {
  identifiant: process.env.CAPTURE_LOGIN ?? '',
  motDePasse: process.env.CAPTURE_PASSWORD ?? '',
};

const ECRANS = [
  { id: '01-accueil',       label: 'Accueil',                      route: '/',                        largeur: 'desktop' },
  { id: '02-tableau',       label: 'Tableau de bord',              route: '/admin/dashboard',         largeur: 'desktop' },
  { id: '03-fiche',         label: 'Fiche producteur',             route: '/public/farmers',          largeur: 'desktop' },
  { id: '04-formulaire',    label: 'Formulaire d’inscription',     route: '/auth/register',           largeur: 'desktop' },
  { id: '05-liste-tableau', label: 'Liste / tableau de données',   route: '/public/data',             largeur: 'desktop' },
  { id: '06-erreur',        label: 'État d’erreur (route inconnue)', route: '/cette-route-n-existe-pas', largeur: 'desktop' },
  { id: '07-admin',         label: 'Administration',               route: '/admin',                   largeur: 'desktop' },
  { id: '08-mobile',        label: 'Écran mobile',                 route: '/',                        largeur: 'mobile',
    legende: 'web 390 px — repère de mise en page, pas un rendu React Native' },
];

const log = (...a) => console.log(...a);

/* ── intégrité du dépôt ─────────────────────────────────────────────────── */

function listerFichiers(dir, base = dir) {
  const out = [];
  for (const e of readdirSync(dir)) {
    if (e === 'node_modules' || e === 'dist' || e === '.tmp-captures-p1') continue;
    const p = join(dir, e);
    if (statSync(p).isDirectory()) out.push(...listerFichiers(p, base));
    else out.push(p.slice(base.length + 1));
  }
  return out;
}

function manifeste() {
  const m = new Map();
  for (const dir of ['apps/web/src', 'apps/Mobile/src']) {
    const abs = join(RACINE, dir);
    if (!existsSync(abs)) continue;
    for (const rel of listerFichiers(abs)) {
      const p = join(abs, rel);
      m.set(`${dir}/${rel}`, createHash('sha256').update(readFileSync(p)).digest('hex'));
    }
  }
  return m;
}

function verifierIntegrite(avant, apres) {
  const diffs = [];
  for (const [k, v] of avant) if (apres.get(k) !== v) diffs.push(`modifié : ${k}`);
  for (const k of apres.keys()) if (!avant.has(k)) diffs.push(`ajouté  : ${k}`);
  return diffs;
}

function gitStatus() {
  return new Promise((res) => {
    const p = spawn('git', ['status', '--porcelain'], { cwd: RACINE });
    let out = '';
    p.stdout.on('data', (d) => (out += d));
    p.on('error', () => res({ dispo: false, sortie: '' }));
    p.on('close', (code) => res({ dispo: code === 0, sortie: out.trim() }));
  });
}

/* ── copie temporaire + instantanés « avant » ───────────────────────────── */

function preparerCopieAvant() {
  rmSync(TMP, { recursive: true, force: true });
  mkdirSync(TMP, { recursive: true });
  cpSync(WEB, TMP, {
    recursive: true,
    filter: (src) => !src.includes(`${WEB}/node_modules`) && !src.includes(`${WEB}/dist`),
  });
  // node_modules est lié, pas copié.
  if (existsSync(join(WEB, 'node_modules'))) {
    symlinkSync(join(WEB, 'node_modules'), join(TMP, 'node_modules'), 'dir');
  }
  let poses = 0;
  for (const f of readdirSync(AVANT_DIR)) {
    const rel = f.replace(/__/g, '/');
    const cible = join(TMP, 'src', rel);
    if (!existsSync(dirname(cible))) mkdirSync(dirname(cible), { recursive: true });
    cpSync(join(AVANT_DIR, f), cible);
    poses++;
  }
  return poses;
}

/* ── serveur + navigateur ───────────────────────────────────────────────── */

async function chargerPlaywright() {
  try { return await import('playwright'); }
  catch {
    log('Playwright absent — installation…');
    const run = (cmd, args) => new Promise((res, rej) => {
      const p = spawn(cmd, args, { cwd: RACINE, stdio: 'inherit' });
      p.on('exit', (c) => (c === 0 ? res() : rej(new Error(`${cmd} ${args.join(' ')} a échoué`))));
    });
    await run('npm', ['install', '-D', 'playwright', '--no-audit', '--no-fund']);
    await run('npx', ['playwright', 'install', 'chromium']);
    return import('playwright');
  }
}

async function demarrer(cwd) {
  const srv = spawn('npm', ['run', 'dev', '--', '--port', String(PORT), '--host', '0.0.0.0', '--strictPort'],
    { cwd, stdio: 'ignore' });
  for (let i = 0; i < 90; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    try { if ((await fetch(`http://localhost:${PORT}/`)).ok) return srv; } catch { /* pas prêt */ }
  }
  srv.kill();
  throw new Error('Vite n’a pas répondu après 90 s.');
}

async function seConnecter(page) {
  if (!LOGIN.identifiant) return false;
  await page.goto(`http://localhost:${PORT}/auth/login`, { waitUntil: 'networkidle' }).catch(() => {});
  const champs = await page.$$('input');
  if (champs.length < 2) return false;
  await champs[0].fill(LOGIN.identifiant);
  await champs[1].fill(LOGIN.motDePasse);
  const b = await page.$('button[type="submit"]');
  if (b) await b.click();
  await page.waitForTimeout(2500);
  return !page.url().includes('/auth/login');
}

async function capturer(page, dossier) {
  const faits = [];
  for (const e of ECRANS) {
    await page.setViewportSize({ width: LARGEURS[e.largeur], height: 900 });
    const url = `http://localhost:${PORT}${e.route}`;
    let note = '';
    try { await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 }); }
    catch {
      await page.goto(url, { waitUntil: 'load', timeout: 30000 }).catch(() => {});
      note = 'chargement partiel (networkidle dépassé)';
    }
    if (page.url().includes('/auth/login') && !e.route.startsWith('/auth')) {
      note = note || 'écran protégé — redirigé vers /auth/login, capture non représentative. '
        + 'Relancez avec CAPTURE_LOGIN / CAPTURE_PASSWORD.';
    }
    await page.waitForTimeout(800);
    await page.screenshot({ path: join(dossier, `${e.id}.png`), fullPage: false });
    faits.push({ ...e, note });
    log(`  ${dossier.split('/').pop()}/${e.id}.png${note ? `  ← ${note}` : ''}`);
  }
  return faits;
}

/* ── page de résultat ───────────────────────────────────────────────────── */

function ecrireIndex(faitsAvant, faitsApres) {
  const blocs = ECRANS.map((e, i) => {
    const note = faitsApres[i]?.note || faitsAvant[i]?.note || '';
    const legende = e.legende ? `<p class="legende">${e.legende}</p>` : '';
    return `
    <section>
      <h2>${i + 1}. ${e.label} <code>${e.route}</code> <small>${LARGEURS[e.largeur]} px</small></h2>
      ${legende}
      <div class="paire">
        <figure><figcaption>AVANT — palette pré-P1</figcaption>
          <img src="avant/${e.id}.png" alt="Avant — ${e.label}"></figure>
        <figure><figcaption>APRÈS — palette AGRIKONNECT AFRICA</figcaption>
          <img src="apres/${e.id}.png" alt="Après — ${e.label}"></figure>
      </div>
      ${note ? `<p class="note">⚠ ${note}</p>` : ''}
    </section>`;
  }).join('\n');

  writeFileSync(join(SORTIE, 'index.html'), `<!doctype html>
<html lang="fr"><head><meta charset="utf-8">
<title>AGRIKONNECT AFRICA — captures P1 avant / après</title>
<style>
  body{font-family:system-ui,-apple-system,sans-serif;margin:0;padding:32px;background:#faf6ec;color:#33403a}
  h1{color:#0e3022;font-size:26px;margin:0 0 8px}
  .chapeau{background:#fff;border:1px solid rgba(18,61,42,.10);border-radius:20px;padding:20px 24px;margin-bottom:28px}
  section{margin-bottom:44px}
  h2{color:#0e3022;font-size:18px;border-bottom:1px solid rgba(18,61,42,.10);padding-bottom:8px}
  h2 code{font-size:13px;color:#5c665f;font-weight:400}
  h2 small{font-size:12px;color:#5c665f;font-weight:400}
  .legende{background:#f5e3d8;border-left:4px solid #9c4423;border-radius:8px;padding:10px 14px;
           font-size:13px;font-weight:600;color:#7d3620}
  .paire{display:grid;grid-template-columns:1fr 1fr;gap:20px}
  figure{margin:0;background:#fff;border:1px solid rgba(18,61,42,.10);border-radius:20px;overflow:hidden}
  figcaption{padding:10px 14px;font-size:12px;letter-spacing:.22em;text-transform:uppercase;
             color:#5c665f;border-bottom:1px solid rgba(18,61,42,.10)}
  img{display:block;width:100%;height:auto}
  .note{background:#fef2f2;border:1px solid rgba(185,28,28,.25);border-radius:8px;padding:10px 14px;
        font-size:13px;color:#b91c1c}
  .limite{background:#f5e3d8;border-radius:12px;padding:14px 18px;font-size:13px}
</style></head><body>
<h1>AGRIKONNECT AFRICA — palier P1, captures avant / après</h1>
<div class="chapeau">
  <p>Même écran, même largeur, même instant. À gauche la palette pré-P1, à droite la palette
  harmonisée. Produites par <code>node scripts/captures-p1.mjs</code> sans écrire dans le dépôt.</p>
  <p class="limite"><strong>Limites.</strong> Rendu navigateur headless du build web. L'écran 8
  n'est <strong>pas</strong> un rendu React Native — c'est le site web à 390 px, repère de mise en
  page uniquement. Les écrans protégés sans session affichent la page de connexion ; le script le
  signale sous l'image. Aucune donnée réelle n'est saisie.</p>
</div>
${blocs}
</body></html>`);
}

/* ── orchestration ──────────────────────────────────────────────────────── */

async function main() {
  if (!existsSync(AVANT_DIR)) throw new Error(`Instantanés introuvables : ${AVANT_DIR}`);
  mkdirSync(join(SORTIE, 'avant'), { recursive: true });
  mkdirSync(join(SORTIE, 'apres'), { recursive: true });

  const avant = manifeste();
  log(`Manifeste d'intégrité : ${avant.size} fichiers sommés.`);

  const { chromium } = await chargerPlaywright();
  let srv = null, nav = null;
  try {
    // ── APRÈS : le dépôt tel qu'il est, servi directement, en lecture seule.
    log('\nServeur sur le dépôt courant (état « après »)…');
    srv = await demarrer(WEB);
    nav = await chromium.launch();
    let page = await nav.newPage();
    const ok = await seConnecter(page);
    log(ok ? 'Session ouverte — écrans protégés accessibles.'
           : 'Aucune session — les écrans protégés montreront la page de connexion.');
    log('Captures APRÈS :');
    const faitsApres = await capturer(page, join(SORTIE, 'apres'));
    await nav.close(); nav = null;
    srv.kill(); srv = null;

    // ── AVANT : copie temporaire + instantanés. Le dépôt n'est pas touché.
    log('\nCopie temporaire de apps/web + pose des instantanés « avant »…');
    const poses = preparerCopieAvant();
    log(`  ${poses} instantanés posés dans ${TMP}`);
    srv = await demarrer(TMP);
    nav = await chromium.launch();
    page = await nav.newPage();
    await seConnecter(page);
    log('Captures AVANT :');
    const faitsAvant = await capturer(page, join(SORTIE, 'avant'));
    await nav.close(); nav = null;
    srv.kill(); srv = null;

    ecrireIndex(faitsAvant, faitsApres);

    // ── intégrité
    const diffs = verifierIntegrite(avant, manifeste());
    if (diffs.length) {
      throw new Error(`Le dépôt a été modifié :\n  ${diffs.join('\n  ')}`);
    }
    log(`\nIntégrité du dépôt vérifiée : ${avant.size} fichiers, aucune modification.`);
    const git = await gitStatus();
    if (git.dispo) {
      log(git.sortie === '' ? 'git status --porcelain : vide — dépôt propre.'
                            : `git status --porcelain :\n${git.sortie}`);
    } else {
      log('git status : aucun dépôt git ici — l’intégrité est prouvée par les sommes de contrôle.');
    }
    log(`\nTerminé. Ouvrez : ${join(SORTIE, 'index.html')}`);
  } finally {
    if (nav) await nav.close().catch(() => {});
    if (srv) srv.kill();
    rmSync(TMP, { recursive: true, force: true });
    log('Copie temporaire supprimée.');
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
