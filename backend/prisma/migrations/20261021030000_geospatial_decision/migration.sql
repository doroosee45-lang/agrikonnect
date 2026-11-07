-- Migration : géospatial décisionnel — recommandation culturale, surveillance,
-- prévision, interpolation, anomalies de capteur, retours de saison, registre
-- des modèles d'IA, imports GPR/drone.
--
-- Aucune table existante n'est supprimée. `sensor_readings` reçoit des colonnes
-- **optionnelles** (profondeur, position, confiance, source, parcelle) : les
-- lignes déjà présentes restent valides.

-- CreateEnum
CREATE TYPE "RecommendationStatus" AS ENUM ('ACTIVE', 'SUPERSEDED', 'REJECTED', 'COMPLETED', 'INSUFFICIENT_DATA');

-- CreateEnum
CREATE TYPE "AlertSeverity" AS ENUM ('INFO', 'WARNING', 'CRITICAL');

-- CreateEnum
CREATE TYPE "AlertStatus" AS ENUM ('NEW', 'READ', 'HANDLED');

-- CreateEnum
CREATE TYPE "AnomalyReason" AS ENUM ('OUT_OF_RANGE', 'IMPOSSIBLE_JUMP', 'FROZEN_VALUE', 'STATISTICAL_OUTLIER', 'SILENT');

