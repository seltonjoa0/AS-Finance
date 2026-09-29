import { describe, expect, it } from "vitest";

import {
  assertMembership,
  SpaceAccessDeniedError,
} from "@/features/spaces/authorization";
import { buildInitialSpaceData } from "@/features/spaces/factory";
import { financialSpaceSchema } from "@/features/spaces/schemas";

describe("criação do primeiro espaço", () => {
  it("associa o criador como OWNER", () => {
    const data = buildInitialSpaceData("user-a", "Finanças do casal");

    expect(data).toEqual({
      name: "Finanças do casal",
      createdById: "user-a",
      members: {
        create: { userId: "user-a", role: "OWNER" },
      },
    });
  });

  it("não aceita nome vazio", () => {
    expect(financialSpaceSchema.safeParse({ name: " " }).success).toBe(false);
  });
});

describe("isolamento de espaços", () => {
  it("autoriza uma participação ativa no mesmo tenant", () => {
    const membership = {
      userId: "user-a",
      financialSpaceId: "space-a",
      revokedAt: null,
    };

    expect(assertMembership(membership, "user-a", "space-a")).toBe(membership);
  });

  it("bloqueia um espaço pertencente a terceiro", () => {
    const membership = {
      userId: "user-a",
      financialSpaceId: "space-a",
      revokedAt: null,
    };

    expect(() => assertMembership(membership, "user-a", "space-b")).toThrow(
      SpaceAccessDeniedError,
    );
  });

  it("bloqueia uma participação revogada", () => {
    expect(() =>
      assertMembership(
        {
          userId: "user-a",
          financialSpaceId: "space-a",
          revokedAt: new Date(),
        },
        "user-a",
        "space-a",
      ),
    ).toThrow(SpaceAccessDeniedError);
  });
});
