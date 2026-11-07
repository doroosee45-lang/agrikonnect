-- GLB-03 / V5:NFR-04 — résidence des données exigée par chaque pays.
-- JSON : { region, provider, attestationRef, verifiedAt }.
ALTER TABLE "countries" ADD COLUMN "hosting" JSONB;

COMMENT ON COLUMN "countries"."hosting" IS
  'GLB-03 / V5:NFR-04 — résidence des données exigée par le pays (region, provider, attestationRef, verifiedAt)';
