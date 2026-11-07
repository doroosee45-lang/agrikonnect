/**
 * Réglages d'environnement pour les tests unitaires — posés AVANT tout import
 * applicatif.
 *
 * Les modules de `src/` chargent `config/env.js` à l'import, qui applique
 * `.env` et refuse de démarrer si la configuration de messagerie est
 * incomplète (process.exit(1)). Un `.env` local en cours de réglage (Twilio
 * pas encore configuré, EMAIL_FROM manquant…) tuerait alors le fichier de test
 * entier avant la moindre assertion. La messagerie n'a rien à voir avec ce que
 * ces tests vérifient : on la fige donc à « console ».
 */
process.env.SMS_PROVIDER = 'console';
process.env.EMAIL_PROVIDER = 'console';

// Filet de sécurité : si .env ne fournit pas les valeurs minimales du schéma,
// des valeurs factices suffisent — aucun test ne parle à ces services.
process.env.DATABASE_URL ??= 'postgresql://agrikon:test@127.0.0.1:54321/test';
process.env.SUPABASE_URL ??= 'http://127.0.0.1:54321';
process.env.SUPABASE_ANON_KEY ??= 'cle-anon-de-test';
