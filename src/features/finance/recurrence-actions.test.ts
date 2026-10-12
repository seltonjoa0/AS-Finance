import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  class MaterializationError extends Error {}

  const transactionClient = {
    recurringRule: {
      create: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    financialTransaction: {
      findFirst: vi.fn(),
      updateMany: vi.fn(),
    },
  };
  const databaseClient = {
    account: { findFirst: vi.fn() },
    category: { findFirst: vi.fn() },
    spaceMember: { findMany: vi.fn() },
    memberIncome: { findMany: vi.fn() },
    recurringRule: { findMany: vi.fn() },
    $transaction: vi.fn(),
  };

  return {
    MaterializationError,
    transactionClient,
    databaseClient,
    database: vi.fn(() => databaseClient),
    firstRecurringForecastDate: vi.fn(),
    materializeRecurringRule: vi.fn(),
    recurringForecastHorizon: vi.fn(),
    revalidatePath: vi.fn(),
    requireFinancialContext: vi.fn(),
  };
});

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/auth/session", () => ({
  requireFinancialContext: mocks.requireFinancialContext,
}));
vi.mock("@/lib/db/client", () => ({ database: mocks.database }));
vi.mock("@/features/finance/recurrence-materializer", () => ({
  RecurrenceMaterializationError: mocks.MaterializationError,
  firstRecurringForecastDate: mocks.firstRecurringForecastDate,
  materializeRecurringRule: mocks.materializeRecurringRule,
  recurringForecastHorizon: mocks.recurringForecastHorizon,
}));

import {
  createRecurringRuleAction,
  endRecurringRuleAction,
  toggleRecurringRuleAction,
} from "@/features/finance/recurrence-actions";

const ids = {
  space: "00000000-0000-4000-8000-000000000001",
  user: "00000000-0000-4000-8000-000000000002",
  member: "00000000-0000-4000-8000-000000000010",
  externalMember: "00000000-0000-4000-8000-000000000011",
  account: "00000000-0000-4000-8000-000000000020",
  category: "00000000-0000-4000-8000-000000000030",
  rule: "00000000-0000-4000-8000-000000000040",
};

const financialContext = {
  user: { id: ids.user },
  space: {
    id: ids.space,
    currency: "BRL",
    timezone: "America/Sao_Paulo",
  },
  membership: { id: ids.member, role: "MEMBER" },
};

function formData(values: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

function recurringRuleForm(overrides: Record<string, string> = {}) {
  return formData({
    type: "EXPENSE",
    description: "Aluguel",
    amount: "1.500,00",
    accountId: ids.account,
    categoryId: ids.category,
    transactionStatus: "PENDING",
    startDate: "2026-10-31",
    endDate: "",
    payerMemberId: "",
    splitMethod: "INDIVIDUAL",
    responsibleMemberId: ids.member,
    splitDetails: "[]",
    notes: "",
    ...overrides,
  });
}

function resetMocks() {
  for (const client of [mocks.databaseClient, mocks.transactionClient]) {
    for (const model of Object.values(client)) {
      if (typeof model === "function") {
        model.mockReset();
        continue;
      }
      for (const operation of Object.values(model)) operation.mockReset();
    }
  }

  mocks.database.mockClear();
  mocks.firstRecurringForecastDate.mockReset();
  mocks.materializeRecurringRule.mockReset();
  mocks.recurringForecastHorizon.mockReset();
  mocks.revalidatePath.mockReset();
  mocks.requireFinancialContext.mockReset();

  mocks.requireFinancialContext.mockResolvedValue(financialContext);
  mocks.firstRecurringForecastDate.mockReturnValue("2026-10-31");
  mocks.recurringForecastHorizon.mockReturnValue("2027-04-12");
  mocks.materializeRecurringRule.mockResolvedValue({
    processed: 1,
    nextOccurrenceDate: new Date("2026-11-30T00:00:00.000Z"),
  });
  mocks.databaseClient.$transaction.mockImplementation(
    async (callback: (transaction: typeof mocks.transactionClient) => unknown) =>
      callback(mocks.transactionClient),
  );
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-12T15:00:00.000Z"));
  resetMocks();
});

describe("createRecurringRuleAction", () => {
  beforeEach(() => {
    mocks.databaseClient.account.findFirst.mockResolvedValue({ id: ids.account });
    mocks.databaseClient.category.findFirst.mockResolvedValue({
      id: ids.category,
      type: "EXPENSE",
    });
    mocks.databaseClient.spaceMember.findMany.mockResolvedValue([
      { id: ids.member, user: { name: "Ana" } },
    ]);
  });

  it("rejeita conta de outro espaço antes de abrir a transação", async () => {
    mocks.databaseClient.account.findFirst.mockResolvedValue(null);

    const result = await createRecurringRuleAction(
      { status: "idle" },
      recurringRuleForm(),
    );

    expect(result).toEqual({
      status: "error",
      fieldErrors: { accountId: ["Conta inválida para este espaço."] },
    });
    expect(mocks.databaseClient.account.findFirst).toHaveBeenCalledWith({
      where: {
        id: ids.account,
        financialSpaceId: ids.space,
        deletedAt: null,
      },
      select: { id: true, type: true },
    });
    expect(mocks.databaseClient.$transaction).not.toHaveBeenCalled();
  });

  it("rejeita conta interna de cartão em uma recorrência genérica", async () => {
    mocks.databaseClient.account.findFirst.mockResolvedValue({
      id: ids.account,
      type: "CREDIT_CARD",
    });

    const result = await createRecurringRuleAction(
      { status: "idle" },
      recurringRuleForm(),
    );

    expect(result).toEqual({
      status: "error",
      fieldErrors: {
        accountId: [
          "Recorrências de cartão serão tratadas em uma etapa futura.",
        ],
      },
    });
    expect(mocks.databaseClient.$transaction).not.toHaveBeenCalled();
  });

  it("rejeita pagador que não é membro ativo do espaço", async () => {
    const result = await createRecurringRuleAction(
      { status: "idle" },
      recurringRuleForm({ payerMemberId: ids.externalMember }),
    );

    expect(result).toEqual({
      status: "error",
      fieldErrors: { payerMemberId: ["Pagador inválido para este espaço."] },
    });
    expect(mocks.databaseClient.spaceMember.findMany).toHaveBeenCalledWith({
      where: { financialSpaceId: ids.space, revokedAt: null },
      select: { id: true, user: { select: { name: true } } },
      orderBy: { createdAt: "asc" },
    });
    expect(mocks.databaseClient.$transaction).not.toHaveBeenCalled();
  });
});

