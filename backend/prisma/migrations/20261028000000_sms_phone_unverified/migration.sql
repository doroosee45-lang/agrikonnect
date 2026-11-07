-- Raison de non-envoi : numéro jamais confirmé par son titulaire.
--
-- Les alertes SMS ne partent plus que vers un numéro vérifié. Le canal étant à
-- sens unique en RDC (aucun « STOP » par SMS), la vérification préalable est la
-- seule façon de ne pas alerter un inconnu.
--
-- `ADD VALUE` ne peut pas être employé dans la même transaction que la valeur
-- ajoutée ; cette migration ne fait donc rien d'autre.
ALTER TYPE "SmsSkipReason" ADD VALUE IF NOT EXISTS 'PHONE_UNVERIFIED';
