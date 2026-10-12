import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  materializeRecurringRule,
  RecurrenceMaterializationError,
} from "@/features/finance/recurrence-materializer";

const ids = {
  space: "00000000-0000-4000-8000-000000000001",
  externalSpace: "00000000-0000-4000-8000-000000000002",
  user: "00000000-0000-4000-8000-000000000003",
  memberA: "00000000-0000-4000-8000-000000000010",
  memberB: "00000000-0000-4000-8000-000000000011",
  account: "00000000-0000-4000-8000-000000000020",
  category: "00000000-0000-4000-8000-000000000030",
  rule: "00000000-0000-4000-8000-000000000040",
};

function recurringRule(overrides: Record<string, unknown> = {}) {
  return {
    id: ids.rule,
    financialSpaceId: ids.space,
    accountId: ids.account,
    categoryId: ids.category,
    payerMemberId: ids.memberA,
    createdById: ids.user,
    type: "EXPENSE",
    status: "PENDING",
    splitMethod: "EQUAL",
    frequency: "MONTHLY",
    state: "ACTIVE",
    description: "Aluguel",
    amount: "100.00",
    startDate: new Date("2026-01-31T00:00:00.000Z"),
    endDate: null,
    dayOfMonth: 31,
    nextOccurrence: new Date("2026-01-31T00:00:00.000Z"),
    notes: null,
    account: { deletedAt: null },
    category: { deletedAt: null },
    splits: [
      {
        memberId: ids.memberA,
        amount: "50.00",
        percentage: null,
        member: { user: { name: "Ana" } },
      },
      {
        memberId: ids.memberB,
        amount: "50.00",
        percentage: null,
        member: { user: { name: "Bia" } },
      },
    ],
    ...overrides,
  };
}

function transactionDouble() {
  return {
    recurringRule: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    memberIncome: { findMany: vi.fn() },
    financialTransaction: { upsert: vi.fn() },
  };
}

type MaterializerTransaction = Parameters<typeof materializeRecurringRule>[0];

