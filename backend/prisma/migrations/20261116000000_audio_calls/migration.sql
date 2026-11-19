-- Module d'appels audio (LiveKit Cloud transporte l'audio ; PostgreSQL décide).
-- Migration ADDITIVE : trois types, trois tables, index et clés étrangères.
-- Aucune table existante n'est modifiée.
--
-- Pourquoi ces tables (les structures existantes ne suffisent pas) :
--   call_sessions     : cycle de vie temporel d'un appel (Conversation n'en a pas) ;
--   call_participants : personnes invitées (Conversation relie des organisations) ;
--   call_events       : transitions + déduplication DURABLE des webhooks
--                       (IdempotencyKey expire après 24 h).
-- CreateEnum
CREATE TYPE "CallKind" AS ENUM ('DIRECT', 'GROUP');

-- CreateEnum
CREATE TYPE "CallStatus" AS ENUM ('RINGING', 'ACTIVE', 'ENDED', 'CANCELLED', 'DECLINED', 'MISSED');

-- CreateEnum
CREATE TYPE "CallParticipantStatus" AS ENUM ('INVITED', 'ACCEPTED', 'DECLINED', 'JOINED', 'LEFT', 'MISSED', 'CANCELLED');

-- CreateTable
CREATE TABLE "call_sessions" (
    "id" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "kind" "CallKind" NOT NULL,
    "status" "CallStatus" NOT NULL DEFAULT 'RINGING',
    "room_name" TEXT NOT NULL,
    "created_by" UUID NOT NULL,
    "caller_organization_id" TEXT NOT NULL,
    "ring_expires_at" TIMESTAMP(3) NOT NULL,
    "started_at" TIMESTAMP(3),
    "ended_at" TIMESTAMP(3),
    "end_reason" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "call_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "call_participants" (
    "id" TEXT NOT NULL,
    "call_id" TEXT NOT NULL,
    "user_id" UUID NOT NULL,
    "organization_id" TEXT NOT NULL,
    "is_host" BOOLEAN NOT NULL DEFAULT false,
    "status" "CallParticipantStatus" NOT NULL,
    "invited_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "responded_at" TIMESTAMP(3),
    "joined_at" TIMESTAMP(3),
    "left_at" TIMESTAMP(3),

    CONSTRAINT "call_participants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "call_events" (
    "id" TEXT NOT NULL,
    "call_id" TEXT,
    "source" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "external_id" TEXT,
    "actor_id" UUID,
    "from_status" TEXT,
    "to_status" TEXT,
    "details" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "call_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "call_sessions_room_name_key" ON "call_sessions"("room_name");

-- CreateIndex
CREATE INDEX "call_sessions_conversation_id_created_at_idx" ON "call_sessions"("conversation_id", "created_at");

-- CreateIndex
CREATE INDEX "call_sessions_status_ring_expires_at_idx" ON "call_sessions"("status", "ring_expires_at");

-- CreateIndex
CREATE INDEX "call_sessions_created_by_status_idx" ON "call_sessions"("created_by", "status");

-- CreateIndex
CREATE INDEX "call_participants_user_id_status_idx" ON "call_participants"("user_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "call_participants_call_id_user_id_key" ON "call_participants"("call_id", "user_id");

-- CreateIndex
CREATE INDEX "call_events_call_id_created_at_idx" ON "call_events"("call_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "call_events_source_external_id_key" ON "call_events"("source", "external_id");

-- AddForeignKey
ALTER TABLE "call_sessions" ADD CONSTRAINT "call_sessions_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "call_sessions" ADD CONSTRAINT "call_sessions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "call_participants" ADD CONSTRAINT "call_participants_call_id_fkey" FOREIGN KEY ("call_id") REFERENCES "call_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "call_participants" ADD CONSTRAINT "call_participants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "call_participants" ADD CONSTRAINT "call_participants_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "call_events" ADD CONSTRAINT "call_events_call_id_fkey" FOREIGN KEY ("call_id") REFERENCES "call_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Défense en profondeur (convention du projet, contrôlée en CI) : RLS activée
-- SANS politique — refus par défaut pour anon/authenticated ; l'API passe par
-- le rôle propriétaire. Aucun privilège pour anon/authenticated.
ALTER TABLE "call_sessions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "call_participants" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "call_events" ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    EXECUTE 'REVOKE ALL ON TABLE "call_sessions", "call_participants", "call_events" FROM anon';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE 'REVOKE ALL ON TABLE "call_sessions", "call_participants", "call_events" FROM authenticated';
  END IF;
END $$;