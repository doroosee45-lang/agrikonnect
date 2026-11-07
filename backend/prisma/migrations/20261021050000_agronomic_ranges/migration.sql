-- Migration : référentiel agronomique en base (plages par culture et paramètre).
--
-- Le référentiel quitte le code pour la base : un agronome doit pouvoir le
-- renseigner et le valider sans redéploiement. Chaque plage porte son statut,
-- sa source, et une fois validée, qui l'a validée et quand.
--
-- `dataset_label` sépare les lots : 'production' par défaut, les jeux de test
-- utilisent une autre étiquette et ne peuvent pas polluer la production.

-- CreateEnum
CREATE TYPE "RangeStatus" AS ENUM ('PROVISIONAL', 'VALIDATED', 'RETIRED');

-- CreateTable
CREATE TABLE "crop_agronomic_ranges" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT,
    "crop_slug" TEXT NOT NULL,
    "parameter_key" TEXT NOT NULL,
    "min_value" DOUBLE PRECISION NOT NULL,
    "max_value" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL,
    "status" "RangeStatus" NOT NULL DEFAULT 'PROVISIONAL',
    "source_reference" TEXT,
    "source_note" TEXT,
    "dataset_label" TEXT NOT NULL DEFAULT 'production',
    "validated_by" TEXT,
    "validated_at" TIMESTAMP(3),
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "crop_agronomic_ranges_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "crop_agronomic_ranges_crop_slug_status_idx" ON "crop_agronomic_ranges"("crop_slug", "status");

-- CreateIndex
CREATE INDEX "crop_agronomic_ranges_dataset_label_status_idx" ON "crop_agronomic_ranges"("dataset_label", "status");

-- CreateIndex
CREATE INDEX "crop_agronomic_ranges_organization_id_crop_slug_idx" ON "crop_agronomic_ranges"("organization_id", "crop_slug");

-- CreateIndex
CREATE UNIQUE INDEX "crop_agronomic_ranges_crop_slug_parameter_key_dataset_label_key" ON "crop_agronomic_ranges"("crop_slug", "parameter_key", "dataset_label", "organization_id");

-- AddForeignKey
ALTER TABLE "crop_agronomic_ranges" ADD CONSTRAINT "crop_agronomic_ranges_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

