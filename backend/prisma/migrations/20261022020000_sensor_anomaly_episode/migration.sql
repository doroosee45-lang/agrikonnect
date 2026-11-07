-- Migration : dédoublonnage par épisode des anomalies de mesure.
--
-- `sensor_anomalies` n'avait aucun point d'écriture : le modèle existait, la
-- détection était calculée par le moteur (`geoai/sensors.py`) puis renvoyée au
-- client sans être conservée. Câbler la détection impose une clé d'épisode,
-- comme pour `threshold_alerts` : relancer le job sur la même fenêtre ne doit
-- pas recréer les mêmes anomalies.
--
-- Une anomalie par mesure, quel que soit le nombre de motifs détectés (valeur
-- aberrante, capteur figé) : les motifs s'accumulent dans `details`, et
-- l'agronome statue sur la mesure, pas sur chaque motif.
--
-- La contrainte porte sur (`organization_id`, `episode_key`) et non sur
-- `reading_id` : celui-ci est facultatif (une anomalie peut concerner une sonde
-- sans mesure rattachée), et PostgreSQL traite deux NULL comme distincts — un
-- unique sur une colonne nullable ne dédoublonnerait rien.
--
-- La colonne est NOT NULL : la table n'a jamais été écrite, aucune ligne
-- existante n'est à reprendre.

-- AlterTable
ALTER TABLE "sensor_anomalies" ADD COLUMN "episode_key" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "sensor_anomalies_organization_id_episode_key_key" ON "sensor_anomalies"("organization_id", "episode_key");
