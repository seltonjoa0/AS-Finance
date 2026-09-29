import { describe, expect, it } from "vitest";

import { safeRedirectPath } from "@/lib/auth/safe-redirect";

describe("safeRedirectPath", () => {
  it("aceita apenas caminhos internos", () => {
    expect(safeRedirectPath("/convite/token?origem=email")).toBe(
      "/convite/token?origem=email",
    );
  });

  it.each([
    "https://evil.example/path",
    "//evil.example/path",
    "/\\evil.example/path",
    "javascript:alert(1)",
    "",
  ])("bloqueia redirecionamento inseguro: %s", (value) => {
    expect(safeRedirectPath(value)).toBeNull();
  });
});
