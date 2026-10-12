import { describe, expect, it } from "vitest";

import {
  civilDateInterval,
  isMembershipValidOnCivilDate,
} from "@/features/finance/dates";

describe("civilDateInterval", () => {
  it("representa toda a data civil com limite final exclusivo", () => {
    expect(civilDateInterval("2026-10-12")).toEqual({
      start: new Date("2026-10-12T00:00:00.000Z"),
      endExclusive: new Date("2026-10-13T00:00:00.000Z"),
    });
  });

  it("avança corretamente entre meses e anos", () => {
    expect(civilDateInterval("2026-12-31").endExclusive).toEqual(
      new Date("2027-01-01T00:00:00.000Z"),
    );
  });
});

describe("isMembershipValidOnCivilDate", () => {
  it("retorna falso para uma competência vazia ou inválida", () => {
    expect(
      isMembershipValidOnCivilDate(
        { joinedAt: "2026-10-01T00:00:00.000Z", revokedAt: null },
        "",
      ),
    ).toBe(false);
  });

  it("inclui quem entrou durante a competência", () => {
    expect(
      isMembershipValidOnCivilDate(
        { joinedAt: "2026-10-12T23:59:59.999Z", revokedAt: null },
        "2026-10-12",
      ),
    ).toBe(true);
  });

  it("exclui quem entrou somente depois da competência", () => {
    expect(
      isMembershipValidOnCivilDate(
        { joinedAt: "2026-10-13T00:00:00.000Z", revokedAt: null },
        "2026-10-12",
      ),
    ).toBe(false);
  });

  it("inclui quem foi revogado depois do início da competência", () => {
    expect(
      isMembershipValidOnCivilDate(
        {
          joinedAt: "2026-10-01T00:00:00.000Z",
          revokedAt: "2026-10-12T15:00:00.000Z",
        },
        "2026-10-12",
      ),
    ).toBe(true);
  });

  it("exclui quem já estava revogado no início da competência", () => {
    expect(
      isMembershipValidOnCivilDate(
        {
          joinedAt: "2026-10-01T00:00:00.000Z",
          revokedAt: "2026-10-12T00:00:00.000Z",
        },
        "2026-10-12",
      ),
    ).toBe(false);
  });
});
