-- Raison de non-envoi : fenêtre de silence (heures diurnes).
--
-- La recommandation de conformité Twilio pour la RDC impose des envois en
-- heures diurnes. Les codes OTP ne sont pas concernés : un code demandé par
-- l'utilisateur doit arriver quelle que soit l'heure.
ALTER TYPE "SmsSkipReason" ADD VALUE IF NOT EXISTS 'QUIET_HOURS';
