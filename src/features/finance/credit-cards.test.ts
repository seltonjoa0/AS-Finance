import { describe, expect, it } from "vitest";

import {
  calculateCreditCardLimit,
  resolveCreditCardInvoiceCycle,
} from "@/features/finance/credit-cards";

describe("credit card invoice cycles", () => {
  it("mantém no ciclo atual uma compra feita no dia do fechamento", () => {
    expect(resolveCreditCardInvoiceCycle({
      purchaseDate: "2026-10-05",
      closingDay: 5,
      dueDay: 12,
    })).toEqual({
      closingDate: "2026-10-05",
      dueDate: "2026-10-12",
    });
  });

  it("move para o próximo ciclo apenas compras posteriores ao fechamento", () => {
    expect(resolveCreditCardInvoiceCycle({
      purchaseDate: "2026-10-06",
      closingDay: 5,
      dueDay: 12,
    })).toEqual({
      closingDate: "2026-11-05",
      dueDate: "2026-11-12",
    });
  });

  it("usa o último dia de meses curtos sem alterar os dias-base", () => {
    expect(resolveCreditCardInvoiceCycle({
      purchaseDate: "2026-02-28",
      closingDay: 31,
      dueDay: 5,
    })).toEqual({
      closingDate: "2026-02-28",
      dueDate: "2026-03-05",
    });
    expect(resolveCreditCardInvoiceCycle({
      purchaseDate: "2026-03-30",
      closingDay: 31,
      dueDay: 5,
    })).toEqual({
      closingDate: "2026-03-31",
      dueDate: "2026-04-05",
    });
  });

  it("trata fevereiro bissexto e mantém o vencimento posterior", () => {
    expect(resolveCreditCardInvoiceCycle({
      purchaseDate: "2028-02-29",
      closingDay: 31,
      dueDay: 31,
    })).toEqual({
      closingDate: "2028-02-29",
      dueDate: "2028-03-31",
    });
  });

  it("mantém o vencimento estritamente posterior mesmo na virada do ano", () => {
    expect(resolveCreditCardInvoiceCycle({
      purchaseDate: "2026-12-20",
      closingDay: 20,
      dueDay: 5,
    })).toEqual({
      closingDate: "2026-12-20",
      dueDate: "2027-01-05",
    });
    expect(resolveCreditCardInvoiceCycle({
      purchaseDate: "2026-12-21",
      closingDay: 20,
      dueDay: 5,
    })).toEqual({
      closingDate: "2027-01-20",
      dueDate: "2027-02-05",
    });
  });

  it("avança o vencimento quando o ajuste o faria coincidir com o fechamento", () => {
    expect(resolveCreditCardInvoiceCycle({
      purchaseDate: "2026-04-30",
      closingDay: 31,
      dueDay: 31,
    })).toEqual({
      closingDate: "2026-04-30",
      dueDate: "2026-05-31",
    });
  });

  it("rejeita datas e dias de ciclo inválidos", () => {
    expect(() => resolveCreditCardInvoiceCycle({
      purchaseDate: "2026-02-30",
      closingDay: 5,
      dueDay: 12,
    })).toThrow("data civil válida");
    expect(() => resolveCreditCardInvoiceCycle({
      purchaseDate: "2026-10-05",
      closingDay: 0,
      dueDay: 12,
    })).toThrow("inteiro entre 1 e 31");
    expect(() => resolveCreditCardInvoiceCycle({
      purchaseDate: "2026-10-05",
      closingDay: 5,
      dueDay: 12.5,
    })).toThrow("inteiro entre 1 e 31");
  });
});

describe("credit card limit", () => {
  it("não consome limite quando a conta tem saldo positivo ou zerado", () => {
    expect(calculateCreditCardLimit({
      limitCents: 500_000n,
      accountBalanceCents: 75_000n,
    })).toEqual({
      usedCents: 0n,
      availableCents: 500_000n,
      overLimitCents: 0n,
    });
    expect(calculateCreditCardLimit({
      limitCents: 500_000n,
      accountBalanceCents: 0n,
    })).toEqual({
      usedCents: 0n,
      availableCents: 500_000n,
      overLimitCents: 0n,
    });
  });

  it("converte saldo negativo em limite utilizado", () => {
    expect(calculateCreditCardLimit({
      limitCents: 500_000n,
      accountBalanceCents: -125_050n,
    })).toEqual({
      usedCents: 125_050n,
      availableCents: 374_950n,
      overLimitCents: 0n,
    });
  });

  it("calcula uso exato e estouro do limite", () => {
    expect(calculateCreditCardLimit({
      limitCents: 500_000n,
      accountBalanceCents: -500_000n,
    })).toEqual({
      usedCents: 500_000n,
      availableCents: 0n,
      overLimitCents: 0n,
    });
    expect(calculateCreditCardLimit({
      limitCents: 500_000n,
      accountBalanceCents: -525_000n,
    })).toEqual({
      usedCents: 525_000n,
      availableCents: 0n,
      overLimitCents: 25_000n,
    });
  });

  it("rejeita limite negativo", () => {
    expect(() => calculateCreditCardLimit({
      limitCents: -1n,
      accountBalanceCents: 0n,
    })).toThrow("não pode ser negativo");
  });
});
