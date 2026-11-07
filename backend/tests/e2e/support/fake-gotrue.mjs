import http from 'node:http';
import crypto from 'node:crypto';

/**
 * Stub fidèle du contrat HTTP **Supabase Auth (GoTrue)** utilisé par l'API.
 *
 * Pourquoi un stub et pas un vrai projet Supabase ? Parce qu'un projet Supabase
 * est un service hébergé : il n'est pas disponible dans cet environnement. Le
 * stub reproduit *le contrat réseau observé par supabase-js* (chemins, corps,
 * codes d'erreur, forme des réponses) pour que le code applicatif — middleware
 * `authenticate`, inscription, connexion, rafraîchissement, réinitialisation —
 * soit exercé tel qu'il l'est en production, sans le contourner.
 *
 * Ce qui est réellement vérifié ici : l'API applicative, le middleware d'auth,
 * les règles métier, PostgreSQL, les contraintes, l'isolation tenant.
 * Ce qui n'est pas vérifié : l'implémentation interne de GoTrue (hors périmètre).
 *
 * Endpoints couverts :
 *   POST   /auth/v1/admin/users            (createUser)
 *   PUT    /auth/v1/admin/users/:id        (updateUserById)
 *   DELETE /auth/v1/admin/users/:id        (deleteUser)
 *   POST   /auth/v1/token?grant_type=password
 *   POST   /auth/v1/token?grant_type=refresh_token
 *   GET    /auth/v1/user                   (getUser, jeton Bearer)
 *   POST   /auth/v1/logout                 (admin.signOut)
 *   POST   /auth/v1/recover                (resetPasswordForEmail)
 *   POST   /auth/v1/resend                 (auth.resend — renvoi du lien)
 *   POST   /auth/v1/otp                    (sendOtp)
 *   POST   /auth/v1/verify                 (verifyOtp)
 */

const b64url = (value) => Buffer.from(value).toString('base64url');

const fakeJwt = (userId) => {
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = b64url(
    JSON.stringify({
      sub: userId,
      role: 'authenticated',
      aud: 'authenticated',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
    }),
  );
  const signature = b64url(crypto.randomBytes(24));
  return `${header}.${payload}.${signature}`;
};

const readBody = (req) =>
  new Promise((resolve) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
    });
    req.on('end', () => {
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch {
        resolve({ __raw: raw });
      }
    });
  });

const json = (res, status, body) => {
  const payload = JSON.stringify(body);
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(payload);
};

/**
 * @param {{ port?: number }} [options]
 * @returns {Promise<{ url: string, users: Map<string, object>, close: () => Promise<void>, seedUser: Function }>}
 */
