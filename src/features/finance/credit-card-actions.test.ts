import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const transactionClient = {
    account: {
      create: vi.fn(),
      findFirst: vi.fn(),
    },
    creditCard: { create: vi.fn() },
    creditCardInvoice: {
      findFirst: vi.fn(),
      upsert: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    financialTransaction: {
      count: vi.fn(),
      create: vi.fn(),
    },
    accountTransfer: { create: vi.fn() },
  };
  const databaseClient = {
    creditCard: { findFirst: vi.fn() },
    creditCardInvoice: { findFirst: vi.fn() },
    category: { findFirst: vi.fn() },
    spaceMember: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    memberIncome: { findMany: vi.fn() },
    $transaction: vi.fn(),
  };

  return {
    database: vi.fn(() => databaseClient),
    databaseClient,
    transactionClient,
    requireFinancialContext: vi.fn(),
    revalidatePath: vi.fn(),
  };
});

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/auth/session", () => ({
  requireFinancialContext: mocks.requireFinancialContext,
}));
vi.mock("@/lib/db/client", () => ({ database: mocks.database }));

import {
  closeCreditCardInvoiceAction,
  createCreditCardPurchaseAction,
  payCreditCardInvoiceAction,
} from "@/features/finance/credit-card-actions";

const ids = {
  space: "00000000-0000-4000-8000-000000000001",
  user: "00000000-0000-4000-8000-000000000002",
  member: "00000000-0000-4000-8000-000000000010",
  account: "00000000-0000-4000-8000-000000000020",
  cardAccount: "00000000-0000-4000-8000-000000000021",
  category: "00000000-0000-4000-8000-000000000030",
  card: "00000000-0000-4000-8000-000000000040",
  invoice: "00000000-0000-4000-8000-000000000050",
  transfer: "00000000-0000-4000-8000-000000000060",
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

function purchaseForm(overrides: Record<string, string> = {}) {
  return formData({
    cardId: ids.card,
    description: "Supermercado",
    amount: "1.234,56",
    categoryId: ids.category,
    purchaseDate: "2026-10-10",
    payerMemberId: "",
    splitMethod: "INDIVIDUAL",
    responsibleMemberId: ids.member,
    splitDetails: "[]",
    notes: "Compra do mês",
    ...overrides,
  });
}

function paymentForm(overrides: Record<string, string> = {}) {
  return formData({
    sourceAccountId: ids.account,
    paymentDate: "2026-10-12",
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
      for (const operation of Object.values(model)) {
        (operation as { mockReset(): void }).mockReset();
      }
    }
  }

  mocks.database.mockClear();
  mocks.requireFinancialContext.mockReset();
  mocks.revalidatePath.mockReset();
  mocks.requireFinancialContext.mockResolvedValue(financialContext);
  mocks.databaseClient.$transaction.mockImplementation(
    async (callback: (transaction: typeof mocks.transactionClient) => unknown) =>
      callback(mocks.transactionClient),
  );
}

function arrangeValidPurchase() {
  mocks.databaseClient.creditCard.findFirst.mockResolvedValue({
    id: ids.card,
    closingDay: 10,
    dueDay: 20,
    account: { id: ids.cardAccount, holderMemberId: ids.member },
  });
  mocks.databaseClient.category.findFirst.mockResolvedValue({ id: ids.category });
  mocks.databaseClient.spaceMember.findMany.mockResolvedValue([
    { id: ids.member, user: { name: "Ana" } },
  ]);
  mocks.transactionClient.creditCardInvoice.upsert.mockResolvedValue({
    id: ids.invoice,
    status: "OPEN",
    dueDate: new Date("2026-10-20T00:00:00.000Z"),
  });
  mocks.transactionClient.financialTransaction.create.mockResolvedValue({
    id: "00000000-0000-4000-8000-000000000070",
  });
}

function closedInvoice(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    id: ids.invoice,
    status: "CLOSED",
    closingDate: new Date("2026-10-10T00:00:00.000Z"),
    paymentTransfer: null,
    creditCard: {
      account: { id: ids.cardAccount, name: "Nubank", currency: "BRL" },
    },
    transactions: [{ amount: "100.00" }, { amount: "23.45" }],
    ...overrides,
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-12T15:00:00.000Z"));
  resetMocks();
});

