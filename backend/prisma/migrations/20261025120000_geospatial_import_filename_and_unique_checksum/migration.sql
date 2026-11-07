-- Dépôt de fichiers géospatiaux : nom d'origine assaini + refus de doublon.
--
-- 1) `filename` — le nom fourni par le client, assaini, conservé pour
--    l'affichage. La clé de stockage (`storage_key`) reste construite côté
--    serveur et ne contient jamais ce nom.
--
-- 2) Contrainte d'unicité sur (organization_id, checksum) — le refus de doublon
--    exact doit survivre à une course : deux dépôts identiques arrivant en même
--    temps passeraient tous deux le contrôle applicatif `findFirst`. La base
--    tranche. Portée à l'organisation : le même relevé déposé par deux
--    organisations distinctes reste légitime.
--
-- `checksum` est nullable ; PostgreSQL autorise plusieurs NULL dans une colonne
-- unique. C'est le comportement voulu : sans somme de contrôle on ne peut pas
-- affirmer qu'il y a doublon. Le service en calcule toujours une.

-- AlterTable
ALTER TABLE "geospatial_imports" ADD COLUMN "filename" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "geospatial_imports_organization_id_checksum_key" ON "geospatial_imports"("organization_id", "checksum");