describe("materializeRecurringRule", () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  it("isola a busca pelo espaço financeiro antes de qualquer escrita", async () => {
    const transaction = transactionDouble();
    transaction.recurringRule.findFirst.mockResolvedValue(null);

    await expect(
      materializeRecurringRule(transaction as unknown as MaterializerTransaction, {
        recurringRuleId: ids.rule,
        financialSpaceId: ids.externalSpace,
        horizonDate: "2026-03-31",
      }),
    ).rejects.toThrow(RecurrenceMaterializationError);

    expect(transaction.recurringRule.findFirst).toHaveBeenCalledWith({
      where: {
        id: ids.rule,
        financialSpaceId: ids.externalSpace,
        deletedAt: null,
      },
      include: expect.any(Object),
    });
    expect(transaction.financialTransaction.upsert).not.toHaveBeenCalled();
    expect(transaction.recurringRule.update).not.toHaveBeenCalled();
  });

  it("materializa meses curtos como pendentes e avança o cursor", async () => {
    const transaction = transactionDouble();
    transaction.recurringRule.findFirst.mockResolvedValue(recurringRule());
    transaction.financialTransaction.upsert.mockResolvedValue({ id: "transaction" });
    transaction.recurringRule.update.mockResolvedValue({ id: ids.rule });

    const result = await materializeRecurringRule(
      transaction as unknown as MaterializerTransaction,
      {
        recurringRuleId: ids.rule,
        financialSpaceId: ids.space,
        horizonDate: "2026-03-31",
      },
    );

    expect(result).toEqual({
      processed: 3,
      nextOccurrenceDate: new Date("2026-04-30T00:00:00.000Z"),
    });
    expect(transaction.financialTransaction.upsert).toHaveBeenCalledTimes(3);
    expect(
      transaction.financialTransaction.upsert.mock.calls.map(
        ([argument]) => argument.where.recurringRuleId_occurrenceDate,
      ),
    ).toEqual([
      {
        recurringRuleId: ids.rule,
        occurrenceDate: new Date("2026-01-31T00:00:00.000Z"),
      },
      {
        recurringRuleId: ids.rule,
        occurrenceDate: new Date("2026-02-28T00:00:00.000Z"),
      },
      {
        recurringRuleId: ids.rule,
        occurrenceDate: new Date("2026-03-31T00:00:00.000Z"),
      },
    ]);
    for (const [argument] of transaction.financialTransaction.upsert.mock.calls) {
      expect(argument.update).toEqual({ deletedAt: null });
      expect(argument.create).toMatchObject({
        financialSpaceId: ids.space,
        recurringRuleId: ids.rule,
        status: "PENDING",
        paidAt: null,
        splits: {
          create: [
            {
              memberId: ids.memberA,
              amount: "50.00",
              percentage: null,
            },
            {
              memberId: ids.memberB,
              amount: "50.00",
              percentage: null,
            },
          ],
        },
      });
    }
    expect(transaction.recurringRule.update).toHaveBeenCalledWith({
      where: { id: ids.rule },
      data: {
        nextOccurrence: new Date("2026-04-30T00:00:00.000Z"),
        state: "ACTIVE",
      },
    });
  });

  it("é idempotente pela chave composta e restaura uma previsão excluída", async () => {
    const transaction = transactionDouble();
    transaction.recurringRule.findFirst.mockResolvedValue(
      recurringRule({
        startDate: new Date("2026-02-15T00:00:00.000Z"),
        dayOfMonth: 15,
        nextOccurrence: new Date("2026-02-15T00:00:00.000Z"),
      }),
    );
    transaction.financialTransaction.upsert.mockResolvedValue({ id: "existing" });
    transaction.recurringRule.update.mockResolvedValue({ id: ids.rule });

    await materializeRecurringRule(
      transaction as unknown as MaterializerTransaction,
      {
        recurringRuleId: ids.rule,
        financialSpaceId: ids.space,
        horizonDate: "2026-02-15",
      },
    );

    expect(transaction.financialTransaction.upsert).toHaveBeenCalledOnce();
    expect(transaction.financialTransaction.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          recurringRuleId_occurrenceDate: {
            recurringRuleId: ids.rule,
            occurrenceDate: new Date("2026-02-15T00:00:00.000Z"),
          },
        },
        update: { deletedAt: null },
      }),
    );
    expect(transaction.financialTransaction.upsert).not.toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: expect.anything() } }),
    );
  });

  it("respeita a data final inclusiva e encerra a regra após a última ocorrência", async () => {
    const transaction = transactionDouble();
    transaction.recurringRule.findFirst.mockResolvedValue(
      recurringRule({ endDate: new Date("2026-03-31T00:00:00.000Z") }),
    );
    transaction.financialTransaction.upsert.mockResolvedValue({ id: "transaction" });
    transaction.recurringRule.update.mockResolvedValue({ id: ids.rule });

    const result = await materializeRecurringRule(
      transaction as unknown as MaterializerTransaction,
      {
        recurringRuleId: ids.rule,
        financialSpaceId: ids.space,
        horizonDate: "2026-12-31",
      },
    );

    expect(result).toEqual({ processed: 3, nextOccurrenceDate: null });
    expect(transaction.financialTransaction.upsert).toHaveBeenCalledTimes(3);
    expect(transaction.recurringRule.update).toHaveBeenCalledWith({
      where: { id: ids.rule },
      data: { nextOccurrence: null, state: "ENDED" },
    });
  });

  it("não materializa nem avança uma regra pausada", async () => {
    const nextOccurrence = new Date("2026-01-31T00:00:00.000Z");
    const transaction = transactionDouble();
    transaction.recurringRule.findFirst.mockResolvedValue(
      recurringRule({ state: "PAUSED", nextOccurrence }),
    );

    await expect(
      materializeRecurringRule(transaction as unknown as MaterializerTransaction, {
        recurringRuleId: ids.rule,
        financialSpaceId: ids.space,
        horizonDate: "2026-12-31",
      }),
    ).resolves.toEqual({ processed: 0, nextOccurrenceDate: nextOccurrence });
    expect(transaction.financialTransaction.upsert).not.toHaveBeenCalled();
    expect(transaction.recurringRule.update).not.toHaveBeenCalled();
  });
});
