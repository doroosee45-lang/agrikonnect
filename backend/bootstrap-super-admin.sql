DO $$
DECLARE
  v_uuid   uuid  := '8651af40-c7b3-4943-84f4-d7dbee52a740';
  v_email  text  := 'oseedoro@gmail.com';
  v_prenom text  := 'meya';
  v_nom    text  := 'osee';
  v_pays   char(2) := 'CD';
  v_org    text;
BEGIN
  INSERT INTO profiles ("id", "email", "first_name", "last_name", "country_code",
                        "locale", "status", "email_verified_at", "created_at", "updated_at")
  VALUES (v_uuid, v_email, v_prenom, v_nom, v_pays,
          'fr', 'ACTIVE', now(), now(), now());

  INSERT INTO organizations ("id", "type", "name", "country_code", "created_by",
                             "created_at", "updated_at")
  VALUES (gen_random_uuid()::text, 'INDIVIDUAL', 'AGRIKONNECT - Administration',
          v_pays, v_uuid::text, now(), now())
  RETURNING "id" INTO v_org;

  INSERT INTO memberships ("id", "userId", "organizationId", "roles", "status",
                           "joined_at", "created_by")
  VALUES (gen_random_uuid()::text, v_uuid, v_org,
          ARRAY['SUPER_ADMIN']::"Role"[], 'ACTIVE', now(), v_uuid::text);
END $$;