describe("createCreditCardPurchaseAction", () => {
  beforeEach(arrangeValidPurchase);

  it("isola cartão, categoria e membros pelo espaço financeiro", async () => {
    await createCreditCardPurchaseAction({ status: "idle" }, purchaseForm());

    expect(mocks.databaseClient.creditCard.findFirst).toHaveBeenCalledWith({
      where: {
        id: ids.card,
        financialSpaceId: ids.space,
        deletedAt: null,
        account: { deletedAt: null },
      },
      select: {
        id: true,
        closingDay: true,
        dueDay: true,
        account: { select: { id: true, holderMemberId: true } },
      },
    });
    expect(mocks.databaseClient.category.findFirst).toHaveBeenCalledWith({
      where: {
        id: ids.category,
        financialSpaceId: ids.space,
        type: "EXPENSE",
        deletedAt: null,
      },
      select: { id: true },
    });
    expect(mocks.databaseClient.spaceMember.findMany).toHaveBeenCalledWith({
      where: { financialSpaceId: ids.space, revokedAt: null },
      select: { id: true, user: { select: { name: true } } },
      orderBy: { createdAt: "asc" },
    });
  });

  it("rejeita cartão de outro espaço antes de persistir a compra", async () => {
    mocks.databaseClient.creditCard.findFirst.mockResolvedValue(null);

    const result = await createCreditCardPurchaseAction(
      { status: "idle" },
      purchaseForm(),
    );

    expect(result).toEqual({
      status: "error",
      fieldErrors: { cardId: ["Cartão inválido para este espaço."] },
    });
    expect(mocks.databaseClient.$transaction).not.toHaveBeenCalled();
    expect(mocks.transactionClient.financialTransaction.create).not.toHaveBeenCalled();
  });

  it("cria a fatura do ciclo e uma única despesa paga vinculada ao cartão", async () => {
    const result = await createCreditCardPurchaseAction(
      { status: "idle" },
      purchaseForm(),
    );

    expect(result).toEqual({
      status: "success",
      message: "Compra registrada na fatura com vencimento em 2026-10-20.",
    });
    expect(mocks.transactionClient.creditCardInvoice.upsert).toHaveBeenCalledWith({
      where: {
        creditCardId_closingDate: {
          creditCardId: ids.card,
          closingDate: new Date("2026-10-10T00:00:00.000Z"),
        },
      },
      update: {},
      create: {
        financialSpaceId: ids.space,
        creditCardId: ids.card,
        closingDate: new Date("2026-10-10T00:00:00.000Z"),
        dueDate: new Date("2026-10-20T00:00:00.000Z"),
        status: "OPEN",
      },
      select: { id: true, status: true, dueDate: true },
    });
    expect(mocks.transactionClient.financialTransaction.create).toHaveBeenCalledOnce();
    expect(mocks.transactionClient.financialTransaction.create).toHaveBeenCalledWith({
      data: {
        financialSpaceId: ids.space,
        accountId: ids.cardAccount,
        categoryId: ids.category,
        payerMemberId: ids.member,
        creditCardInvoiceId: ids.invoice,
        createdById: ids.user,
        type: "EXPENSE",
        status: "PAID",
        splitMethod: "INDIVIDUAL",
        description: "Supermercado",
        amount: "1234.56",
        competenceDate: new Date("2026-10-10T00:00:00.000Z"),
        dueDate: new Date("2026-10-20T00:00:00.000Z"),
        paidAt: expect.any(Date),
        notes: "Compra do mês",
        splits: {
          create: [
            {
              memberId: ids.member,
              amount: "1234.56",
              percentage: null,
            },
          ],
        },
      },
    });
  });

  it("não adiciona compra a uma fatura que já foi fechada", async () => {
    mocks.transactionClient.creditCardInvoice.upsert.mockResolvedValue({
      id: ids.invoice,
      status: "CLOSED",
      dueDate: new Date("2026-10-20T00:00:00.000Z"),
    });

    const result = await createCreditCardPurchaseAction(
      { status: "idle" },
      purchaseForm(),
    );

    expect(result).toEqual({
      status: "error",
      message: "Esta fatura já foi fechada e não aceita novas compras.",
    });
    expect(mocks.transactionClient.financialTransaction.create).not.toHaveBeenCalled();
  });
});

