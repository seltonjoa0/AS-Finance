import { describe, expect, it } from "vitest";

import {
  buildTransactionSplits,
  equalPercentageInputs,
  parsePercentageUnits,
  parseSplitDetails,
} from "@/features/finance/splits";

const members = ["ana", "bia", "caio"];

function expectClosedIncomeSplit(
  result: ReturnType<typeof buildTransactionSplits>,
  totalCents: bigint,
) {
  expect(result.success).toBe(true);
  if (!result.success) {
    throw new Error(result.message);
  }

  const allocatedCents = result.splits.reduce(
    (sum, split) => sum + split.cents,
    0n,
  );
  const allocatedPercentageUnits = result.splits.reduce((sum, split) => {
    const percentageUnits = parsePercentageUnits(split.percentage ?? "");
    expect(percentageUnits).not.toBeNull();
    return sum + (percentageUnits ?? 0n);
  }, 0n);

  expect(allocatedCents).toBe(totalCents);
  expect(allocatedPercentageUnits).toBe(1_000_000n);
  return result.splits;
}

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

  it("divide proporcionalmente à renda e fecha percentuais e centavos", () => {
    const result = buildTransactionSplits({
      method: "INCOME_BASED",
      totalCents: 100_00n,
      memberIds: ["ana", "bia"],
      details: [
        { memberId: "ana", value: "5.000,00" },
        { memberId: "bia", value: "3.000,00" },
      ],
    });

    expect(result).toEqual({
      success: true,
      splits: [
        { memberId: "ana", cents: 6_250n, percentage: "62.5000" },
        { memberId: "bia", cents: 3_750n, percentage: "37.5000" },
      ],
    });
    expectClosedIncomeSplit(result, 100_00n);
  });

  it("distribui restos desiguais para rendas na proporção 2:1", () => {
    const result = buildTransactionSplits({
      method: "INCOME_BASED",
      totalCents: 100n,
      memberIds: ["ana", "bia"],
      details: [
        { memberId: "ana", value: "2.000,00" },
        { memberId: "bia", value: "1.000,00" },
      ],
    });

    expect(expectClosedIncomeSplit(result, 100n)).toEqual([
      { memberId: "ana", cents: 67n, percentage: "66.6667" },
      { memberId: "bia", cents: 33n, percentage: "33.3333" },
    ]);
  });

  it("desempata restos iguais pela ordem estável em uma proporção 1:1:1", () => {
    const result = buildTransactionSplits({
      method: "INCOME_BASED",
      totalCents: 100n,
      memberIds: members,
      details: members.map((memberId) => ({ memberId, value: "1.000,00" })),
    });

    expect(expectClosedIncomeSplit(result, 100n)).toEqual([
      { memberId: "ana", cents: 34n, percentage: "33.3334" },
      { memberId: "bia", cents: 33n, percentage: "33.3333" },
      { memberId: "caio", cents: 33n, percentage: "33.3333" },
    ]);
  });

  it("atribui um único centavo ao maior resto entre múltiplos pesos", () => {
    const result = buildTransactionSplits({
      method: "INCOME_BASED",
      totalCents: 1n,
      memberIds: members,
      details: [
        { memberId: "ana", value: "1" },
        { memberId: "bia", value: "2" },
        { memberId: "caio", value: "3" },
      ],
    });

    expect(expectClosedIncomeSplit(result, 1n)).toEqual([
      { memberId: "ana", cents: 0n, percentage: "16.6667" },
      { memberId: "bia", cents: 0n, percentage: "33.3333" },
      { memberId: "caio", cents: 1n, percentage: "50.0000" },
    ]);
  });

  it("preserva renda zero e usa o maior resto com ordem estável", () => {
    const result = buildTransactionSplits({
      method: "INCOME_BASED",
      totalCents: 1n,
      memberIds: members,
      details: [
        { memberId: "ana", value: "1" },
        { memberId: "bia", value: "1" },
        { memberId: "caio", value: "0" },
      ],
    });

    expect(result).toEqual({
      success: true,
      splits: [
        { memberId: "ana", cents: 1n, percentage: "50.0000" },
        { memberId: "bia", cents: 0n, percentage: "50.0000" },
        { memberId: "caio", cents: 0n, percentage: "0.0000" },
      ],
    });
  });

  it("rejeita renda total zerada", () => {
    expect(
      buildTransactionSplits({
        method: "INCOME_BASED",
        totalCents: 100n,
        memberIds: ["ana", "bia"],
        details: [
          { memberId: "ana", value: "0" },
          { memberId: "bia", value: "0,00" },
        ],
      }),
    ).toEqual({
      success: false,
      message: "A renda total vigente precisa ser maior que zero.",
    });
  });

  it("rejeita rendas negativas e formatos monetários inválidos", () => {
    for (const invalidIncome of ["-1", "-0,01", "abc", "1,234"]) {
      expect(
        buildTransactionSplits({
          method: "INCOME_BASED",
          totalCents: 100n,
          memberIds: ["ana", "bia"],
          details: [
            { memberId: "ana", value: invalidIncome },
            { memberId: "bia", value: "1.000,00" },
          ],
        }),
      ).toEqual({
        success: false,
        message: "Informe uma renda vigente válida para todas as pessoas.",
      });
    }
  });

  it("rejeita JSON de divisão fora do contrato", () => {
    expect(parseSplitDetails('[{"memberId":"ana","value":"50"}]')).toEqual([
      { memberId: "ana", value: "50" },
    ]);
    expect(parseSplitDetails('{"memberId":"ana"}')).toBeNull();
    expect(parseSplitDetails('[{"memberId":"ana","value":50}]')).toBeNull();
  });
});
