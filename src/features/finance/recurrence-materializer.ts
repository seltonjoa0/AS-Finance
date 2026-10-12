import type { Prisma } from "@/generated/prisma/client";

import { civilDate } from "@/features/finance/dates";
import { resolveIncomeDetails } from "@/features/finance/incomes";
import { centsToDecimal, parseMoneyToCents } from "@/features/finance/money";
import {
  materializeRecurrenceCompetences,
  nextRecurrenceCompetence,
  recurrenceCompetenceAt,
} from "@/features/finance/recurrences";
import { buildTransactionSplits } from "@/features/finance/splits";

export const RECURRING_FORECAST_MONTHS = 6;

export class RecurrenceMaterializationError extends Error {}

function toCivilDateString(value: Date) {
  return value.toISOString().slice(0, 10);
}

function previousCivilDate(value: string) {
  const previous = civilDate(value);
  previous.setUTCDate(previous.getUTCDate() - 1);
  return toCivilDateString(previous);
}

export function recurringForecastHorizon(fromDate: string) {
  return recurrenceCompetenceAt(
    { startDate: fromDate },
    RECURRING_FORECAST_MONTHS,
  )!;
}

export function firstRecurringForecastDate({
  startDate,
  endDate,
  today,
}: {
  startDate: string;
  endDate: string | null;
  today: string;
}) {
  return nextRecurrenceCompetence(
    {
      startDate,
      endDate,
      dayOfMonth: Number(startDate.slice(8, 10)),
    },
    previousCivilDate(today),
  );
}

export async function materializeRecurringRule(
  transaction: Prisma.TransactionClient,
  {
    recurringRuleId,
    financialSpaceId,
    horizonDate,
  }: {
    recurringRuleId: string;
    financialSpaceId: string;
    horizonDate: string;
  },
) {
  const rule = await transaction.recurringRule.findFirst({
    where: {
      id: recurringRuleId,
      financialSpaceId,
      deletedAt: null,
    },
    include: {
      account: { select: { deletedAt: true } },
      category: { select: { deletedAt: true } },
      splits: {
        include: { member: { select: { user: { select: { name: true } } } } },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!rule) {
    throw new RecurrenceMaterializationError("Regra recorrente não encontrada.");
  }
  if (rule.state !== "ACTIVE" || !rule.nextOccurrence) {
    return { processed: 0, nextOccurrenceDate: rule.nextOccurrence };
  }
  if (rule.account.deletedAt || rule.category.deletedAt) {
    throw new RecurrenceMaterializationError(
      "A conta ou categoria desta recorrência não está mais disponível.",
    );
  }

  const startDate = toCivilDateString(rule.startDate);
  const endDate = rule.endDate ? toCivilDateString(rule.endDate) : null;
  const nextOccurrenceDate = toCivilDateString(rule.nextOccurrence);
  const recurrence = {
    frequency: "MONTHLY" as const,
    state: "ACTIVE" as const,
    startDate,
    endDate,
    dayOfMonth: rule.dayOfMonth,
  };
  const occurrenceDates = materializeRecurrenceCompetences({
    rule: recurrence,
    horizonDate,
    afterDate: previousCivilDate(nextOccurrenceDate),
  });

  if (occurrenceDates.length === 0) {
    return { processed: 0, nextOccurrenceDate: rule.nextOccurrence };
  }

  const memberIds = rule.splits.map((split) => split.memberId);
  if (memberIds.length === 0) {
    throw new RecurrenceMaterializationError(
      "A recorrência não possui uma divisão financeira válida.",
    );
  }

  const incomeHistory =
    rule.splitMethod === "INCOME_BASED"
      ? await transaction.memberIncome.findMany({
          where: {
            financialSpaceId,
            memberId: { in: memberIds },
            effectiveFrom: { lte: civilDate(occurrenceDates.at(-1)!) },
          },
          select: { memberId: true, amount: true, effectiveFrom: true },
          orderBy: [{ effectiveFrom: "desc" }, { createdAt: "desc" }],
        })
      : [];

  for (const occurrenceDate of occurrenceDates) {
    let details = rule.splits.map((split) => ({
      memberId: split.memberId,
      value:
        rule.splitMethod === "PERCENTAGE"
          ? (split.percentage?.toString() ?? "")
          : split.amount.toString(),
    }));

    if (rule.splitMethod === "INCOME_BASED") {
      const resolved = resolveIncomeDetails({
        memberIds,
        history: incomeHistory.map((income) => ({
          memberId: income.memberId,
          amount: income.amount.toString(),
          effectiveFrom: toCivilDateString(income.effectiveFrom),
        })),
        competenceDate: occurrenceDate,
      });

      if (resolved.missingMemberIds.length > 0) {
        const missingNames = rule.splits
          .filter((split) => resolved.missingMemberIds.includes(split.memberId))
          .map((split) => split.member.user.name)
          .join(", ");
        throw new RecurrenceMaterializationError(
          `Cadastre uma renda vigente para ${missingNames} antes de gerar ${occurrenceDate}.`,
        );
      }
      details = resolved.details;
    }

    const amountCents = parseMoneyToCents(rule.amount.toString());
    if (amountCents === null) {
      throw new RecurrenceMaterializationError(
        "O valor da recorrência está fora do formato esperado.",
      );
    }
    const splitResult = buildTransactionSplits({
      method: rule.splitMethod,
      totalCents: amountCents,
      memberIds,
      responsibleMemberId:
        rule.splitMethod === "INDIVIDUAL" ? memberIds[0] : undefined,
      details,
    });
    if (!splitResult.success) {
      throw new RecurrenceMaterializationError(splitResult.message);
    }

    const occurrence = civilDate(occurrenceDate);
    await transaction.financialTransaction.upsert({
      where: {
        recurringRuleId_occurrenceDate: {
          recurringRuleId: rule.id,
          occurrenceDate: occurrence,
        },
      },
      update: { deletedAt: null },
      create: {
        financialSpaceId,
        accountId: rule.accountId,
        categoryId: rule.categoryId,
        payerMemberId:
          rule.type === "EXPENSE" ? rule.payerMemberId : null,
        recurringRuleId: rule.id,
        occurrenceDate: occurrence,
        createdById: rule.createdById,
        type: rule.type,
        status: "PENDING",
        splitMethod: rule.splitMethod,
        description: rule.description,
        amount: centsToDecimal(amountCents),
        competenceDate: occurrence,
        dueDate: occurrence,
        paidAt: null,
        notes: rule.notes,
        splits: {
          create: splitResult.splits.map((split) => ({
            memberId: split.memberId,
            amount: centsToDecimal(split.cents),
            percentage: split.percentage ?? null,
          })),
        },
      },
    });
  }

  const nextDate = nextRecurrenceCompetence(
    recurrence,
    occurrenceDates.at(-1)!,
  );
  await transaction.recurringRule.update({
    where: { id: rule.id },
    data: {
      nextOccurrence: nextDate ? civilDate(nextDate) : null,
      state: nextDate ? "ACTIVE" : "ENDED",
    },
  });

  return {
    processed: occurrenceDates.length,
    nextOccurrenceDate: nextDate ? civilDate(nextDate) : null,
  };
}
