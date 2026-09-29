import { describe, expect, it } from "vitest";

import {
  createSessionToken,
  hashSessionToken,
  sessionExpiration,
} from "@/lib/auth/session-token";

describe("sessão", () => {
  it("gera tokens opacos distintos e persiste somente o hash", () => {
    const first = createSessionToken();
    const second = createSessionToken();

    expect(first).not.toBe(second);
    expect(hashSessionToken(first)).toHaveLength(64);
    expect(hashSessionToken(first)).not.toContain(first);
  });

  it("calcula expiração em dias", () => {
    const now = new Date("2026-09-27T12:00:00.000Z");
    expect(sessionExpiration(30, now).toISOString()).toBe(
      "2026-10-27T12:00:00.000Z",
    );
  });
});
