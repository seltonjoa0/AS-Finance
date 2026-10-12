import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const databaseClient = {
    account: { findFirst: vi.fn() },
    category: { findFirst: vi.fn() },
    spaceMember: { findMany: vi.fn() },
    memberIncome: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      createMany: vi.fn(),
    },
    financialTransaction: { create: vi.fn() },
  };

  return {
    databaseClient,
    database: vi.fn(() => databaseClient),
    redirect: vi.fn(),
    revalidatePath: vi.fn(),
    requireFinancialContext: vi.fn(),
  };
});

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/lib/auth/session", () => ({
  requireFinancialContext: mocks.requireFinancialContext,
}));
vi.mock("@/lib/db/client", () => ({ database: mocks.database }));

import {
  createIncomeSettingsAction,
  createTransactionAction,
} from "@/features/finance/actions";

const ids = {
  space: "00000000-0000-4000-8000-000000000001",
  user: "00000000-0000-4000-8000-000000000002",
  memberA: "00000000-0000-4000-8000-000000000010",
  memberB: "00000000-0000-4000-8000-000000000011",
  externalMember: "00000000-0000-4000-8000-000000000012",
  account: "00000000-0000-4000-8000-000000000020",
  category: "00000000-0000-4000-8000-000000000030",
  income: "00000000-0000-4000-8000-000000000040",
};

const ownerContext = {
  user: { id: ids.user },
  space: {
    id: ids.space,
    currency: "BRL",
    timezone: "America/Sao_Paulo",
  },
  membership: { id: ids.memberA, role: "OWNER" },
};

const activeMembers = [
  { id: ids.memberA, user: { name: "Ana" } },
  { id: ids.memberB, user: { name: "Bia" } },
];

function formData(values: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

function transactionForm(overrides: Record<string, string> = {}) {
  return formData({
    description: "Aluguel",
    amount: "100,00",
    type: "EXPENSE",
    status: "PENDING",
    accountId: ids.account,
    categoryId: ids.category,
    payerMemberId: "",
    responsibleMemberId: "",
    splitMethod: "INCOME_BASED",
    splitDetails: JSON.stringify([
      { memberId: ids.memberA, value: "0" },
      { memberId: ids.memberB, value: "10000" },
    ]),
    competenceDate: "2026-09-15",
    dueDate: "",
    notes: "",
    ...overrides,
  });
}

function incomeSettingsForm(
  details: Array<{ memberId: string; value: string }>,
  effectiveFrom = "2026-10-01",
) {
  return formData({
    effectiveFrom,
    incomeDetails: JSON.stringify(details),
  });
}

function resetDatabaseMocks() {
  for (const model of Object.values(mocks.databaseClient)) {
    for (const operation of Object.values(model)) operation.mockReset();
  }

  mocks.database.mockClear();
  mocks.redirect.mockReset();
  mocks.revalidatePath.mockReset();
  mocks.requireFinancialContext.mockReset();
  mocks.requireFinancialContext.mockResolvedValue(ownerContext);
}

beforeEach(() => {
  resetDatabaseMocks();
});

describe("createTransactionAction com divisão proporcional à renda", () => {
  beforeEach(() => {
    mocks.databaseClient.account.findFirst.mockResolvedValue({ id: ids.account });
    mocks.databaseClient.category.findFirst.mockResolvedValue({
      id: ids.category,
      type: "EXPENSE",
    });
    mocks.databaseClient.spaceMember.findMany.mockResolvedValue(activeMembers);
    mocks.databaseClient.financialTransaction.create.mockResolvedValue({
      id: "00000000-0000-4000-8000-000000000050",
    });
  });

  it("ignora o rateio adulterado e usa a renda vigente na competência", async () => {
    mocks.databaseClient.memberIncome.findMany.mockResolvedValue([
      {
        memberId: ids.memberA,
        amount: "5000.00",
        effectiveFrom: new Date("2026-08-01T00:00:00.000Z"),
      },
      {
        memberId: ids.memberA,
        amount: "4000.00",
        effectiveFrom: new Date("2026-01-01T00:00:00.000Z"),
      },
      {
        memberId: ids.memberB,
        amount: "3000.00",
        effectiveFrom: new Date("2026-08-01T00:00:00.000Z"),
      },
    ]);

    await createTransactionAction({ status: "idle" }, transactionForm());

    expect(mocks.databaseClient.spaceMember.findMany).toHaveBeenCalledWith({
      where: {
        financialSpaceId: ids.space,
        createdAt: { lt: new Date("2026-09-16T00:00:00.000Z") },
        OR: [
          { revokedAt: null },
          { revokedAt: { gt: new Date("2026-09-15T00:00:00.000Z") } },
        ],
      },
      select: { id: true, user: { select: { name: true } } },
      orderBy: { createdAt: "asc" },
    });
    expect(mocks.databaseClient.memberIncome.findMany).toHaveBeenCalledWith({
      where: {
        financialSpaceId: ids.space,
        memberId: { in: [ids.memberA, ids.memberB] },
        effectiveFrom: { lte: new Date("2026-09-15T00:00:00.000Z") },
      },
      select: { memberId: true, amount: true, effectiveFrom: true },
      orderBy: [{ effectiveFrom: "desc" }, { createdAt: "desc" }],
    });
    expect(mocks.databaseClient.financialTransaction.create).toHaveBeenCalledOnce();
    expect(mocks.databaseClient.financialTransaction.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        financialSpaceId: ids.space,
        splitMethod: "INCOME_BASED",
        splits: {
          create: [
            {
              financialSpaceId: ids.space,
              memberId: ids.memberA,
              amount: "62.50",
              percentage: "62.5000",
            },
            {
              financialSpaceId: ids.space,
              memberId: ids.memberB,
              amount: "37.50",
              percentage: "37.5000",
            },
          ],
        },
      }),
    });
    expect(mocks.redirect).toHaveBeenCalledWith("/app/movimentacoes?criada=1");
  });

  it("rejeita quando um membro elegível não possui renda vigente", async () => {
    mocks.databaseClient.memberIncome.findMany.mockResolvedValue([
      {
        memberId: ids.memberA,
        amount: "5000.00",
        effectiveFrom: new Date("2026-08-01T00:00:00.000Z"),
      },
    ]);

    const result = await createTransactionAction(
      { status: "idle" },
      transactionForm(),
    );

    expect(result).toEqual({
      status: "error",
      fieldErrors: {
        splitDetails: ["Cadastre uma renda vigente para: Bia."],
      },
    });
    expect(mocks.databaseClient.financialTransaction.create).not.toHaveBeenCalled();
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it("bloqueia receita com divisão proporcional antes de consultar o banco", async () => {
    const result = await createTransactionAction(
      { status: "idle" },
      transactionForm({ type: "INCOME" }),
    );

    expect(result).toMatchObject({
      status: "error",
      fieldErrors: { splitMethod: [expect.any(String)] },
    });
    expect(mocks.database).not.toHaveBeenCalled();
  });
});

