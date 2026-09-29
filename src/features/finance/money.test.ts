import { describe, expect, it } from "vitest";

import {
  calculateAccountBalanceCents,
  centsToDecimal,
  formatCents,
  parseMoneyToCents,
  splitEqually,
} from "@/features/finance/money";

describe("money", () => {
  it("converte valores brasileiros sem usar ponto flutuante", () => {
    expect(parseMoneyToCents("R$ 1.234,56")).toBe(123456n);
    expect(parseMoneyToCents("19.9")).toBe(1990n);
    expect(centsToDecimal(-501n)).toBe("-5.01");
    expect(formatCents(-123456n)).toBe("-R$ 1.234,56");
  });

  it("rejeita precisão maior que centavos", () => {
    expect(parseMoneyToCents("10,999")).toBeNull();
    expect(parseMoneyToCents("-1,00")).toBeNull();
  });

  it("divide centavos sem perder o resto", () => {
    const split = splitEqually(1000n, ["a", "b", "c"]);
    expect(split).toEqual([
      { memberId: "a", cents: 334n },
      { memberId: "b", cents: 333n },
      { memberId: "c", cents: 333n },
    ]);
    expect(split.reduce((sum, item) => sum + item.cents, 0n)).toBe(1000n);
  });

  it("aplica entradas e saídas de transferências apenas no saldo da conta", () => {
    expect(
      calculateAccountBalanceCents({
        openingCents: 10000n,
        incomeCents: 5000n,
        expenseCents: 2000n,
        incomingTransferCents: 3000n,
        outgoingTransferCents: 4500n,
      }),
    ).toBe(11500n);

    expect(
      calculateAccountBalanceCents({
        openingCents: 10000n,
        incomeCents: 0n,
        expenseCents: 0n,
        netTransferCents: -2500n,
      }),
    ).toBe(7500n);
  });
});
