import { describe, expect, it } from "vitest";

import {
  creditCardPaymentSchemaForDate,
  creditCardPurchaseSchemaForDate,
  creditCardSchema,
} from "@/features/finance/credit-card-schema";

const ids = {
  card: "00000000-0000-4000-8000-000000000001",
  category: "00000000-0000-4000-8000-000000000002",
  member: "00000000-0000-4000-8000-000000000003",
  account: "00000000-0000-4000-8000-000000000004",
};

describe("creditCardSchema", () => {
  it("aceita limite e ciclo válidos", () => {
    const result = creditCardSchema.safeParse({
      name: "Visa principal",
      bank: "Banco Aflora",
      holderMemberId: ids.member,
      creditLimit: "5.000,00",
      closingDay: "25",
      dueDay: "5",
    });

    expect(result.success).toBe(true);
  });

  it.each(["0", "32", "1.5"])("rejeita dia de ciclo inválido: %s", (day) => {
    const result = creditCardSchema.safeParse({
      name: "Visa principal",
      bank: "Banco Aflora",
      holderMemberId: ids.member,
      creditLimit: "5.000,00",
      closingDay: day,
      dueDay: "10",
    });

    expect(result.success).toBe(false);
  });
});

describe("creditCardPurchaseSchemaForDate", () => {
  const basePurchase = {
    cardId: ids.card,
    description: "Mercado",
    amount: "250,00",
    categoryId: ids.category,
    purchaseDate: "2026-10-12",
    payerMemberId: "",
    splitMethod: "INDIVIDUAL",
    responsibleMemberId: ids.member,
    splitDetails: "[]",
    notes: "",
  };

  it("aceita uma compra presente com responsável", () => {
    expect(
      creditCardPurchaseSchemaForDate("2026-10-12").safeParse(basePurchase)
        .success,
    ).toBe(true);
  });

  it("rejeita compra futura", () => {
    const result = creditCardPurchaseSchemaForDate("2026-10-11").safeParse(
      basePurchase,
    );

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.purchaseDate).toBeDefined();
    }
  });
});

describe("creditCardPaymentSchemaForDate", () => {
  it("rejeita pagamento futuro", () => {
    const result = creditCardPaymentSchemaForDate("2026-10-12").safeParse({
      sourceAccountId: ids.account,
      paymentDate: "2026-10-13",
    });

    expect(result.success).toBe(false);
  });
});
