CREATE INDEX IF NOT EXISTS "audit_logs_action_created_at_idx" ON "audit_logs"("action", "created_at");
CREATE INDEX IF NOT EXISTS "memberships_roles_idx" ON "memberships" USING GIN ("roles");
