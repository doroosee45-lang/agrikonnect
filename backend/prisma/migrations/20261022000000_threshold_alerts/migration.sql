-- Migration : supervision des recommandations — alertes de seuil, prévisions et capteurs silencieux.
--
-- Le modèle `threshold_alerts` existait mais rien ne l'alimentait. Cette
-- migration lui donne les colonnes dont le job de supervision a besoin :
--
--   • `source_type` distingue ce qui a déclenché la comparaison : une mesure
--     réelle, une **prévision** (alerte préventive), ou le silence d'un capteur.
--     Les trois arrivent dans la même boîte d'alertes de l'agriculteur.
--   • `last_notified_at` + `notification_count` portent la re-notification :
--     une seule alerte par paramètre et par épisode, mais rappelée à intervalle
--     régulier tant qu'elle reste ouverte.
--   • `replacement_recommendation_id` relie l'alerte à la proposition calculée
--     pour la période restante. Celle-ci reste `PENDING` : l'ancienne
--     recommandation demeure `ACTIVE` jusqu'à acceptation explicite.
--
-- La contrainte d'unicité passe de (parcelle, épisode) à (organisation, épisode) :
-- un capteur silencieux peut ne pas encore être rattaché à une parcelle, et en
-- PostgreSQL deux NULL ne se dédoublonnent pas. `episode_key` contenant déjà
-- l'identifiant de la recommandation ou du capteur, l'unicité par organisation
-- reste exacte et continue d'appliquer l'isolation multi-tenant.

-- CreateEnum
CREATE TYPE "AlertSourceType" AS ENUM ('MEASUREMENT', 'FORECAST', 'SENSOR_SILENCE');

-- AlterEnum
ALTER TYPE "RecommendationStatus" ADD VALUE 'PENDING';

-- DropIndex
DROP INDEX "threshold_alerts_plot_id_episode_key_key";

-- AlterTable
ALTER TABLE "threshold_alerts" ADD COLUMN     "device_id" TEXT,
ADD COLUMN     "last_notified_at" TIMESTAMP(3),
ADD COLUMN     "notification_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "observed_at" TIMESTAMP(3),
ADD COLUMN     "replacement_recommendation_id" TEXT,
ADD COLUMN     "source_type" "AlertSourceType" NOT NULL DEFAULT 'MEASUREMENT',
ALTER COLUMN "plot_id" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "threshold_alerts_organization_id_source_type_status_idx" ON "threshold_alerts"("organization_id", "source_type", "status");

-- CreateIndex
CREATE UNIQUE INDEX "threshold_alerts_organization_id_episode_key_key" ON "threshold_alerts"("organization_id", "episode_key");

-- AddForeignKey
ALTER TABLE "threshold_alerts" ADD CONSTRAINT "threshold_alerts_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "iot_devices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "threshold_alerts" ADD CONSTRAINT "threshold_alerts_replacement_recommendation_id_fkey" FOREIGN KEY ("replacement_recommendation_id") REFERENCES "crop_recommendations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
