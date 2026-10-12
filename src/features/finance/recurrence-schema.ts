import { z } from "zod";

import { isCivilDate } from "@/features/finance/dates";
import { parseMoneyToCents } from "@/features/finance/money";

const uuid = z.string().uuid("Selecione uma opção válida.");
const optionalUuid = z.preprocess(
  (value) => (value === "" ? undefined : value),
  uuid.optional(),
);
const optionalDate = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.string().refine(isCivilDate, "Informe uma data válida.").optional(),
);

export const recurringRuleSchema = z
  .object({
    type: z.enum(["INCOME", "EXPENSE"]),
    description: z.string().trim().min(2, "Descreva a recorrência.").max(160),
    amount: z
      .string()
      .trim()
      .refine((value) => {
        const cents = parseMoneyToCents(value);
        return cents !== null && cents > 0n;
      }, "Informe um valor maior que zero."),
    accountId: uuid,
    categoryId: uuid,
    transactionStatus: z.literal("PENDING", {
      error: "As previsões recorrentes devem iniciar como pendentes.",
    }),
    startDate: z.string().refine(isCivilDate, "Informe uma data inicial válida."),
    endDate: optionalDate,
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
    if (value.endDate && value.endDate < value.startDate) {
      context.addIssue({
        code: "custom",
        path: ["endDate"],
        message: "A data final não pode ser anterior à data inicial.",
      });
    }
    if (value.splitMethod === "INDIVIDUAL" && !value.responsibleMemberId) {
      context.addIssue({
        code: "custom",
        path: ["responsibleMemberId"],
        message: "Selecione a pessoa responsável.",
      });
    }
    if (value.type === "INCOME" && value.splitMethod !== "INDIVIDUAL") {
      context.addIssue({
        code: "custom",
        path: ["splitMethod"],
        message: "Receitas recorrentes devem ter um responsável individual nesta fase.",
      });
    }
  });

export const recurringRuleIdSchema = z.string().uuid("Regra recorrente inválida.");

