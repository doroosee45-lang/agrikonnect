-- Notifications push : registre des appareils (FCM Android, APNs iOS alertes et VoIP).
-- Migration ADDITIVE : un type, une table, index et clé étrangère. Aucune table
-- existante n'est modifiée.
--
-- Pourquoi cette table : aucun registre d'appareils n'existe ; le canal PUSH de
-- NotificationChannel n'avait aucun destinataire technique.
-- CreateEnum
CREATE TYPE "PushProvider" AS ENUM ('FCM', 'APNS', 'APNS_VOIP');

-- CreateTable
CREATE TABLE "push_devices" (
    "id" TEXT NOT NULL,
    "user_id" UUID NOT NULL,
    "provider" "PushProvider" NOT NULL,
    "token" TEXT NOT NULL,
    "installation_id" TEXT NOT NULL,
    "app_version" TEXT,
    "locale" TEXT,
    "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMP(3),
    "revoked_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "push_devices_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "push_devices_user_id_revoked_at_idx" ON "push_devices"("user_id", "revoked_at");

-- CreateIndex
CREATE INDEX "push_devices_installation_id_idx" ON "push_devices"("installation_id");

-- CreateIndex
CREATE UNIQUE INDEX "push_devices_provider_token_key" ON "push_devices"("provider", "token");

-- AddForeignKey
ALTER TABLE "push_devices" ADD CONSTRAINT "push_devices_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Défense en profondeur (convention du projet, contrôlée en CI) : RLS activée
-- sans politique ; aucun privilège pour anon/authenticated (jetons d'appareils).
ALTER TABLE "push_devices" ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    EXECUTE 'REVOKE ALL ON TABLE "push_devices" FROM anon';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE 'REVOKE ALL ON TABLE "push_devices" FROM authenticated';
  END IF;
END $$;