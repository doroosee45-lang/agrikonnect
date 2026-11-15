import { PrismaClient } from '@prisma/client';

const BOOTSTRAP_ROLES_SQL = `
DO $ensure_roles$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'anon'
  ) THEN
    EXECUTE 'CREATE ROLE anon NOLOGIN';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'authenticated'
  ) THEN
    EXECUTE 'CREATE ROLE authenticated NOLOGIN';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'postgres'
  ) THEN
    EXECUTE 'CREATE ROLE postgres NOLOGIN';
  END IF;
END;
$ensure_roles$;
`;

export async function ensureLocalSupabaseRoles(databaseUrl) {
  const prisma = new PrismaClient({
    datasources: { db: { url: databaseUrl } },
  });

  try {
    await prisma.$executeRawUnsafe(BOOTSTRAP_ROLES_SQL);
  } finally {
    await prisma.$disconnect();
  }
}
