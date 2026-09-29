import { describe, expect, it } from "vitest";

import {
  transferSchema,
  transferSchemaForDate,
} from "@/features/finance/schemas";

const sourceAccountId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const destinationAccountId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

describe("account transfers", () => {
  it("aceita uma transferência válida entre contas diferentes", () => {
    const result = transferSchema.safeParse({
      sourceAccountId,
      destinationAccountId,
      amount: "R$ 1.234,56",
      transferDate: "2026-09-28",
      description: "Reserva mensal",
      notes: "Movimento interno",
    });

    expect(result.success).toBe(true);
  });

  it("rejeita origem e destino iguais", () => {
    const result = transferSchema.safeParse({
      sourceAccountId,
      destinationAccountId: sourceAccountId,
      amount: "100,00",
      transferDate: "2026-09-28",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.destinationAccountId).toContain(
        "A conta de destino deve ser diferente da conta de origem.",
      );
    }
  });

  it("rejeita valor não positivo e data civil inválida", () => {
    const result = transferSchema.safeParse({
      sourceAccountId,
      destinationAccountId,
      amount: "0,00",
      transferDate: "2026-02-30",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.amount).toBeDefined();
      expect(result.error.flatten().fieldErrors.transferDate).toBeDefined();
    }
  });

  it("rejeita uma data futura para uma transferência imediata", () => {
    const result = transferSchemaForDate("2026-09-29").safeParse({
      sourceAccountId,
      destinationAccountId,
      amount: "100,00",
      transferDate: "2026-09-30",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.transferDate).toContain(
        "A data da transferência não pode estar no futuro.",
      );
    }
  });
});
