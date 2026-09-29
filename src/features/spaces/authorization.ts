export class SpaceAccessDeniedError extends Error {
  constructor() {
    super("Acesso ao espaço financeiro não autorizado.");
    this.name = "SpaceAccessDeniedError";
  }
}

type Membership = {
  userId: string;
  financialSpaceId: string;
  revokedAt: Date | null;
};

export function assertMembership(
  membership: Membership | null,
  userId: string,
  financialSpaceId: string,
) {
  if (
    !membership ||
    membership.revokedAt ||
    membership.userId !== userId ||
    membership.financialSpaceId !== financialSpaceId
  ) {
    throw new SpaceAccessDeniedError();
  }

  return membership;
}
