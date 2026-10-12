import { describe, expect, it } from "vitest";

import {
  parseIncomeDetails,
  resolveIncomeDetails,
} from "@/features/finance/incomes";

describe("income history", () => {
  const history = [
    { memberId: "ana", amount: "4000.00", effectiveFrom: "2026-01-01" },
    { memberId: "ana", amount: "5000.00", effectiveFrom: "2026-07-01" },
    { memberId: "bia", amount: "0.00", effectiveFrom: "2026-01-01" },
  ];

  it("resolve a renda mais recente vigente na data de competência", () => {
    expect(
      resolveIncomeDetails({
        memberIds: ["ana", "bia"],
        history,
        competenceDate: "2026-06-30",
      }),
    ).toEqual({
      details: [
        { memberId: "ana", value: "4000.00" },
        { memberId: "bia", value: "0.00" },
      ],
      missingMemberIds: [],
    });

    expect(
      resolveIncomeDetails({
        memberIds: ["ana", "bia"],
        history,
        competenceDate: "2026-07-01",
      }).details[0],
    ).toEqual({ memberId: "ana", value: "5000.00" });
  });

  it("distingue renda zero de renda ausente", () => {
    expect(
      resolveIncomeDetails({
        memberIds: ["ana", "bia", "caio"],
        history,
        competenceDate: "2026-08-01",
      }),
    ).toMatchObject({
      details: expect.arrayContaining([{ memberId: "bia", value: "0.00" }]),
      missingMemberIds: ["caio"],
    });
  });

  it("não usa uma renda antes do início da vigência", () => {
    expect(
      resolveIncomeDetails({
        memberIds: ["ana"],
        history,
        competenceDate: "2025-12-31",
      }),
    ).toEqual({ details: [], missingMemberIds: ["ana"] });
  });

  it("ignora histórico com vigência inválida e competência inválida", () => {
    expect(
      resolveIncomeDetails({
        memberIds: ["ana"],
        history: [
          ...history,
          { memberId: "ana", amount: "9000.00", effectiveFrom: "2026-02-30" },
        ],
        competenceDate: "2026-06-30",
      }),
    ).toEqual({
      details: [{ memberId: "ana", value: "4000.00" }],
      missingMemberIds: [],
    });

    expect(
      resolveIncomeDetails({
        memberIds: ["ana"],
        history,
        competenceDate: "30/06/2026",
      }),
    ).toEqual({ details: [], missingMemberIds: ["ana"] });
  });

  it("valida o contrato JSON do formulário", () => {
    expect(parseIncomeDetails('[{"memberId":"ana","value":"5000"}]')).toEqual([
      { memberId: "ana", value: "5000" },
    ]);
    expect(parseIncomeDetails('[{"memberId":"ana","value":5000}]')).toBeNull();
    expect(parseIncomeDetails('{"memberId":"ana","value":"5000"}')).toBeNull();
    expect(parseIncomeDetails("JSON inválido")).toBeNull();
  });
});
