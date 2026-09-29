-- CreateTable
CREATE TABLE "space_invitations" (
    "id" UUID NOT NULL,
    "financial_space_id" UUID NOT NULL,
    "email" VARCHAR(254) NOT NULL,
    "role" "SpaceRole" NOT NULL DEFAULT 'MEMBER',
    "token_hash" CHAR(64) NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "accepted_at" TIMESTAMPTZ(3),
    "accepted_by" UUID,
    "revoked_at" TIMESTAMPTZ(3),
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "space_invitations_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "space_invitations_terminal_state_check" CHECK (
      NOT ("accepted_at" IS NOT NULL AND "revoked_at" IS NOT NULL)
    )
);

-- CreateIndex
CREATE UNIQUE INDEX "space_invitations_token_hash_key" ON "space_invitations"("token_hash");
CREATE INDEX "space_invitations_financial_space_id_email_idx" ON "space_invitations"("financial_space_id", "email");
CREATE INDEX "space_invitations_expires_at_idx" ON "space_invitations"("expires_at");

-- AddForeignKey
ALTER TABLE "space_invitations" ADD CONSTRAINT "space_invitations_financial_space_id_fkey" FOREIGN KEY ("financial_space_id") REFERENCES "financial_spaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "space_invitations" ADD CONSTRAINT "space_invitations_accepted_by_fkey" FOREIGN KEY ("accepted_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "space_invitations" ADD CONSTRAINT "space_invitations_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
