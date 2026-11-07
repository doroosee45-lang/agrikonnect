-- Migration : diagnostics de sol produits par le moteur géospatial Python (geoai/)
-- Aucune donnée existante n'est modifiée : ajout d'une table d'historique
-- append-only (les diagnostics ne sont jamais écrasés).

CREATE TABLE "soil_diagnostics" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "plot_id" TEXT NOT NULL,
    "country_code" CHAR(2),
    "engine" TEXT NOT NULL,
    "engine_version" TEXT NOT NULL,
    "method_version" TEXT NOT NULL,
    "inputs" JSONB NOT NULL,
    "result" JSONB NOT NULL,
    "confidence" DOUBLE PRECISION,
    "confidence_level" TEXT,
    "sources_used" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "source" "Source" NOT NULL DEFAULT 'derived',
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "soil_diagnostics_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "soil_diagnostics_organization_id_plot_id_idx" ON "soil_diagnostics"("organization_id", "plot_id");
CREATE INDEX "soil_diagnostics_plot_id_created_at_idx" ON "soil_diagnostics"("plot_id", "created_at");

ALTER TABLE "soil_diagnostics"
    ADD CONSTRAINT "soil_diagnostics_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "soil_diagnostics"
    ADD CONSTRAINT "soil_diagnostics_plot_id_fkey"
    FOREIGN KEY ("plot_id") REFERENCES "plots"("id") ON DELETE CASCADE ON UPDATE CASCADE;