export const startFakeGoTrue = async ({ port = 0 } = {}) => {
  /** @type {Map<string, any>} */
  const users = new Map(); // id → user
  const byEmail = new Map();
  const byPhone = new Map();
  const sessions = new Map(); // access_token → userId
  const refreshTokens = new Map(); // refresh_token → userId
  const recovery = new Map(); // token_hash → userId
  const recoveryByEmail = new Map(); // email → token_hash (dernier émis)
  /*
   * Vérification d'adresse (AUTH-03).
   *
   * GoTrue enverrait un e-mail contenant un lien avec `token_hash`. Ici le
   * jeton est **exposé au test** au lieu d'être envoyé, exactement comme le fait
   * déjà `/recover`. Sans ça, `POST /auth/verify-email` ne pouvait être exercé
   * de bout en bout par aucune recette.
   */
  const emailTokens = new Map(); // token_hash → userId
  const emailTokenByEmail = new Map(); // email → token_hash (dernier émis)
  /**
   * Dernière valeur de `redirect_to` reçue par `POST /resend`.
   *
   * C'est **l'URL que notre code demande** à GoTrue d'utiliser dans l'e-mail.
   * La capturer permet de la confronter aux routes réelles du client web.
   */
  let dernierEmailRedirectTo = null;
  /** Dernier corps reçu par `/resend` — sert au diagnostic en cas d'échec. */
  let dernierCorpsRenvoi = null;

  const publicUser = (user) => ({
    id: user.id,
    aud: 'authenticated',
    role: 'authenticated',
    email: user.email ?? null,
    phone: user.phone ?? null,
    email_confirmed_at: user.emailConfirmedAt ?? null,
    phone_confirmed_at: user.phoneConfirmedAt ?? null,
    confirmed_at: user.emailConfirmedAt ?? null,
    last_sign_in_at: user.lastSignInAt ?? null,
    app_metadata: { provider: 'email', providers: ['email'] },
    user_metadata: user.userMetadata ?? {},
    identities: [],
    created_at: user.createdAt,
    updated_at: new Date().toISOString(),
  });

  const issueSession = (user) => {
    const accessToken = fakeJwt(user.id);
    const refreshToken = `rt_${crypto.randomBytes(16).toString('hex')}`;
    sessions.set(accessToken, user.id);
    refreshTokens.set(refreshToken, user.id);
    user.lastSignInAt = new Date().toISOString();
    return {
      access_token: accessToken,
      token_type: 'bearer',
      expires_in: 3600,
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      refresh_token: refreshToken,
      user: publicUser(user),
    };
  };

  const findUser = ({ email, phone }) =>
    (email ? byEmail.get(String(email).toLowerCase()) : null) ?? (phone ? byPhone.get(String(phone)) : null) ?? null;

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    const pathname = url.pathname.replace(/^\/auth\/v1/, '');
    const body = ['POST', 'PUT', 'PATCH'].includes(req.method) ? await readBody(req) : {};

    // ── Administration (service role) ──────────────────────────────
    if (req.method === 'POST' && pathname === '/admin/users') {
      const email = body.email ? String(body.email).toLowerCase() : null;
      const phone = body.phone ? String(body.phone) : null;

      if ((email && byEmail.has(email)) || (phone && byPhone.has(phone))) {
        return json(res, 422, {
          code: 422,
          error_code: 'email_exists',
          msg: 'User already registered',
        });
      }

      const user = {
        id: crypto.randomUUID(),
        email,
        phone,
        password: body.password,
        userMetadata: body.user_metadata ?? {},
        emailConfirmedAt: body.email_confirm ? new Date().toISOString() : null,
        phoneConfirmedAt: body.phone_confirm ? new Date().toISOString() : null,
        createdAt: new Date().toISOString(),
      };

      users.set(user.id, user);
      if (email) byEmail.set(email, user);
      if (phone) byPhone.set(phone, user);

      return json(res, 200, { user: publicUser(user) });
    }

    if (req.method === 'PUT' && pathname.startsWith('/admin/users/')) {
      const id = pathname.split('/').pop();
      const user = users.get(id);
      if (!user) return json(res, 404, { code: 404, msg: 'User not found' });

      if (body.password) user.password = body.password;
      if (body.email_confirm) user.emailConfirmedAt = new Date().toISOString();
      if (body.phone_confirm) user.phoneConfirmedAt = new Date().toISOString();
      if (body.user_metadata) user.userMetadata = { ...user.userMetadata, ...body.user_metadata };

      return json(res, 200, { user: publicUser(user) });
    }

    /*
     * POST /admin/users/:id/logout — révocation de TOUTES les sessions de
     * l'utilisateur (contrat GoTrue admin « revoke all sessions »). C'est
     * l'opération derrière POST /admin/users/:id/force-logout (M2 U-M2-4).
     */
    if (req.method === 'POST' && /^\/admin\/users\/[^/]+\/logout$/.test(pathname)) {
      const id = pathname.split('/')[3];
      const user = users.get(id);
      if (!user) return json(res, 404, { code: 404, msg: 'User not found' });
      for (const [token, userId] of [...sessions]) if (userId === id) sessions.delete(token);
      for (const [token, userId] of [...refreshTokens]) if (userId === id) refreshTokens.delete(token);
      return json(res, 200, {});
    }
    if (req.method === 'DELETE' && pathname.startsWith('/admin/users/')) {
      const id = pathname.split('/').pop().replace(/^.*\//, '');
      const user = users.get(id);
      if (!user) return json(res, 404, { code: 404, msg: 'User not found' });
      users.delete(id);
      if (user.email) byEmail.delete(user.email);
      if (user.phone) byPhone.delete(user.phone);
      return json(res, 200, {});
    }

    // ── Connexion par mot de passe ─────────────────────────────────
    if (req.method === 'POST' && pathname === '/token' && url.searchParams.get('grant_type') === 'password') {
      const user = findUser(body);
      if (!user || !user.password || user.password !== body.password) {
        return json(res, 400, {
          code: 400,
          error_code: 'invalid_credentials',
          msg: 'Invalid login credentials',
        });
      }
      return json(res, 200, issueSession(user));
    }

    if (req.method === 'POST' && pathname === '/token' && url.searchParams.get('grant_type') === 'refresh_token') {
      const userId = refreshTokens.get(body.refresh_token);
      const user = userId ? users.get(userId) : null;
      if (!user) return json(res, 400, { code: 400, error_code: 'refresh_token_not_found', msg: 'Invalid Refresh Token' });
      refreshTokens.delete(body.refresh_token);
      return json(res, 200, issueSession(user));
    }

    // ── Lecture du porteur du jeton ────────────────────────────────
    if (req.method === 'GET' && pathname === '/user') {
      const token = (req.headers.authorization ?? '').replace(/^Bearer\s+/i, '');
      const userId = sessions.get(token);
      const user = userId ? users.get(userId) : null;
      if (!user) {
        return json(res, 401, { code: 401, error_code: 'bad_jwt', msg: 'invalid claim: missing sub claim' });
      }
      return json(res, 200, { user: publicUser(user) });
    }

    if (req.method === 'POST' && pathname === '/logout') {
      const token = (req.headers.authorization ?? '').replace(/^Bearer\s+/i, '');
      sessions.delete(token);
      return json(res, 204, {});
    }

    // ── Récupération de mot de passe ───────────────────────────────
    if (req.method === 'POST' && pathname === '/recover') {
      const user = findUser({ email: body.email });
      if (user) {
        const tokenHash = `rec_${crypto.randomBytes(8).toString('hex')}`;
        recovery.set(tokenHash, user.id);
        recoveryByEmail.set(String(body.email).toLowerCase(), tokenHash);
        // GoTrue enverrait l'email ; ici le jeton est exposé pour le test.
        return json(res, 200, { recovery_token_hash: tokenHash });
      }
      // Anti-énumération : GoTrue répond 200 même si l'email est inconnu.
      return json(res, 200, {});
    }

    /*
     * `supabase.auth.resend()` appelle **`POST /resend`** — et non `/otp`, comme
     * l'indiquait l'en-tête de ce fichier. La recette e2e l'a révélé :
     * « Stub GoTrue : route non implémentée POST /resend ». Les deux chemins
     * sont traités, car `sendOtp` passe par `/otp`.
     */
    if (req.method === 'POST' && (pathname === '/resend' || pathname === '/otp')) {
      /*
       * Où finit `emailRedirectTo` ? **Ni** dans le corps, **ni** sous
       * `options` : `GoTrueClient.resend()` le passe à `_request({ redirectTo })`,
       * qui en fait un **paramètre de requête** `?redirect_to=…`
       * (`@supabase/auth-js` 2.109.0, `lib/fetch.js`).
       *
       * Le corps reçu ne contient donc que
       * `{ email, type, gotrue_meta_security, code_challenge, … }`. Chercher la
       * valeur dans le corps — ce que faisait la première version de ce stub —
       * donnait systématiquement `null`, et le test concluait à tort que l'API
       * n'envoyait aucune URL.
       */
      dernierEmailRedirectTo = url.searchParams.get('redirect_to') ?? null;
      dernierCorpsRenvoi = { url: req.url, body };

      /*
       * `type: 'signup'` = renvoi du lien de vérification d'adresse. On émet un
       * jeton vérifiable par `/verify`, comme le ferait l'e-mail réel.
       *
       * L'adresse inconnue reste un 200 vide : GoTrue ne révèle pas si un
       * compte existe, et le test d'anti-énumération s'appuie là-dessus.
       */
      if (body.type === 'signup' && body.email) {
        const user = findUser({ email: body.email });
        if (user) {
          const tokenHash = `eml_${crypto.randomBytes(8).toString('hex')}`;
          emailTokens.set(tokenHash, user.id);
          emailTokenByEmail.set(String(body.email).toLowerCase(), tokenHash);
        }
      }
      return json(res, 200, { message_id: `msg_${crypto.randomBytes(6).toString('hex')}` });
    }

    if (req.method === 'POST' && pathname === '/verify') {
      // Le même chemin sert à la récupération et à la vérification d'adresse.
      const userId = recovery.get(body.token_hash) ?? emailTokens.get(body.token_hash);
      if (!userId) return json(res, 403, { code: 403, error_code: 'otp_expired', msg: 'Token has expired or is invalid' });
      const user = users.get(userId);
      recovery.delete(body.token_hash);
      emailTokens.delete(body.token_hash);
      // GoTrue marque l'adresse comme confirmée ; l'API pose `emailVerifiedAt`.
      if (body.type === 'email') user.emailConfirmedAt = new Date().toISOString();
      const session = issueSession(user);
      return json(res, 200, { ...session, type: body.type });
    }

    return json(res, 404, { msg: `Stub GoTrue : route non implémentée ${req.method} ${pathname}` });
  });

  await new Promise((resolve) => server.listen(port, '127.0.0.1', resolve));
  const actualPort = server.address().port;

  return {
    url: `http://127.0.0.1:${actualPort}`,
    users,
    byEmail,
    /** Pré-crée un utilisateur confirmé (utile pour les comptes de test). */
    seedUser: async ({ email, phone = null, password = 'MotDePasse!2026', confirmed = true }) => {
      const user = {
        id: crypto.randomUUID(),
        email,
        phone,
        password,
        userMetadata: {},
        emailConfirmedAt: confirmed ? new Date().toISOString() : null,
        phoneConfirmedAt: confirmed && phone ? new Date().toISOString() : null,
        createdAt: new Date().toISOString(),
      };
      users.set(user.id, user);
      if (email) byEmail.set(email.toLowerCase(), user);
      if (phone) byPhone.set(phone, user);
      return { ...publicUser(user), password };
    },
    /** Émet une session sans passer par le mot de passe (comptes de test). */
    loginAs: (email) => {
      const user = byEmail.get(String(email).toLowerCase());
      if (!user) throw new Error(`Utilisateur inconnu dans le stub : ${email}`);
      return issueSession(user);
    },
    /** Jeton de récupération émis pour cet email (ce que l'email contiendrait). */
    lastRecoveryTokenFor: (email) => recoveryByEmail.get(String(email).toLowerCase()) ?? null,
    /** Jeton de vérification d'adresse émis pour cet email (idem). */
    lastEmailTokenFor: (email) => emailTokenByEmail.get(String(email).toLowerCase()) ?? null,
    /**
     * Dernière URL passée en `email_redirect_to`.
     *
     * C'est ce que notre code demande à GoTrue de mettre dans l'e-mail : le test
     * peut donc la confronter aux routes réelles du client web.
     */
    lastEmailRedirectTo: () => dernierEmailRedirectTo,
    lastResendBody: () => dernierCorpsRenvoi,
    close: () =>
      new Promise((resolve) => {
        server.close(() => resolve());
      }),
  };
};
