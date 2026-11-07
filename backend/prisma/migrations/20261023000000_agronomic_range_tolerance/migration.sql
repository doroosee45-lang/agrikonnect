-- Migration : quatre limites au lieu de deux pour les plages agronomiques.
--
-- Le tableau « Plages agronomiques » distingue la **plage idéale** (déjà
-- stockée dans `min_value` / `max_value`) d'une **plage tolérée** plus large.
-- Sans ces deux bornes supplémentaires, une valeur légèrement hors de l'idéal
-- et une valeur franchement inadéquate reçoivent le même verdict binaire.
--
-- Les quatre limites sont facultatives et nulles par défaut : les lignes
-- existantes ne sont pas modifiées, et le moteur continue de se comporter comme
-- avant (satisfait ou non) tant que la plage tolérée n'est pas renseignée.
-- Aucune limite n'est inventée pour compléter une ligne incomplète.
--
-- La cohérence toléré_min ≤ idéal_min ≤ idéal_max ≤ toléré_max est vérifiée
-- dans le service (`assertCoherent`), pas par une contrainte SQL : le message
-- d'erreur doit nommer le paramètre et la culture concernés, ce qu'une
-- contrainte de table ne peut pas faire.
--
-- `source_type` classe la provenance (agronome, publication, pilote). La
-- colonne est nullable : une plage enregistrée avant cette migration n'a pas de
-- type déclaré, et lui en attribuer un d'office serait une invention.
--
-- `scientific_name` et `zone` portent deux colonnes du tableau qui n'avaient
-- aucun équivalent en base.

-- CreateEnum
CREATE TYPE "RangeSourceType" AS ENUM ('AGRONOMIST', 'PUBLICATION', 'PILOT');

-- AlterTable
ALTER TABLE "crop_agronomic_ranges" ADD COLUMN "scientific_name" TEXT;
ALTER TABLE "crop_agronomic_ranges" ADD COLUMN "tolerated_min" DOUBLE PRECISION;
ALTER TABLE "crop_agronomic_ranges" ADD COLUMN "tolerated_max" DOUBLE PRECISION;
ALTER TABLE "crop_agronomic_ranges" ADD COLUMN "source_type" "RangeSourceType";
ALTER TABLE "crop_agronomic_ranges" ADD COLUMN "zone" TEXT;
