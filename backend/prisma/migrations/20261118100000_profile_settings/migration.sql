ALTER TABLE "profiles"
  ADD COLUMN "professional_profile" JSONB,
  ADD COLUMN "account_preferences" JSONB;

ALTER TABLE "organizations"
  ADD COLUMN "profile_details" JSONB,
  ADD COLUMN "settings" JSONB;
