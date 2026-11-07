-- Migration : cartes interpolées — stockage du krigeage et de son diagnostic.
--
-- Le modèle `interpolated_maps` existait mais rien ne l'alimentait : la phase 6
-- du cahier des charges exige une carte interpolée avec incertitude et le
-- signalement des valeurs aberrantes, sans qu'aucune écriture ne soit possible.
--
-- Les colonnes `values`, `uncertainty`, `sondes_used` et `leave_one_out_mae`
-- suffisaient pour la carte elle-même. Il manquait où ranger ce qui la justifie :
--
--   • `outliers` porte les sondes dont la mesure s'écarte de la prédiction de
--     leurs voisines, **chacune avec son motif chiffré** — résidu, incertitude
--     locale et seuil appliqué. Une aberration signalée sans motif n'est pas
--     vérifiable par un agronome.
--   • `diagnostics` porte le détail du calcul : sondes utilisées, sondes
--     rejetées avec leur motif, points confondus moyennés, variogramme ajusté
--     et sources des mesures. C'est le socle de l'explication en langage
--     naturel : tout nombre cité dans le texte doit provenir d'ici ou de
--     `values`, jamais d'une reformulation ultérieure.
--
-- Les deux colonnes sont facultatives : une carte calculée avant cet ajout, ou
-- produite par une méthode sans diagnostic, reste lisible.

-- AlterTable
ALTER TABLE "interpolated_maps" ADD COLUMN     "outliers" JSONB,
ADD COLUMN     "diagnostics" JSONB;
