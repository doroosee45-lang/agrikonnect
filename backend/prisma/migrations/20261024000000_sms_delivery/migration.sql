-- Étape E — fournisseur SMS Twilio : consentement, envoi, suivi de remise,
-- garde-fous de coût.
--
-- Trois tables, une par obligation :
--   sms_consents   → prouver que le destinataire a accepté (canal à sens
--                    unique : aucun « STOP » par SMS n'est possible) ;
--   sms_messages   → prouver la remise et compter le coût ;
--   sms_batch_logs → compter un lot d'alertes, y compris ce qui a été retenu.

CREATE TYPE "SmsDeliveryStatus" AS ENUM (
  'QUEUED_LOCALLY',
  'QUEUED',
  'SENT',
  'DELIVERED',
  'UNDELIVERED',
  'FAILED',
  'UNKNOWN'
);

CREATE TYPE "SmsConsentStatus" AS ENUM ('GRANTED', 'WITHDRAWN');

CREATE TYPE "SmsSkipReason" AS ENUM (
  'NO_CONSENT',
  'CONSENT_WITHDRAWN',
  'DAILY_LIMIT',
  'PREFERENCE_DISABLED',
  'NO_PHONE'
);

CREATE TABLE "sms_consents" (
  "id"              TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "user_id"         TEXT NOT NULL,
  "purpose"         TEXT NOT NULL,
  "status"          "SmsConsentStatus" NOT NULL DEFAULT 'GRANTED',
  "method"          TEXT NOT NULL DEFAULT 'IN_APP',
  "granted_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "withdrawn_at"    TIMESTAMP(3),
  "notice_version"  TEXT,
  "created_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"      TIMESTAMP(3) NOT NULL,

  CONSTRAINT "sms_consents_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "sms_consents_organization_id_user_id_purpose_key"
  ON "sms_consents"("organization_id", "user_id", "purpose");
CREATE INDEX "sms_consents_organization_id_status_idx"
  ON "sms_consents"("organization_id", "status");

CREATE TABLE "sms_messages" (
  "id"                  TEXT NOT NULL,
  "organization_id"     TEXT NOT NULL,
  "user_id"             TEXT,
  "phone"               TEXT NOT NULL,
  "body"                TEXT NOT NULL,
  "sender_id"           TEXT NOT NULL,
  "purpose"             TEXT NOT NULL DEFAULT 'ALERT',
  "provider"            TEXT NOT NULL DEFAULT 'twilio',
  "provider_message_id" TEXT,
  "status"              "SmsDeliveryStatus" NOT NULL DEFAULT 'QUEUED_LOCALLY',
  "raw_status"          TEXT,
  "segments"            INTEGER NOT NULL DEFAULT 1,
  "encoding"            TEXT,
  "character_count"     INTEGER,
  "batch_id"            TEXT,
  "alert_id"            TEXT,
  "consent_snapshot"    JSONB,
  "error_code"          TEXT,
  "error_message"       TEXT,
  "status_history"      JSONB,
  "sent_at"             TIMESTAMP(3),
  "last_status_at"      TIMESTAMP(3),
  "mode"                "DataMode" NOT NULL DEFAULT 'REAL',
  "created_at"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"          TIMESTAMP(3) NOT NULL,
  "deleted_at"          TIMESTAMP(3),
  "version"             INTEGER NOT NULL DEFAULT 1,

  CONSTRAINT "sms_messages_pkey" PRIMARY KEY ("id")
);

-- Unicité sur l'identifiant fournisseur : deux webhooks pour le même message
-- ne doivent pas créer deux lignes. NULL multiples sont permis par PostgreSQL,
-- ce qui est voulu : plusieurs messages locaux peuvent n'avoir pas encore
-- d'identifiant fournisseur.
CREATE UNIQUE INDEX "sms_messages_provider_message_id_key"
  ON "sms_messages"("provider_message_id");
CREATE INDEX "sms_messages_organization_id_user_id_purpose_created_at_idx"
  ON "sms_messages"("organization_id", "user_id", "purpose", "created_at");
CREATE INDEX "sms_messages_organization_id_batch_id_idx"
  ON "sms_messages"("organization_id", "batch_id");
CREATE INDEX "sms_messages_organization_id_status_idx"
  ON "sms_messages"("organization_id", "status");

CREATE TABLE "sms_batch_logs" (
  "id"                TEXT NOT NULL,
  "organization_id"   TEXT NOT NULL,
  "batch_id"          TEXT NOT NULL,
  "candidates"        INTEGER NOT NULL DEFAULT 0,
  "sent"              INTEGER NOT NULL DEFAULT 0,
  "skipped"           INTEGER NOT NULL DEFAULT 0,
  "failed"            INTEGER NOT NULL DEFAULT 0,
  "skipped_by_reason" JSONB,
  "total_segments"    INTEGER NOT NULL DEFAULT 0,
  "started_at"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finished_at"       TIMESTAMP(3),
  "mode"              "DataMode" NOT NULL DEFAULT 'REAL',
  "created_at"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "sms_batch_logs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "sms_batch_logs_batch_id_key" ON "sms_batch_logs"("batch_id");
CREATE INDEX "sms_batch_logs_organization_id_started_at_idx"
  ON "sms_batch_logs"("organization_id", "started_at");
