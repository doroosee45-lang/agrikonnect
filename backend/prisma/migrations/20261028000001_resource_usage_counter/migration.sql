-- Compteur transactionnel d'occupation du quota de dépôt géospatial.
--
-- Le contrôle par `aggregate` était une course : deux dépôts concurrents
-- lisaient la même somme et passaient tous les deux. Le compteur est
-- incrémenté dans la transaction du dépôt, ce qui verrouille la ligne et
-- sérialise les dépôts concurrents.
--
-- Aucun report des lignes existantes n'est écrit ici : le premier dépôt d'une
-- organisation initialise son compteur depuis ce qui est déjà stocké, ce qui
-- évite d'offrir un quota neuf à des données préexistantes.
CREATE TABLE "resource_usages" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "used_bytes" BIGINT NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "resource_usages_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "resource_usages_organization_id_idx" ON "resource_usages"("organization_id");

CREATE UNIQUE INDEX "resource_usages_organization_id_resource_key"
    ON "resource_usages"("organization_id", "resource");