describe("createIncomeSettingsAction", () => {
  it("permite alteração somente para OWNER", async () => {
    mocks.requireFinancialContext.mockResolvedValue({
      ...ownerContext,
      membership: { id: ids.memberA, role: "MEMBER" },
    });

    const result = await createIncomeSettingsAction(
      { status: "idle" },
      incomeSettingsForm([
        { memberId: ids.memberA, value: "5000" },
        { memberId: ids.memberB, value: "3000" },
      ]),
    );

    expect(result).toMatchObject({ status: "error", message: expect.any(String) });
    expect(mocks.database).not.toHaveBeenCalled();
  });

  it.each([
    {
      caseName: "membro duplicado",
      members: activeMembers,
      details: [
        { memberId: ids.memberA, value: "5000" },
        { memberId: ids.memberA, value: "3000" },
      ],
    },
    {
      caseName: "membro de outro espaço",
      members: activeMembers,
      details: [
        { memberId: ids.memberA, value: "5000" },
        { memberId: ids.externalMember, value: "3000" },
      ],
    },
    {
      caseName: "membro inativo",
      members: [activeMembers[0]],
      details: [
        { memberId: ids.memberA, value: "5000" },
        { memberId: ids.memberB, value: "3000" },
      ],
    },
  ])("rejeita $caseName", async ({ members, details }) => {
    mocks.databaseClient.spaceMember.findMany.mockResolvedValue(members);

    const result = await createIncomeSettingsAction(
      { status: "idle" },
      incomeSettingsForm(details),
    );

    expect(result).toMatchObject({
      status: "error",
      fieldErrors: { incomeDetails: [expect.any(String)] },
    });
    expect(mocks.databaseClient.spaceMember.findMany).toHaveBeenCalledWith({
      where: { financialSpaceId: ids.space, revokedAt: null },
      select: { id: true },
      orderBy: { createdAt: "asc" },
    });
    expect(mocks.databaseClient.memberIncome.findFirst).not.toHaveBeenCalled();
    expect(mocks.databaseClient.memberIncome.createMany).not.toHaveBeenCalled();
  });

  it("rejeita uma vigência já cadastrada", async () => {
    mocks.databaseClient.spaceMember.findMany.mockResolvedValue(activeMembers);
    mocks.databaseClient.memberIncome.findFirst.mockResolvedValue({ id: ids.income });

    const result = await createIncomeSettingsAction(
      { status: "idle" },
      incomeSettingsForm([
        { memberId: ids.memberA, value: "5000" },
        { memberId: ids.memberB, value: "3000" },
      ]),
    );

    expect(result).toMatchObject({
      status: "error",
      fieldErrors: { effectiveFrom: [expect.any(String)] },
    });
    expect(mocks.databaseClient.memberIncome.createMany).not.toHaveBeenCalled();
  });

  it("persiste uma única operação createMany com o lote completo", async () => {
    mocks.databaseClient.spaceMember.findMany.mockResolvedValue(activeMembers);
    mocks.databaseClient.memberIncome.findFirst.mockResolvedValue(null);
    mocks.databaseClient.memberIncome.createMany.mockResolvedValue({ count: 2 });

    const result = await createIncomeSettingsAction(
      { status: "idle" },
      incomeSettingsForm([
        { memberId: ids.memberA, value: "5.000,00" },
        { memberId: ids.memberB, value: "3.000,00" },
      ]),
    );

    expect(result).toEqual({
      status: "success",
      message: "Nova vigência de renda registrada com sucesso.",
    });
    expect(mocks.databaseClient.memberIncome.createMany).toHaveBeenCalledOnce();
    expect(mocks.databaseClient.memberIncome.createMany).toHaveBeenCalledWith({
      data: [
        {
          financialSpaceId: ids.space,
          memberId: ids.memberA,
          amount: "5000.00",
          effectiveFrom: new Date("2026-10-01T00:00:00.000Z"),
          createdById: ids.user,
        },
        {
          financialSpaceId: ids.space,
          memberId: ids.memberB,
          amount: "3000.00",
          effectiveFrom: new Date("2026-10-01T00:00:00.000Z"),
          createdById: ids.user,
        },
      ],
    });
    expect(mocks.revalidatePath).toHaveBeenNthCalledWith(1, "/app/configuracoes");
    expect(mocks.revalidatePath).toHaveBeenNthCalledWith(2, "/app/movimentacoes/nova");
  });
});
