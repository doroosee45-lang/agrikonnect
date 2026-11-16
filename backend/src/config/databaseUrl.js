/**
 * Contrôle du mode de connexion à Postgres (Supabase), sans jamais exposer
 * l'adresse : seuls l'hôte de type « pooler », le port et les paramètres sont lus.
 *
 * Le pooler Supabase en mode **session** (port 5432 sur `*.pooler.supabase.com`)
 * réserve une connexion serveur par client, plafonnée par `pool_size` (15 sur
 * l'offre de base) pour TOUT le projet. Chaque processus Prisma ouvre par défaut
 * `2 × CPU + 1` connexions : l'API locale, l'API Render et un script suffisent à
 * atteindre le plafond, et les requêtes échouent en 500
 * (`EMAXCONNSESSION max clients reached in session mode`).
 *
 * À l'exécution, l'API doit passer par le mode **transaction** (port 6543,
 * `pgbouncer=true`) avec un `connection_limit` explicite. `DIRECT_URL` (5432)
 * reste réservée aux migrations.
 *
 * @param {{ DATABASE_URL?: string }} cfg
 * @returns {{ avertissements: string[] }}
 */
export const verifierUrlBase = (cfg) => {
  const avertissements = [];
  let url;
  try {
    url = new URL(String(cfg.DATABASE_URL ?? ''));
  } catch {
    return { avertissements };
  }

  const estPoolerSupabase = url.hostname.endsWith('.pooler.supabase.com');
  const port = url.port || '5432';
  const params = url.searchParams;

  if (estPoolerSupabase && port === '5432') {
    avertissements.push(
      'DATABASE_URL utilise le pooler Supabase en mode session (port 5432) : '
      + 'connexions plafonnées pour tout le projet (EMAXCONNSESSION). '
      + 'Utilise le port 6543 avec ?pgbouncer=true&connection_limit=5.',
    );
  }
  if (estPoolerSupabase && port === '6543' && params.get('pgbouncer') !== 'true') {
    avertissements.push(
      'DATABASE_URL vise le mode transaction (6543) sans pgbouncer=true : '
      + 'Prisma doit désactiver les requêtes préparées (ajoute pgbouncer=true).',
    );
  }
  if (estPoolerSupabase && !params.has('connection_limit')) {
    avertissements.push(
      'DATABASE_URL sans connection_limit : Prisma ouvre 2 × CPU + 1 connexions '
      + 'par processus. Ajoute connection_limit=5.',
    );
  }
  return { avertissements };
};
