-- ADMIN-GOV-01 — SPEC-SUPER-ADMIN §7.2
-- Journal immuable des changements de paramètres (M3) + index de recherche
-- pour l'audit avancé (M6) et la matrice des rôles (M2).

-- Journal des révisions de paramètres : insertion seule, aucune mise à jour.
CREATE TABLE "settings_revisions" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "previous_value" JSONB,
    "new_value" JSONB,
    "changed_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "settings_revisions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "settings_revisions_key_created_at_idx" ON "settings_revisions"("key", "created_at");

-- Recherche du journal d'audit par action + période (M6).
CREATE INDEX "audit_logs_action_created_at_idx" ON "audit_logs"("action", "created_at");

-- Filtres par rôle dans la gestion des utilisateurs et le dashboard (M2/M1).
CREATE INDEX "memberships_roles_idx" ON "memberships" USING GIN ("roles");