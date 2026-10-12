"use server";

import { revalidatePath } from "next/cache";

import { civilDate, todayInTimezone } from "@/features/finance/dates";
import { resolveIncomeDetails } from "@/features/finance/incomes";
import { centsToDecimal, parseMoneyToCents } from "@/features/finance/money";
import {
  firstRecurringForecastDate,
  materializeRecurringRule,
  RecurrenceMaterializationError,
  recurringForecastHorizon,
} from "@/features/finance/recurrence-materializer";
import {
  recurringRuleIdSchema,
  recurringRuleSchema,
} from "@/features/finance/recurrence-schema";
import {
  buildTransactionSplits,
  parseSplitDetails,
} from "@/features/finance/splits";
import { requireFinancialContext } from "@/lib/auth/session";
import { database } from "@/lib/db/client";
import { fieldErrors, type FormState } from "@/lib/validation/form-state";

function revalidateRecurringFinance() {
  revalidatePath("/app", "layout");
  revalidatePath("/app/recorrencias");
  revalidatePath("/app/movimentacoes");
}

export async function createRecurringRuleAction(
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  const context = await requireFinancialContext();
  const result = recurringRuleSchema.safeParse(Object.fromEntries(formData));
  if (!result.success) {
    return { status: "error", fieldErrors: fieldErrors(result.error) };
  }

  const data = result.data;
  const today = todayInTimezone(context.space.timezone);
  const firstOccurrence = firstRecurringForecastDate({
    startDate: data.startDate,
    endDate: data.endDate ?? null,
    today,
  });
  if (!firstOccurrence) {
    return {
      status: "error",
      fieldErrors: {
        endDate: ["O período informado não possui nenhuma previsão futura."],
      },
    };
  }

  const details = parseSplitDetails(data.splitDetails);
  if (!details) {
    return {
      status: "error",
      fieldErrors: { splitDetails: ["A divisão enviada não está em um formato válido."] },
    };
  }

  const [account, category, activeMembers] = await Promise.all([
    database().account.findFirst({
      where: {
        id: data.accountId,
        financialSpaceId: context.space.id,
        deletedAt: null,
      },
      select: { id: true, type: true },
    }),
    database().category.findFirst({
      where: {
        id: data.categoryId,
        financialSpaceId: context.space.id,
        deletedAt: null,
      },
      select: { id: true, type: true },
    }),
    database().spaceMember.findMany({
      where: { financialSpaceId: context.space.id, revokedAt: null },
      select: { id: true, user: { select: { name: true } } },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  if (!account) {
    return {
      status: "error",
      fieldErrors: { accountId: ["Conta inválida para este espaço."] },
    };
  }
  if (account.type === "CREDIT_CARD") {
    return {
      status: "error",
      fieldErrors: {
        accountId: ["Recorrências de cartão serão tratadas em uma etapa futura."],
      },
    };
  }
  if (!category || category.type !== data.type) {
    return {
      status: "error",
      fieldErrors: { categoryId: ["Categoria incompatível com a recorrência."] },
    };
  }

  const memberIds = activeMembers.map((member) => member.id);
  if (data.payerMemberId && !memberIds.includes(data.payerMemberId)) {
    return {
      status: "error",
      fieldErrors: { payerMemberId: ["Pagador inválido para este espaço."] },
    };
  }

  let authoritativeDetails = details;
  if (data.splitMethod === "INCOME_BASED") {
    const incomeHistory = await database().memberIncome.findMany({
      where: {
        financialSpaceId: context.space.id,
        memberId: { in: memberIds },
        effectiveFrom: { lte: civilDate(firstOccurrence) },
      },
      select: { memberId: true, amount: true, effectiveFrom: true },
      orderBy: [{ effectiveFrom: "desc" }, { createdAt: "desc" }],
    });
    const resolved = resolveIncomeDetails({
      memberIds,
      history: incomeHistory.map((income) => ({
        memberId: income.memberId,
        amount: income.amount.toString(),
        effectiveFrom: income.effectiveFrom.toISOString().slice(0, 10),
      })),
      competenceDate: firstOccurrence,
    });
    if (resolved.missingMemberIds.length > 0) {
      const missing = activeMembers
        .filter((member) => resolved.missingMemberIds.includes(member.id))
        .map((member) => member.user.name)
        .join(", ");
      return {
        status: "error",
        fieldErrors: {
          splitDetails: [`Cadastre uma renda vigente para: ${missing}.`],
        },
      };
    }
    authoritativeDetails = resolved.details;
  }

  const amountCents = parseMoneyToCents(data.amount)!;
  const splitResult = buildTransactionSplits({
    method: data.splitMethod,
    totalCents: amountCents,
    memberIds,
    responsibleMemberId: data.responsibleMemberId,
    details: authoritativeDetails,
  });
  if (!splitResult.success) {
    const field =
      data.splitMethod === "INDIVIDUAL" ? "responsibleMemberId" : "splitDetails";
    return { status: "error", fieldErrors: { [field]: [splitResult.message] } };
  }

  try {
    await database().$transaction(async (transaction) => {
      const rule = await transaction.recurringRule.create({
        data: {
          financialSpaceId: context.space.id,
          accountId: account.id,
          categoryId: category.id,
          payerMemberId:
            data.type === "EXPENSE" ? (data.payerMemberId ?? null) : null,
          createdById: context.user.id,
          type: data.type,
          status: "PENDING",
          splitMethod: data.splitMethod,
          frequency: "MONTHLY",
          state: "ACTIVE",
          description: data.description,
          amount: centsToDecimal(amountCents),
          startDate: civilDate(data.startDate),
          endDate: data.endDate ? civilDate(data.endDate) : null,
          dayOfMonth: Number(data.startDate.slice(8, 10)),
          nextOccurrence: civilDate(firstOccurrence),
          notes: data.notes || null,
          splits: {
            create: splitResult.splits.map((split) => ({
              memberId: split.memberId,
              amount: centsToDecimal(split.cents),
              percentage: split.percentage ?? null,
            })),
          },
        },
        select: { id: true },
      });

      await materializeRecurringRule(transaction, {
        recurringRuleId: rule.id,
        financialSpaceId: context.space.id,
        horizonDate: recurringForecastHorizon(today),
      });
    });
  } catch (error) {
    if (error instanceof RecurrenceMaterializationError) {
      return { status: "error", message: error.message };
    }
    return {
      status: "error",
      message: "Não foi possível criar a recorrência. Tente novamente.",
    };
  }

  revalidateRecurringFinance();
  return {
    status: "success",
    message: "Recorrência criada e previsões atualizadas com sucesso.",
  };
}

export async function toggleRecurringRuleAction(
  recurringRuleId: string,
  _previousState: FormState,
  _formData: FormData,
): Promise<FormState> {
  void _previousState;
  void _formData;
  const context = await requireFinancialContext();
  const idResult = recurringRuleIdSchema.safeParse(recurringRuleId);
  if (!idResult.success) {
    return { status: "error", message: "Regra recorrente inválida." };
  }

  const today = todayInTimezone(context.space.timezone);
  try {
    const nextState = await database().$transaction(async (transaction) => {
      const rule = await transaction.recurringRule.findFirst({
        where: {
          id: idResult.data,
          financialSpaceId: context.space.id,
          deletedAt: null,
        },
        select: { id: true, state: true, nextOccurrence: true },
      });
      if (!rule) throw new RecurrenceMaterializationError("Regra recorrente não encontrada.");
      if (rule.state === "ENDED") {
        throw new RecurrenceMaterializationError(
          "Uma recorrência encerrada não pode ser retomada.",
        );
      }

      if (rule.state === "ACTIVE") {
        const firstFuture = await transaction.financialTransaction.findFirst({
          where: {
            recurringRuleId: rule.id,
            financialSpaceId: context.space.id,
            status: "PENDING",
            occurrenceDate: { gt: civilDate(today) },
            deletedAt: null,
          },
          select: { occurrenceDate: true },
          orderBy: { occurrenceDate: "asc" },
        });
        await transaction.financialTransaction.updateMany({
          where: {
            recurringRuleId: rule.id,
            financialSpaceId: context.space.id,
            status: "PENDING",
            occurrenceDate: { gt: civilDate(today) },
            deletedAt: null,
          },
          data: { deletedAt: new Date() },
        });
        await transaction.recurringRule.update({
          where: { id: rule.id },
          data: {
            state: "PAUSED",
            nextOccurrence: firstFuture?.occurrenceDate ?? rule.nextOccurrence,
          },
        });
        return "PAUSED" as const;
      }

      await transaction.recurringRule.update({
        where: { id: rule.id },
        data: { state: "ACTIVE" },
      });
      await materializeRecurringRule(transaction, {
        recurringRuleId: rule.id,
        financialSpaceId: context.space.id,
        horizonDate: recurringForecastHorizon(today),
      });
      return "ACTIVE" as const;
    });

    revalidateRecurringFinance();
    return {
      status: "success",
      message:
        nextState === "PAUSED"
          ? "Recorrência pausada. As previsões futuras foram retiradas."
          : "Recorrência retomada e previsões atualizadas.",
    };
  } catch (error) {
    return {
      status: "error",
      message:
        error instanceof RecurrenceMaterializationError
          ? error.message
          : "Não foi possível alterar a recorrência.",
    };
  }
}

export async function endRecurringRuleAction(
  recurringRuleId: string,
  _previousState: FormState,
  _formData: FormData,
): Promise<FormState> {
  void _previousState;
  void _formData;
  const context = await requireFinancialContext();
  const idResult = recurringRuleIdSchema.safeParse(recurringRuleId);
  if (!idResult.success) {
    return { status: "error", message: "Regra recorrente inválida." };
  }

  const today = todayInTimezone(context.space.timezone);
  try {
    await database().$transaction(async (transaction) => {
      const rule = await transaction.recurringRule.findFirst({
        where: {
          id: idResult.data,
          financialSpaceId: context.space.id,
          deletedAt: null,
        },
        select: { id: true, state: true, startDate: true, endDate: true },
      });
      if (!rule) throw new RecurrenceMaterializationError("Regra recorrente não encontrada.");
      if (rule.state === "ENDED") return;

      await transaction.financialTransaction.updateMany({
        where: {
          recurringRuleId: rule.id,
          financialSpaceId: context.space.id,
          status: "PENDING",
          occurrenceDate: { gt: civilDate(today) },
          deletedAt: null,
        },
        data: { deletedAt: new Date() },
      });

      const startDate = rule.startDate.toISOString().slice(0, 10);
      const existingEndDate = rule.endDate?.toISOString().slice(0, 10) ?? null;
      const effectiveEndDate =
        existingEndDate && existingEndDate < today
          ? existingEndDate
          : today < startDate
            ? startDate
            : today;
      await transaction.recurringRule.update({
        where: { id: rule.id },
        data: {
          state: "ENDED",
          endDate: civilDate(effectiveEndDate),
          nextOccurrence: null,
        },
      });
    });
  } catch (error) {
    return {
      status: "error",
      message:
        error instanceof RecurrenceMaterializationError
          ? error.message
          : "Não foi possível encerrar a recorrência.",
    };
  }

  revalidateRecurringFinance();
  return {
    status: "success",
    message: "Recorrência encerrada e previsões futuras retiradas.",
  };
}

export async function materializeRecurringRulesAction(
  _previousState: FormState,
  _formData: FormData,
): Promise<FormState> {
  void _previousState;
  void _formData;
  const context = await requireFinancialContext();
  const today = todayInTimezone(context.space.timezone);
  const horizonDate = recurringForecastHorizon(today);
  const rules = await database().recurringRule.findMany({
    where: {
      financialSpaceId: context.space.id,
      state: "ACTIVE",
      deletedAt: null,
      nextOccurrence: { lte: civilDate(horizonDate) },
    },
    select: { id: true },
    orderBy: { nextOccurrence: "asc" },
    take: 100,
  });

  let processed = 0;
  try {
    for (const rule of rules) {
      const result = await database().$transaction((transaction) =>
        materializeRecurringRule(transaction, {
          recurringRuleId: rule.id,
          financialSpaceId: context.space.id,
          horizonDate,
        }),
      );
      processed += result.processed;
    }
  } catch (error) {
    return {
      status: "error",
      message:
        error instanceof RecurrenceMaterializationError
          ? error.message
          : "Não foi possível atualizar todas as previsões.",
    };
  }

  revalidateRecurringFinance();
  return {
    status: "success",
    message:
      processed === 0
        ? "As previsões já estavam atualizadas."
        : `${processed} ${processed === 1 ? "previsão atualizada" : "previsões atualizadas"}.`,
  };
}
