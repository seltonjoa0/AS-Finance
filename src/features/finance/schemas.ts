import { z } from "zod";

import { isCivilDate, todayInTimezone } from "@/features/finance/dates";
import { parseMoneyToCents } from "@/features/finance/money";

const uuid = z.string().uuid("Selecione uma opção válida.");
const optionalUuid = z.preprocess((value) => (value === "" ? undefined : value), uuid.optional());
const optionalDate = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.string().refine(isCivilDate, "Informe uma data válida.").optional(),
);

export const accountSchema = z
  .object({
    name: z.string().trim().min(2, "Informe ao menos 2 caracteres.").max(100),
    type: z.enum(["CHECKING", "SAVINGS", "CASH", "INVESTMENT", "OTHER"]),
    ownership: z.enum(["INDIVIDUAL", "SHARED"]),
    holderMemberId: optionalUuid,
    openingBalance: z
      .string()
      .trim()
      .default("0")
      .refine((value) => parseMoneyToCents(value, true) !== null, "Informe um valor válido."),
  })
  .superRefine((value, context) => {
    if (value.ownership === "INDIVIDUAL" && !value.holderMemberId) {
      context.addIssue({
        code: "custom",
        path: ["holderMemberId"],
        message: "Selecione o titular da conta.",
      });
    }
  });

export const categorySchema = z.object({
  name: z.string().trim().min(2, "Informe ao menos 2 caracteres.").max(80),
  type: z.enum(["INCOME", "EXPENSE"]),
});

export function transferSchemaForDate(maxTransferDate?: string) {
  return z
    .object({
    sourceAccountId: uuid,
    destinationAccountId: uuid,
    amount: z
      .string()
      .trim()
      .refine((value) => {
        const cents = parseMoneyToCents(value);
        return cents !== null && cents > 0n;
      }, "Informe um valor maior que zero."),
    transferDate: z.string().refine(isCivilDate, "Informe uma data válida."),
    description: z.string().trim().max(160, "Use no máximo 160 caracteres.").optional(),
    notes: z.string().trim().max(500, "Use no máximo 500 caracteres.").optional(),
    })
    .superRefine((value, context) => {
      if (value.sourceAccountId === value.destinationAccountId) {
        context.addIssue({
          code: "custom",
          path: ["destinationAccountId"],
          message: "A conta de destino deve ser diferente da conta de origem.",
        });
      }
      if (
        maxTransferDate &&
        isCivilDate(value.transferDate) &&
        value.transferDate > maxTransferDate
      ) {
        context.addIssue({
          code: "custom",
          path: ["transferDate"],
          message: "A data da transferência não pode estar no futuro.",
        });
      }
    });
}

export const transferSchema = transferSchemaForDate();

export const transactionSchema = z
  .object({
    description: z.string().trim().min(2, "Descreva a movimentação.").max(160),
    amount: z
      .string()
      .trim()
      .refine((value) => {
        const cents = parseMoneyToCents(value);
        return cents !== null && cents > 0n;
      }, "Informe um valor maior que zero."),
    type: z.enum(["INCOME", "EXPENSE"]),
    status: z.enum(["PENDING", "PAID"]),
    accountId: uuid,
    categoryId: uuid,
    payerMemberId: optionalUuid,
    responsibleMemberId: optionalUuid,
    splitMethod: z.enum(["INDIVIDUAL", "EQUAL", "PERCENTAGE", "CUSTOM"]),
    splitDetails: z.string().max(20_000, "A divisão informada é muito extensa.").default("[]"),
    competenceDate: z.string().refine(isCivilDate, "Informe uma data válida."),
    dueDate: optionalDate,
    notes: z.string().trim().max(500).optional(),
  })
  .superRefine((value, context) => {
    if (value.splitMethod === "INDIVIDUAL" && !value.responsibleMemberId) {
      context.addIssue({
        code: "custom",
        path: ["responsibleMemberId"],
        message: "Selecione a pessoa responsável.",
      });
    }
    if (value.type === "EXPENSE" && value.status === "PAID" && !value.payerMemberId) {
      context.addIssue({
        code: "custom",
        path: ["payerMemberId"],
        message: "Selecione quem pagou.",
      });
    }
    if (value.type === "INCOME" && value.splitMethod !== "INDIVIDUAL") {
      context.addIssue({
        code: "custom",
        path: ["splitMethod"],
        message: "Receitas devem ter um responsável individual nesta fase.",
      });
    }
  });

export function transactionDefaults(timeZone: string) {
  return { competenceDate: todayInTimezone(timeZone) };
}