-- CreateEnum
CREATE TYPE "AnomalyStatus" AS ENUM ('NEW', 'CONFIRMED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "ModelKind" AS ENUM ('INTERPOLATION', 'FORECAST', 'ANOMALY', 'ZONES', 'GPR', 'RECOMMENDATION');

-- CreateEnum
CREATE TYPE "ModelStatus" AS ENUM ('TESTING', 'PRODUCTION', 'RETIRED');

-- CreateEnum
CREATE TYPE "ImportKind" AS ENUM ('GPR', 'DRONE_IMAGE', 'SATELLITE', 'LAB_FILE');

-- CreateEnum
CREATE TYPE "ImportStatus" AS ENUM ('RECEIVED', 'PROCESSING', 'COMPLETED', 'ERROR');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "Source" ADD VALUE 'measured_gpr';
ALTER TYPE "Source" ADD VALUE 'model_predicted';

-- AlterTable
ALTER TABLE "sensor_readings" ADD COLUMN     "confidence" "Confidence",
ADD COLUMN     "depth_cm" DOUBLE PRECISION,
ADD COLUMN     "organization_id" TEXT,
ADD COLUMN     "plot_id" TEXT,
ADD COLUMN     "position" JSONB,
ADD COLUMN     "source" "Source";

-- CreateTable
CREATE TABLE "crop_recommendations" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "plot_id" TEXT NOT NULL,
    "period_start" TIMESTAMP(3) NOT NULL,
    "period_end" TIMESTAMP(3) NOT NULL,
    "requested_days" INTEGER NOT NULL,
    "status" "RecommendationStatus" NOT NULL DEFAULT 'ACTIVE',
    "scores" JSONB NOT NULL,
    "reference_measurements" JSONB NOT NULL,
    "thresholds" JSONB NOT NULL,
    "decomposition" JSONB,
    "explanation" JSONB,
    "rule_set_version" TEXT,
    "model_version_id" TEXT,
    "confidence" DOUBLE PRECISION,
    "sources" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "insufficiency_reason" TEXT,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "crop_recommendations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "threshold_alerts" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "plot_id" TEXT NOT NULL,
    "recommendation_id" TEXT,
    "parameter" TEXT NOT NULL,
    "reference_value" DOUBLE PRECISION NOT NULL,
    "observed_value" DOUBLE PRECISION,
    "deviation" DOUBLE PRECISION,
    "severity" "AlertSeverity" NOT NULL DEFAULT 'WARNING',
    "status" "AlertStatus" NOT NULL DEFAULT 'NEW',
    "episode_key" TEXT NOT NULL,
    "channels_sent" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "notified_at" TIMESTAMP(3),
    "predicted_breach_at" TIMESTAMP(3),
    "predictive" BOOLEAN NOT NULL DEFAULT false,
    "confidence" DOUBLE PRECISION,
    "message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "threshold_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "soil_predictions" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "plot_id" TEXT NOT NULL,
    "parameter" TEXT NOT NULL,
    "depth_cm" DOUBLE PRECISION,
    "horizon_days" INTEGER NOT NULL,
    "values" JSONB NOT NULL,
    "mae" DOUBLE PRECISION,
    "rmse" DOUBLE PRECISION,
    "baseline_mae" DOUBLE PRECISION,
    "beats_baseline" BOOLEAN,
    "model_version_id" TEXT,
    "computed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "soil_predictions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "interpolated_maps" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "plot_id" TEXT NOT NULL,
    "parameter" TEXT NOT NULL,
    "depth_cm" DOUBLE PRECISION,
    "method" TEXT NOT NULL,
    "grid_size" INTEGER NOT NULL,
    "values" JSONB NOT NULL,
    "uncertainty" JSONB NOT NULL,
    "sondes_used" INTEGER NOT NULL,
    "leave_one_out_mae" DOUBLE PRECISION,
    "model_version_id" TEXT,
    "computed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "interpolated_maps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sensor_anomalies" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "device_id" TEXT NOT NULL,
    "reading_id" TEXT,
    "reason" "AnomalyReason" NOT NULL,
    "severity" "AlertSeverity" NOT NULL DEFAULT 'WARNING',
    "status" "AnomalyStatus" NOT NULL DEFAULT 'NEW',
    "details" JSONB NOT NULL,
    "detected_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewed_by" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sensor_anomalies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "season_feedback" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "plot_id" TEXT NOT NULL,
    "crop_id" TEXT NOT NULL,
    "recommendation_id" TEXT,
    "season" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "period_start" TIMESTAMP(3) NOT NULL,
    "period_end" TIMESTAMP(3) NOT NULL,
    "actual_yield_kg" DOUBLE PRECISION NOT NULL,
    "area_ha" DOUBLE PRECISION,
    "unit" TEXT,
    "observations" TEXT,
    "source" "Source" NOT NULL DEFAULT 'declared',
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "season_feedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_model_versions" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT,
    "name" TEXT NOT NULL,
    "kind" "ModelKind" NOT NULL,
    "version" TEXT NOT NULL,
    "trained_at" TIMESTAMP(3),
    "dataset_description" TEXT NOT NULL,
    "metrics" JSONB NOT NULL,
    "baseline_metrics" JSONB,
    "beats_baseline" BOOLEAN,
    "status" "ModelStatus" NOT NULL DEFAULT 'TESTING',
    "artifact_key" TEXT,
    "trained_by" TEXT,
    "promoted_by" TEXT,
    "promoted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_model_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "geospatial_imports" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "plot_id" TEXT,
    "device_id" TEXT,
    "kind" "ImportKind" NOT NULL,
    "format" TEXT NOT NULL,
    "storage_key" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "checksum" TEXT,
    "status" "ImportStatus" NOT NULL DEFAULT 'RECEIVED',
    "error_message" TEXT,
    "result" JSONB,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "geospatial_imports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "crop_recommendations_organization_id_plot_id_status_idx" ON "crop_recommendations"("organization_id", "plot_id", "status");

-- CreateIndex
CREATE INDEX "crop_recommendations_plot_id_period_end_idx" ON "crop_recommendations"("plot_id", "period_end");

-- CreateIndex
CREATE INDEX "threshold_alerts_organization_id_status_idx" ON "threshold_alerts"("organization_id", "status");

-- CreateIndex
CREATE INDEX "threshold_alerts_plot_id_created_at_idx" ON "threshold_alerts"("plot_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "threshold_alerts_plot_id_episode_key_key" ON "threshold_alerts"("plot_id", "episode_key");

-- CreateIndex
CREATE INDEX "soil_predictions_plot_id_parameter_computed_at_idx" ON "soil_predictions"("plot_id", "parameter", "computed_at");

-- CreateIndex
CREATE INDEX "soil_predictions_organization_id_computed_at_idx" ON "soil_predictions"("organization_id", "computed_at");

-- CreateIndex
CREATE INDEX "interpolated_maps_plot_id_parameter_computed_at_idx" ON "interpolated_maps"("plot_id", "parameter", "computed_at");

-- CreateIndex
CREATE INDEX "sensor_anomalies_device_id_detected_at_idx" ON "sensor_anomalies"("device_id", "detected_at");

-- CreateIndex
CREATE INDEX "sensor_anomalies_organization_id_status_idx" ON "sensor_anomalies"("organization_id", "status");

-- CreateIndex
CREATE INDEX "season_feedback_plot_id_year_season_idx" ON "season_feedback"("plot_id", "year", "season");

-- CreateIndex
CREATE INDEX "season_feedback_organization_id_crop_id_idx" ON "season_feedback"("organization_id", "crop_id");

-- CreateIndex
CREATE INDEX "ai_model_versions_kind_status_idx" ON "ai_model_versions"("kind", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ai_model_versions_name_version_key" ON "ai_model_versions"("name", "version");

-- CreateIndex
CREATE INDEX "geospatial_imports_organization_id_status_idx" ON "geospatial_imports"("organization_id", "status");

-- CreateIndex
CREATE INDEX "geospatial_imports_plot_id_created_at_idx" ON "geospatial_imports"("plot_id", "created_at");

-- CreateIndex
CREATE INDEX "sensor_readings_plot_id_metric_depth_cm_at_idx" ON "sensor_readings"("plot_id", "metric", "depth_cm", "at");

-- AddForeignKey
ALTER TABLE "crop_recommendations" ADD CONSTRAINT "crop_recommendations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crop_recommendations" ADD CONSTRAINT "crop_recommendations_plot_id_fkey" FOREIGN KEY ("plot_id") REFERENCES "plots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crop_recommendations" ADD CONSTRAINT "crop_recommendations_model_version_id_fkey" FOREIGN KEY ("model_version_id") REFERENCES "ai_model_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "threshold_alerts" ADD CONSTRAINT "threshold_alerts_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "threshold_alerts" ADD CONSTRAINT "threshold_alerts_plot_id_fkey" FOREIGN KEY ("plot_id") REFERENCES "plots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "threshold_alerts" ADD CONSTRAINT "threshold_alerts_recommendation_id_fkey" FOREIGN KEY ("recommendation_id") REFERENCES "crop_recommendations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "soil_predictions" ADD CONSTRAINT "soil_predictions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "soil_predictions" ADD CONSTRAINT "soil_predictions_plot_id_fkey" FOREIGN KEY ("plot_id") REFERENCES "plots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "soil_predictions" ADD CONSTRAINT "soil_predictions_model_version_id_fkey" FOREIGN KEY ("model_version_id") REFERENCES "ai_model_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interpolated_maps" ADD CONSTRAINT "interpolated_maps_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interpolated_maps" ADD CONSTRAINT "interpolated_maps_plot_id_fkey" FOREIGN KEY ("plot_id") REFERENCES "plots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interpolated_maps" ADD CONSTRAINT "interpolated_maps_model_version_id_fkey" FOREIGN KEY ("model_version_id") REFERENCES "ai_model_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sensor_anomalies" ADD CONSTRAINT "sensor_anomalies_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sensor_anomalies" ADD CONSTRAINT "sensor_anomalies_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "iot_devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sensor_anomalies" ADD CONSTRAINT "sensor_anomalies_reading_id_fkey" FOREIGN KEY ("reading_id") REFERENCES "sensor_readings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "season_feedback" ADD CONSTRAINT "season_feedback_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "season_feedback" ADD CONSTRAINT "season_feedback_plot_id_fkey" FOREIGN KEY ("plot_id") REFERENCES "plots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "season_feedback" ADD CONSTRAINT "season_feedback_crop_id_fkey" FOREIGN KEY ("crop_id") REFERENCES "crops"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "season_feedback" ADD CONSTRAINT "season_feedback_recommendation_id_fkey" FOREIGN KEY ("recommendation_id") REFERENCES "crop_recommendations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_model_versions" ADD CONSTRAINT "ai_model_versions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "geospatial_imports" ADD CONSTRAINT "geospatial_imports_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "geospatial_imports" ADD CONSTRAINT "geospatial_imports_plot_id_fkey" FOREIGN KEY ("plot_id") REFERENCES "plots"("id") ON DELETE SET NULL ON UPDATE CASCADE;

