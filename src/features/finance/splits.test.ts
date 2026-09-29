import { describe, expect, it } from "vitest";

import {
  buildTransactionSplits,
  equalPercentageInputs,
  parsePercentageUnits,
  parseSplitDetails,
} from "@/features/finance/splits";

const members = ["ana", "bia", "caio"];

describe("transaction splits", () => {
  it("gera percentuais iguais que fecham exatamente em 100%", () => {
    const values = equalPercentageInputs(members);
    const total = Object.values(values).reduce(
      (sum, value) => sum + parsePercentageUnits(value)!,
      0n,
    );

    expect(values).toEqual({ ana: "33,3334", bia: "33,3333", caio: "33,3333" });
    expect(total).toBe(1_000_000n);
  });

  it("rateia por percentual sem perder centavos", () => {
    const result = buildTransactionSplits({
      method: "PERCENTAGE",
      totalCents: 1000n,
      memberIds: members,
      details: [
        { memberId: "ana", value: "33,33" },
        { memberId: "bia", value: "33,33" },
        { memberId: "caio", value: "33,34" },
      ],
    });

    expect(result).toEqual({
      success: true,
      splits: [
        { memberId: "ana", cents: 333n, percentage: "33.3300" },
        { memberId: "bia", cents: 333n, percentage: "33.3300" },
        { memberId: "caio", cents: 334n, percentage: "33.3400" },
      ],
    });
  });

  it("usa o maior resto para fechar a soma percentual", () => {
    const result = buildTransactionSplits({
      method: "PERCENTAGE",
      totalCents: 999n,
      memberIds: ["ana", "bia"],
      details: [
        { memberId: "ana", value: "60" },
        { memberId: "bia", value: "40" },
      ],
    });

    expect(result).toMatchObject({
      success: true,
      splits: [
        { memberId: "ana", cents: 599n },
        { memberId: "bia", cents: 400n },
      ],
    });
  });

  it("rejeita percentual que não fecha em 100%", () => {
    const result = buildTransactionSplits({
      method: "PERCENTAGE",
      totalCents: 10000n,
      memberIds: ["ana", "bia"],
      details: [
        { memberId: "ana", value: "60" },
        { memberId: "bia", value: "39,99" },
      ],
    });

    expect(result).toEqual({
      success: false,
      message: "A soma dos percentuais deve ser exatamente 100%.",
    });
  });

  it("valida e monta uma divisão por valores personalizados", () => {
    const result = buildTransactionSplits({
      method: "CUSTOM",
      totalCents: 10000n,
      memberIds: ["ana", "bia"],
      details: [
        { memberId: "ana", value: "R$ 75,50" },
        { memberId: "bia", value: "24,50" },
      ],
    });

    expect(result).toEqual({
      success: true,
      splits: [
        { memberId: "ana", cents: 7550n },
        { memberId: "bia", cents: 2450n },
      ],
    });
  });

  it("rejeita soma personalizada divergente e membros manipulados", () => {
    expect(
      buildTransactionSplits({
        method: "CUSTOM",
        totalCents: 10000n,
        memberIds: ["ana", "bia"],
        details: [
          { memberId: "ana", value: "50" },
          { memberId: "bia", value: "40" },
        ],
      }),
    ).toMatchObject({ success: false, message: "A soma da divisão deve ser igual ao valor da movimentação." });

    expect(
      buildTransactionSplits({
        method: "CUSTOM",
        totalCents: 10000n,
        memberIds: ["ana", "bia"],
        details: [
          { memberId: "ana", value: "50" },
          { memberId: "intruso", value: "50" },
        ],
      }),
    ).toMatchObject({ success: false, message: "A divisão deve incluir cada membro ativo uma única vez." });

    expect(
      buildTransactionSplits({
        method: "CUSTOM",
        totalCents: 10000n,
        memberIds: ["ana", "bia"],
        details: [
          { memberId: "ana", value: "50" },
          { memberId: "ana", value: "50" },
        ],
      }),
    ).toMatchObject({ success: false, message: "A divisão deve incluir cada membro ativo uma única vez." });
  });

  it("ignora participações zeradas e protege valores pequenos demais", () => {
    expect(
      buildTransactionSplits({
        method: "CUSTOM",
        totalCents: 100n,
        memberIds: ["ana", "bia"],
        details: [
          { memberId: "ana", value: "1,00" },
          { memberId: "bia", value: "0" },
        ],
      }),
    ).toEqual({ success: true, splits: [{ memberId: "ana", cents: 100n }] });

    expect(
      buildTransactionSplits({
        method: "EQUAL",
        totalCents: 1n,
        memberIds: ["ana", "bia"],
        details: [],
      }),
    ).toMatchObject({
      success: false,
      message: "O valor precisa ter ao menos R$ 0,01 por pessoa na divisão igual.",
    });
  });

  it("rejeita JSON de divisão fora do contrato", () => {
    expect(parseSplitDetails('[{"memberId":"ana","value":"50"}]')).toEqual([
      { memberId: "ana", value: "50" },
    ]);
    expect(parseSplitDetails('{"memberId":"ana"}')).toBeNull();
    expect(parseSplitDetails('[{"memberId":"ana","value":50}]')).toBeNull();
  });
});
