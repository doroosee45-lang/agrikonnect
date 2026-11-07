-- Migration : marquage de l'origine des valeurs géospatiales (DataMode).
--
-- Trois modes : REAL (équipement physique connecté), CONFIGURATION (équipement
-- enregistré, pas encore en service), SIMULATED (valeur générée).
--
-- La colonne est NOT NULL DEFAULT 'REAL' : les lignes déjà présentes restent
-- valides et continuent d'être traitées comme des mesures réelles. Le refus
-- d'écrire du SIMULATED en production est appliqué côté applicatif
-- (src/shared/dataMode.js), pas par la base.

-- CreateEnum
CREATE TYPE "DataMode" AS ENUM ('REAL', 'CONFIGURATION', 'SIMULATED');

-- AlterTable
ALTER TABLE "crop_recommendations" ADD COLUMN     "mode" "DataMode" NOT NULL DEFAULT 'REAL';

-- AlterTable
ALTER TABLE "drone_surveys" ADD COLUMN     "mode" "DataMode" NOT NULL DEFAULT 'REAL';

-- AlterTable
ALTER TABLE "geospatial_imports" ADD COLUMN     "mode" "DataMode" NOT NULL DEFAULT 'REAL';

-- AlterTable
ALTER TABLE "interpolated_maps" ADD COLUMN     "mode" "DataMode" NOT NULL DEFAULT 'REAL';

-- AlterTable
ALTER TABLE "management_zones" ADD COLUMN     "mode" "DataMode" NOT NULL DEFAULT 'REAL';

-- AlterTable
ALTER TABLE "satellite_observations" ADD COLUMN     "mode" "DataMode" NOT NULL DEFAULT 'REAL';

-- AlterTable
ALTER TABLE "sensor_anomalies" ADD COLUMN     "mode" "DataMode" NOT NULL DEFAULT 'REAL';

-- AlterTable
ALTER TABLE "sensor_readings" ADD COLUMN     "mode" "DataMode" NOT NULL DEFAULT 'REAL';

-- AlterTable
ALTER TABLE "soil_predictions" ADD COLUMN     "mode" "DataMode" NOT NULL DEFAULT 'REAL';

