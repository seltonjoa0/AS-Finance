import { describe, expect, it } from "vitest";

import { invitationStatus, maskEmail } from "@/features/invitations/policy";
import {
  createInvitationToken,
  hashInvitationToken,
  invitationExpiration,
} from "@/features/invitations/token";

describe("convites", () => {
  const now = new Date("2026-09-28T12:00:00.000Z");
  const active = {
    email: "pessoa@example.com",
    expiresAt: new Date("2026-10-01T12:00:00.000Z"),
    acceptedAt: null,
    revokedAt: null,
  };

  it("gera token opaco e persiste somente seu hash", () => {
    const token = createInvitationToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(hashInvitationToken(token)).toMatch(/^[a-f0-9]{64}$/);
    expect(hashInvitationToken(token)).not.toContain(token);
  });

  it("expira em sete dias", () => {
    expect(invitationExpiration(now).toISOString()).toBe("2026-10-05T12:00:00.000Z");
  });

  it("valida estado e e-mail da conta", () => {
    expect(invitationStatus(active, "pessoa@example.com", now)).toBe("available");
    expect(invitationStatus(active, "outra@example.com", now)).toBe("wrong-account");
    expect(invitationStatus({ ...active, acceptedAt: now }, undefined, now)).toBe("accepted");
    expect(invitationStatus({ ...active, revokedAt: now }, undefined, now)).toBe("revoked");
    expect(invitationStatus({ ...active, expiresAt: now }, undefined, now)).toBe("expired");
  });

  it("mascara o endereço exibido publicamente", () => {
    expect(maskEmail("pessoa@example.com")).toBe("pe••••@example.com");
  });
});
