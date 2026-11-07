-- V4 NFR-01 — état MFA porté par le profil.
--
-- Le secret TOTP reste dans `mfa_secrets` (chiffré AES-256-GCM). Ce drapeau,
-- lui, est la seule information lue à la connexion et par les contrôles
-- d'accès investisseur : sans lui, `InvestorProfile.dataRoomAccess` restait
-- toujours faux et la MFA enrôlée n'était jamais exigée.
ALTER TABLE "profiles" ADD COLUMN "mfa_enabled" BOOLEAN NOT NULL DEFAULT false;
