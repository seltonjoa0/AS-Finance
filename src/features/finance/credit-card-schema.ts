import { z } from "zod";

import { isCivilDate } from "@/features/finance/dates";
import { parseMoneyToCents } from "@/features/finance/money";

const uuid = z.string().uuid("Selecione uma opção válida.");
const optionalUuid = z.preprocess(
  (value) => (value === "" ? undefined : value),
  uuid.optional(),
);
const positiveMoney = z
  .string()
  .trim()
  .refine((value) => {
    const cents = parseMoneyToCents(value);
    return cents !== null && cents > 0n;
  }, "Informe um valor maior que zero.");
const billingDay = z.coerce
  .number()
  .int("Informe um dia inteiro.")
  .min(1, "O dia deve estar entre 1 e 31.")
  .max(31, "O dia deve estar entre 1 e 31.");

export const creditCardSchema = z.object({
  name: z.string().trim().min(2, "Informe ao menos 2 caracteres.").max(100),
  bank: z.string().trim().min(2, "Informe o banco ou emissor.").max(100),
  holderMemberId: uuid,
  creditLimit: positiveMoney,
  closingDay: billingDay,
  dueDay: billingDay,
});

export function creditCardPurchaseSchemaForDate(maxPurchaseDate?: string) {
  return z
    .object({
      cardId: uuid,
      description: z.string().trim().min(2, "Descreva a compra.").max(160),
      amount: positiveMoney,
      categoryId: uuid,
      purchaseDate: z
        .string()
        .refine(isCivilDate, "Informe uma data de compra válida."),
      payerMemberId: optionalUuid,
      splitMethod: z.enum([
        "INDIVIDUAL",
        "EQUAL",
        "PERCENTAGE",
        "CUSTOM",
        "INCOME_BASED",
      ]),
      responsibleMemberId: optionalUuid,
      splitDetails: z
        .string()
        .max(20_000, "A divisão informada é muito extensa.")
        .default("[]"),
      notes: z.string().trim().max(500, "Use no máximo 500 caracteres.").optional(),
    })
    .superRefine((value, context) => {
      if (value.splitMethod === "INDIVIDUAL" && !value.responsibleMemberId) {
        context.addIssue({
          code: "custom",
          path: ["responsibleMemberId"],
          message: "Selecione a pessoa responsável.",
        });
      }
      if (
        maxPurchaseDate &&
        isCivilDate(value.purchaseDate) &&
        value.purchaseDate > maxPurchaseDate
      ) {
        context.addIssue({
          code: "custom",
          path: ["purchaseDate"],
          message: "A data da compra não pode estar no futuro.",
        });
      }
    });
}

export const creditCardPurchaseSchema = creditCardPurchaseSchemaForDate();

export function creditCardPaymentSchemaForDate(maxPaymentDate?: string) {
  return z
    .object({
      sourceAccountId: uuid,
      paymentDate: z
        .string()
        .refine(isCivilDate, "Informe uma data de pagamento válida."),
    })
    .superRefine((value, context) => {
      if (
        maxPaymentDate &&
        isCivilDate(value.paymentDate) &&
        value.paymentDate > maxPaymentDate
      ) {
        context.addIssue({
          code: "custom",
          path: ["paymentDate"],
          message: "A data do pagamento não pode estar no futuro.",
        });
      }
    });
}

export const creditCardInvoiceIdSchema = z
  .string()
  .uuid("Fatura de cartão inválida.");
