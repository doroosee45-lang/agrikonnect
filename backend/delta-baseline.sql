-- CreateTable
CREATE TABLE "settings_revisions" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "previous_value" JSONB,
    "new_value" JSONB,
    "changed_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "settings_revisions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "settings_revisions_key_created_at_idx" ON "settings_revisions"("key", "created_at");;
