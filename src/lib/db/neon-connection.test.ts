import { describe, expect, it } from "vitest";

import { secureNeonRuntimeUrl } from "@/lib/db/neon-connection";

describe("secureNeonRuntimeUrl", () => {
  it("explicita a verificação completa de certificado no Neon", () => {
    const result = secureNeonRuntimeUrl(
      "postgresql://user:secret@ep-project-pooler.eu.aws.neon.tech/neondb?sslmode=require&channel_binding=require",
    );

    const url = new URL(result);
    expect(url.searchParams.get("sslmode")).toBe("verify-full");
    expect(url.searchParams.get("channel_binding")).toBe("require");
  });

  it("não altera URLs de outros provedores", () => {
    const input = "postgresql://user:secret@db.example.com/app?sslmode=require";
    expect(secureNeonRuntimeUrl(input)).toBe(input);
  });
});