describe("closeCreditCardInvoiceAction", () => {
  it("não encontra nem altera uma fatura pertencente a outro espaço", async () => {
    mocks.transactionClient.creditCardInvoice.findFirst.mockResolvedValue(null);

    const result = await closeCreditCardInvoiceAction(
      ids.invoice,
      { status: "idle" },
      new FormData(),
    );

    expect(result).toEqual({ status: "error", message: "Fatura não encontrada." });
    expect(mocks.transactionClient.creditCardInvoice.findFirst).toHaveBeenCalledWith({
      where: {
        id: ids.invoice,
        financialSpaceId: ids.space,
        creditCard: { deletedAt: null },
      },
      select: { id: true, status: true, closingDate: true },
    });
    expect(mocks.transactionClient.financialTransaction.count).not.toHaveBeenCalled();
    expect(mocks.transactionClient.creditCardInvoice.updateMany).not.toHaveBeenCalled();
  });

  it("impede fechamento antes da data configurada", async () => {
    mocks.transactionClient.creditCardInvoice.findFirst.mockResolvedValue({
      id: ids.invoice,
      status: "OPEN",
      closingDate: new Date("2026-10-13T00:00:00.000Z"),
    });

    const result = await closeCreditCardInvoiceAction(
      ids.invoice,
      { status: "idle" },
      new FormData(),
    );

    expect(result).toEqual({
      status: "error",
      message: "A fatura só pode ser fechada a partir do dia de fechamento.",
    });
    expect(mocks.transactionClient.financialTransaction.count).not.toHaveBeenCalled();
    expect(mocks.transactionClient.creditCardInvoice.updateMany).not.toHaveBeenCalled();
  });

  it("impede alteração de uma fatura já paga", async () => {
    mocks.transactionClient.creditCardInvoice.findFirst.mockResolvedValue({
      id: ids.invoice,
      status: "PAID",
      closingDate: new Date("2026-10-10T00:00:00.000Z"),
    });

    const result = await closeCreditCardInvoiceAction(
      ids.invoice,
      { status: "idle" },
      new FormData(),
    );

    expect(result).toEqual({
      status: "error",
      message: "Uma fatura paga não pode ser alterada.",
    });
    expect(mocks.transactionClient.creditCardInvoice.updateMany).not.toHaveBeenCalled();
  });

  it("fecha somente uma fatura aberta do espaço após confirmar suas compras", async () => {
    mocks.transactionClient.creditCardInvoice.findFirst.mockResolvedValue({
      id: ids.invoice,
      status: "OPEN",
      closingDate: new Date("2026-10-10T00:00:00.000Z"),
    });
    mocks.transactionClient.financialTransaction.count.mockResolvedValue(2);
    mocks.transactionClient.creditCardInvoice.updateMany.mockResolvedValue({ count: 1 });

    const result = await closeCreditCardInvoiceAction(
      ids.invoice,
      { status: "idle" },
      new FormData(),
    );

    expect(result).toEqual({
      status: "success",
      message: "Fatura fechada com sucesso.",
    });
    expect(mocks.transactionClient.financialTransaction.count).toHaveBeenCalledWith({
      where: {
        creditCardInvoiceId: ids.invoice,
        financialSpaceId: ids.space,
        deletedAt: null,
      },
    });
    expect(mocks.transactionClient.creditCardInvoice.updateMany).toHaveBeenCalledWith({
      where: {
        id: ids.invoice,
        financialSpaceId: ids.space,
        status: "OPEN",
      },
      data: { status: "CLOSED", closedAt: expect.any(Date) },
    });
  });
});

