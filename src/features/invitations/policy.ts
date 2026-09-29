export type InvitationStatus =
  | "available"
  | "accepted"
  | "expired"
  | "revoked"
  | "wrong-account";

type InvitationPolicyInput = {
  email: string;
  expiresAt: Date;
  acceptedAt: Date | null;
  revokedAt: Date | null;
};

export function invitationStatus(
  invitation: InvitationPolicyInput,
  userEmail?: string,
  now = new Date(),
): InvitationStatus {
  if (invitation.revokedAt) return "revoked";
  if (invitation.acceptedAt) return "accepted";
  if (invitation.expiresAt <= now) return "expired";
  if (userEmail && invitation.email.toLowerCase() !== userEmail.toLowerCase()) {
    return "wrong-account";
  }
  return "available";
}

export function maskEmail(email: string) {
  const [local = "", domain = ""] = email.split("@");
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}${"•".repeat(Math.max(3, local.length - visible.length))}@${domain}`;
}
