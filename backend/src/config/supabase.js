import { createClient } from '@supabase/supabase-js';
import ws from 'ws';
import { env } from './env.js';

/**
 * Node 20 n'expose pas de WebSocket natif : `ws` est fourni explicitement
 * comme transport. Le backend n'utilise pas Supabase Realtime (les échanges
 * temps réel passeront par Socket.IO en V2), mais le client l'initialise.
 */
const commonOptions = {
  auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  realtime: { transport: ws },
};

/**
 * Client « public » : vérification des tokens utilisateurs et opérations
 * d'authentification (signIn, signUp, reset…). Respecte les politiques RLS.
 */
export const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, commonOptions);

/**
 * Client « admin » (service role) : contourne les RLS.
 * ⚠️ Ne JAMAIS l'exposer au front-end. Côté serveur uniquement :
 * création d'utilisateurs, suppression, URLs signées du stockage.
 */
export const supabaseAdmin = env.SUPABASE_SERVICE_ROLE_KEY
  ? createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, commonOptions)
  : null;