describe("payCreditCardInvoiceAction", () => {
  beforeEach(() => {
    mocks.transactionClient.creditCardInvoice.findFirst.mockResolvedValue(
      closedInvoice(),
    );
    mocks.transactionClient.account.findFirst.mockResolvedValue({
      id: ids.account,
      currency: "BRL",
    });
    mocks.transactionClient.accountTransfer.create.mockResolvedValue({
      id: ids.transfer,
    });
    mocks.transactionClient.creditCardInvoice.update.mockResolvedValue({
      id: ids.invoice,
    });
  });

  it("consulta fatura e conta-fonte sempre dentro do espaço financeiro", async () => {
    await payCreditCardInvoiceAction(
      ids.invoice,
      { status: "idle" },
      paymentForm(),
    );

    expect(mocks.transactionClient.creditCardInvoice.findFirst).toHaveBeenCalledWith({
      where: {
        id: ids.invoice,
        financialSpaceId: ids.space,
        creditCard: { deletedAt: null, account: { deletedAt: null } },
      },
      select: {
        id: true,
        status: true,
        closingDate: true,
        paymentTransfer: { select: { id: true } },
        creditCard: {
          select: {
            account: { select: { id: true, name: true, currency: true } },
          },
        },
        transactions: {
          where: { deletedAt: null },
          select: { amount: true },
        },
      },
    });
    expect(mocks.transactionClient.account.findFirst).toHaveBeenCalledWith({
      where: {
        id: ids.account,
        financialSpaceId: ids.space,
        type: { not: "CREDIT_CARD" },
        deletedAt: null,
      },
      select: { id: true, currency: true },
    });
  });

  it("rejeita conta inexistente, de outro espaço ou do tipo cartão", async () => {
    mocks.transactionClient.account.findFirst.mockResolvedValue(null);

    const result = await payCreditCardInvoiceAction(
      ids.invoice,
      { status: "idle" },
      paymentForm(),
    );

    expect(result).toEqual({
      status: "error",
      message: "Conta de pagamento inválida para este espaço.",
    });
    expect(mocks.transactionClient.accountTransfer.create).not.toHaveBeenCalled();
    expect(mocks.transactionClient.creditCardInvoice.update).not.toHaveBeenCalled();
  });

  it("paga o valor integral com transferência e não cria uma nova despesa", async () => {
    const result = await payCreditCardInvoiceAction(
      ids.invoice,
      { status: "idle" },
      paymentForm(),
    );

    expect(result).toEqual({
      status: "success",
      message: "Pagamento registrado como transferência, sem nova despesa.",
    });
    expect(mocks.transactionClient.accountTransfer.create).toHaveBeenCalledOnce();
    expect(mocks.transactionClient.accountTransfer.create).toHaveBeenCalledWith({
      data: {
        financialSpaceId: ids.space,
        sourceAccountId: ids.account,
        destinationAccountId: ids.cardAccount,
        creditCardInvoiceId: ids.invoice,
        createdById: ids.user,
        amount: "123.45",
        transferDate: new Date("2026-10-12T00:00:00.000Z"),
        description: "Pagamento da fatura · Nubank",
        notes: "Transferência vinculada ao pagamento da fatura do cartão.",
      },
    });
    expect(mocks.transactionClient.financialTransaction.create).not.toHaveBeenCalled();
    expect(mocks.transactionClient.creditCardInvoice.update).toHaveBeenCalledWith({
      where: { id: ids.invoice },
      data: { status: "PAID", paidAt: expect.any(Date) },
    });
    expect(
      mocks.transactionClient.accountTransfer.create.mock.invocationCallOrder[0],
    ).toBeLessThan(
      mocks.transactionClient.creditCardInvoice.update.mock.invocationCallOrder[0]!,
    );
  });

  it("exige que a fatura esteja fechada antes do pagamento", async () => {
    mocks.transactionClient.creditCardInvoice.findFirst.mockResolvedValue(
      closedInvoice({ status: "OPEN" }),
    );

    const result = await payCreditCardInvoiceAction(
      ids.invoice,
      { status: "idle" },
      paymentForm(),
    );

    expect(result).toEqual({
      status: "error",
      message: "Feche a fatura antes de registrar o pagamento.",
    });
    expect(mocks.transactionClient.account.findFirst).not.toHaveBeenCalled();
    expect(mocks.transactionClient.accountTransfer.create).not.toHaveBeenCalled();
  });

  it("é idempotente quando a fatura já possui a transferência de pagamento", async () => {
    mocks.transactionClient.creditCardInvoice.findFirst.mockResolvedValue(
      closedInvoice({
        status: "PAID",
        paymentTransfer: { id: ids.transfer },
      }),
    );

    const result = await payCreditCardInvoiceAction(
      ids.invoice,
      { status: "idle" },
      paymentForm(),
    );

    expect(result).toEqual({
      status: "success",
      message: "Esta fatura já estava paga.",
    });
    expect(mocks.transactionClient.account.findFirst).not.toHaveBeenCalled();
    expect(mocks.transactionClient.accountTransfer.create).not.toHaveBeenCalled();
    expect(mocks.transactionClient.creditCardInvoice.update).not.toHaveBeenCalled();
  });

  it("trata como sucesso a corrida em que outra requisição pagou primeiro", async () => {
    mocks.databaseClient.$transaction.mockRejectedValue({ code: "P2002" });
    mocks.databaseClient.creditCardInvoice.findFirst.mockResolvedValue({
      status: "PAID",
      paymentTransfer: { id: ids.transfer },
    });

    const result = await payCreditCardInvoiceAction(
      ids.invoice,
      { status: "idle" },
      paymentForm(),
    );

    expect(result).toEqual({
      status: "success",
      message: "Esta fatura já estava paga.",
    });
    expect(mocks.databaseClient.creditCardInvoice.findFirst).toHaveBeenCalledWith({
      where: { id: ids.invoice, financialSpaceId: ids.space },
      select: {
        status: true,
        paymentTransfer: { select: { id: true } },
      },
    });
    expect(mocks.revalidatePath).toHaveBeenCalled();
  });
});
