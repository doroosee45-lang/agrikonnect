-- Escalade des alertes à deux niveaux.
--
-- Niveau 1 : l'exploitant, notifié au déclenchement. Niveau 2, après le délai
-- configuré sans traitement : le rôle d'encadrement. `escalated_at` est la
-- marque d'idempotence : sans elle, chaque passage de la tâche relancerait le
-- niveau 2 indéfiniment.
ALTER TABLE "threshold_alerts"
    ADD COLUMN "escalation_level" INTEGER NOT NULL DEFAULT 1,
    ADD COLUMN "escalated_at" TIMESTAMP(3);

-- La tâche d'escalade filtre sur (organisation, niveau, statut) : sans index,
-- chaque passage balayerait toutes les alertes de l'organisation.
CREATE INDEX "threshold_alerts_org_level_status_idx"
    ON "threshold_alerts"("organization_id", "escalation_level", "status");
