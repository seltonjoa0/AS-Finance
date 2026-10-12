import { describe, expect, it } from "vitest";

import { recurringRuleSchema } from "@/features/finance/recurrence-schema";

const baseRule = {
  type: "EXPENSE",
  description: "Aluguel",
  amount: "1.500,00",
  accountId: "00000000-0000-4000-8000-000000000001",
  categoryId: "00000000-0000-4000-8000-000000000002",
  transactionStatus: "PENDING",
  startDate: "2026-10-31",
  endDate: "",
  payerMemberId: "",
  splitMethod: "INDIVIDUAL",
  responsibleMemberId: "00000000-0000-4000-8000-000000000003",
  splitDetails: "[]",
  notes: "",
} as const;

describe("recurringRuleSchema", () => {
  it("aceita uma previsão mensal pendente", () => {
    expect(recurringRuleSchema.safeParse(baseRule).success).toBe(true);
  });

  it("rejeita data final anterior à inicial", () => {
    const result = recurringRuleSchema.safeParse({
      ...baseRule,
      endDate: "2026-10-30",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.endDate).toBeDefined();
    }
  });

  it("rejeita previsão marcada como paga", () => {
    expect(
      recurringRuleSchema.safeParse({
        ...baseRule,
        transactionStatus: "PAID",
      }).success,
    ).toBe(false);
  });

  it("limita receitas ao responsável individual", () => {
    const result = recurringRuleSchema.safeParse({
      ...baseRule,
      type: "INCOME",
      splitMethod: "EQUAL",
      responsibleMemberId: "",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.splitMethod).toBeDefined();
    }
  });
});
