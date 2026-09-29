-- Normalize expired invitations before enforcing one active invitation per e-mail.
UPDATE "space_invitations"
SET "revoked_at" = CURRENT_TIMESTAMP,
    "updated_at" = CURRENT_TIMESTAMP
WHERE "accepted_at" IS NULL
  AND "revoked_at" IS NULL
  AND "expires_at" <= CURRENT_TIMESTAMP;

-- An accepted invitation must always identify the user who accepted it.
ALTER TABLE "space_invitations"
ADD CONSTRAINT "space_invitations_acceptance_check" CHECK (
  ("accepted_at" IS NULL AND "accepted_by" IS NULL)
  OR ("accepted_at" IS NOT NULL AND "accepted_by" IS NOT NULL)
);

-- Prevent duplicate active links even under concurrent requests.
CREATE UNIQUE INDEX "space_invitations_active_email_key"
ON "space_invitations"("financial_space_id", "email")
WHERE "accepted_at" IS NULL AND "revoked_at" IS NULL;