describe("ciclo de vida de uma recorrência", () => {
  it("não altera uma regra pertencente a outro espaço", async () => {
    mocks.transactionClient.recurringRule.findFirst.mockResolvedValue(null);

    const result = await toggleRecurringRuleAction(
      ids.rule,
      { status: "idle" },
      new FormData(),
    );

    expect(result).toEqual({
      status: "error",
      message: "Regra recorrente não encontrada.",
    });
    expect(mocks.transactionClient.recurringRule.findFirst).toHaveBeenCalledWith({
      where: {
        id: ids.rule,
        financialSpaceId: ids.space,
        deletedAt: null,
      },
      select: { id: true, state: true, nextOccurrence: true },
    });
    expect(
      mocks.transactionClient.financialTransaction.updateMany,
    ).not.toHaveBeenCalled();
    expect(mocks.transactionClient.recurringRule.update).not.toHaveBeenCalled();
    expect(mocks.materializeRecurringRule).not.toHaveBeenCalled();
  });

  it("ao pausar remove somente previsões futuras pendentes do mesmo espaço", async () => {
    const firstFuture = new Date("2026-10-31T00:00:00.000Z");
    mocks.transactionClient.recurringRule.findFirst.mockResolvedValue({
      id: ids.rule,
      state: "ACTIVE",
      nextOccurrence: new Date("2027-05-31T00:00:00.000Z"),
    });
    mocks.transactionClient.financialTransaction.findFirst.mockResolvedValue({
      occurrenceDate: firstFuture,
    });
    mocks.transactionClient.financialTransaction.updateMany.mockResolvedValue({
      count: 6,
    });

    const result = await toggleRecurringRuleAction(
      ids.rule,
      { status: "idle" },
      new FormData(),
    );

    expect(result.status).toBe("success");
    expect(
      mocks.transactionClient.financialTransaction.updateMany,
    ).toHaveBeenCalledWith({
      where: {
        recurringRuleId: ids.rule,
        financialSpaceId: ids.space,
        status: "PENDING",
        occurrenceDate: { gt: new Date("2026-10-12T00:00:00.000Z") },
        deletedAt: null,
      },
      data: { deletedAt: expect.any(Date) },
    });
    expect(mocks.transactionClient.recurringRule.update).toHaveBeenCalledWith({
      where: { id: ids.rule },
      data: { state: "PAUSED", nextOccurrence: firstFuture },
    });
    expect(mocks.materializeRecurringRule).not.toHaveBeenCalled();
  });

  it("ao retomar ativa antes de restaurar/materializar o horizonte", async () => {
    mocks.transactionClient.recurringRule.findFirst.mockResolvedValue({
      id: ids.rule,
      state: "PAUSED",
      nextOccurrence: new Date("2026-10-31T00:00:00.000Z"),
    });

    const result = await toggleRecurringRuleAction(
      ids.rule,
      { status: "idle" },
      new FormData(),
    );

    expect(result.status).toBe("success");
    expect(mocks.transactionClient.recurringRule.update).toHaveBeenCalledWith({
      where: { id: ids.rule },
      data: { state: "ACTIVE" },
    });
    expect(mocks.materializeRecurringRule).toHaveBeenCalledWith(
      mocks.transactionClient,
      {
        recurringRuleId: ids.rule,
        financialSpaceId: ids.space,
        horizonDate: "2027-04-12",
      },
    );
    expect(
      mocks.transactionClient.recurringRule.update.mock.invocationCallOrder[0],
    ).toBeLessThan(mocks.materializeRecurringRule.mock.invocationCallOrder[0]!);
  });

  it("ao encerrar preserva o presente e exclui somente previsões futuras", async () => {
    mocks.transactionClient.recurringRule.findFirst.mockResolvedValue({
      id: ids.rule,
      state: "ACTIVE",
      startDate: new Date("2026-01-31T00:00:00.000Z"),
      endDate: null,
    });
    mocks.transactionClient.financialTransaction.updateMany.mockResolvedValue({
      count: 6,
    });

    const result = await endRecurringRuleAction(
      ids.rule,
      { status: "idle" },
      new FormData(),
    );

    expect(result.status).toBe("success");
    expect(
      mocks.transactionClient.financialTransaction.updateMany,
    ).toHaveBeenCalledWith({
      where: {
        recurringRuleId: ids.rule,
        financialSpaceId: ids.space,
        status: "PENDING",
        occurrenceDate: { gt: new Date("2026-10-12T00:00:00.000Z") },
        deletedAt: null,
      },
      data: { deletedAt: expect.any(Date) },
    });
    expect(mocks.transactionClient.recurringRule.update).toHaveBeenCalledWith({
      where: { id: ids.rule },
      data: {
        state: "ENDED",
        endDate: new Date("2026-10-12T00:00:00.000Z"),
        nextOccurrence: null,
      },
    });
  });
});
