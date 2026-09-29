import "server-only";

import { monthRangeInTimezone } from "@/features/finance/dates";
import {
  calculateAccountBalanceCents,
  decimalToCents,
} from "@/features/finance/money";
import { database } from "@/lib/db/client";

function groupedTotal(
  groups: Array<{ type: "INCOME" | "EXPENSE"; _sum: { amount: { toString(): string } | null } }>,
  type: "INCOME" | "EXPENSE",
) {
  const value = groups.find((group) => group.type === type)?._sum.amount;
  return value ? decimalToCents(value) : 0n;
}

export async function getFinanceOverview(financialSpaceId: string, timeZone: string) {
  const { start, end } = monthRangeInTimezone(timeZone);
  const baseWhere = { financialSpaceId, deletedAt: null } as const;

  const [
    accounts,
    lifetimeGroups,
    monthGroups,
    pending,
    recentTransactions,
    recentTransfers,
  ] = await Promise.all([
    database().account.findMany({
      where: baseWhere,
      select: { openingBalance: true },
    }),
    database().financialTransaction.groupBy({
      by: ["type"],
      where: { ...baseWhere, status: "PAID" },
      _sum: { amount: true },
    }),
    database().financialTransaction.groupBy({
      by: ["type"],
      where: {
        ...baseWhere,
        status: "PAID",
        competenceDate: { gte: start, lt: end },
      },
      _sum: { amount: true },
    }),
    database().financialTransaction.aggregate({
      where: { ...baseWhere, type: "EXPENSE", status: "PENDING" },
      _sum: { amount: true },
    }),
    database().financialTransaction.findMany({
      where: baseWhere,
      select: {
        id: true,
        description: true,
        amount: true,
        type: true,
        status: true,
        competenceDate: true,
        createdAt: true,
        category: { select: { name: true } },
        account: { select: { name: true } },
      },
      orderBy: [{ competenceDate: "desc" }, { createdAt: "desc" }],
      take: 5,
    }),
    database().accountTransfer.findMany({
      where: baseWhere,
      select: {
        id: true,
        description: true,
        amount: true,
        transferDate: true,
        createdAt: true,
        sourceAccount: {
          select: {
            name: true,
            type: true,
            ownership: true,
            holderMember: { select: { user: { select: { name: true } } } },
          },
        },
        destinationAccount: {
          select: {
            name: true,
            type: true,
            ownership: true,
            holderMember: { select: { user: { select: { name: true } } } },
          },
        },
      },
      orderBy: [{ transferDate: "desc" }, { createdAt: "desc" }],
      take: 5,
    }),
  ]);

  const opening = accounts.reduce(
    (sum, account) => sum + decimalToCents(account.openingBalance),
    0n,
  );
  const lifetimeIncome = groupedTotal(lifetimeGroups, "INCOME");
  const lifetimeExpense = groupedTotal(lifetimeGroups, "EXPENSE");
  const recent = [
    ...recentTransactions.map((transaction) => ({
      ...transaction,
      kind: "transaction" as const,
      occurredOn: transaction.competenceDate,
    })),
    ...recentTransfers.map((transfer) => ({
      ...transfer,
      kind: "transfer" as const,
      occurredOn: transfer.transferDate,
    })),
  ]
    .sort(
      (left, right) =>
        right.occurredOn.getTime() - left.occurredOn.getTime() ||
        right.createdAt.getTime() - left.createdAt.getTime(),
    )
    .slice(0, 5);

  return {
    accountCount: accounts.length,
    balanceCents: opening + lifetimeIncome - lifetimeExpense,
    incomeCents: groupedTotal(monthGroups, "INCOME"),
    expenseCents: groupedTotal(monthGroups, "EXPENSE"),
    pendingCents: pending._sum.amount ? decimalToCents(pending._sum.amount) : 0n,
    recent,
  };
}

export async function getAccountsWithBalances(financialSpaceId: string) {
  const [accounts, groups, transferBalances] = await Promise.all([
    database().account.findMany({
      where: { financialSpaceId, deletedAt: null },
      include: {
        holderMember: { include: { user: { select: { name: true } } } },
      },
      orderBy: { createdAt: "asc" },
    }),
    database().financialTransaction.groupBy({
      by: ["accountId", "type"],
      where: { financialSpaceId, deletedAt: null, status: "PAID" },
      _sum: { amount: true },
    }),
    database().$queryRaw<
      Array<{ accountId: string; amount: { toString(): string } }>
    >`
      SELECT transfer_delta.account_id AS "accountId", SUM(transfer_delta.amount) AS "amount"
      FROM (
        SELECT source_account_id AS account_id, -amount AS amount
        FROM account_transfers
        WHERE financial_space_id = ${financialSpaceId}::uuid AND deleted_at IS NULL
        UNION ALL
        SELECT destination_account_id AS account_id, amount
        FROM account_transfers
        WHERE financial_space_id = ${financialSpaceId}::uuid AND deleted_at IS NULL
      ) AS transfer_delta
      GROUP BY transfer_delta.account_id
    `,
  ]);

  return accounts.map((account) => {
    const forAccount = groups.filter((group) => group.accountId === account.id);
    const income = groupedTotal(forAccount, "INCOME");
    const expense = groupedTotal(forAccount, "EXPENSE");
    const transferBalance = transferBalances.find(
      (balance) => balance.accountId === account.id,
    )?.amount;
    return {
      ...account,
      balanceCents: calculateAccountBalanceCents({
        openingCents: decimalToCents(account.openingBalance),
        incomeCents: income,
        expenseCents: expense,
        netTransferCents: transferBalance ? decimalToCents(transferBalance) : 0n,
      }),
    };
  });
}

export async function getFinanceCatalog(financialSpaceId: string) {
  const [accounts, categories, members] = await Promise.all([
    database().account.findMany({
      where: { financialSpaceId, deletedAt: null },
      select: {
        id: true,
        name: true,
        type: true,
        ownership: true,
        holderMember: { select: { user: { select: { name: true } } } },
      },
      orderBy: { name: "asc" },
    }),
    database().category.findMany({
      where: { financialSpaceId, deletedAt: null },
      select: { id: true, name: true, type: true },
      orderBy: { name: "asc" },
    }),
    database().spaceMember.findMany({
      where: { financialSpaceId, revokedAt: null },
      select: { id: true, user: { select: { name: true } } },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  return {
    accounts,
    categories,
    members: members.map((member) => ({ id: member.id, name: member.user.name })),
  };
}

export async function getTransactions(
  financialSpaceId: string,
  filters: { type?: "INCOME" | "EXPENSE"; status?: "PENDING" | "PAID" },
) {
  return database().financialTransaction.findMany({
    where: {
      financialSpaceId,
      deletedAt: null,
      ...(filters.type ? { type: filters.type } : {}),
      ...(filters.status ? { status: filters.status } : {}),
    },
    include: {
      account: { select: { name: true } },
      category: { select: { name: true } },
      payerMember: { include: { user: { select: { name: true } } } },
      splits: {
        include: { member: { include: { user: { select: { name: true } } } } },
        orderBy: { createdAt: "asc" },
      },
    },
    orderBy: [{ competenceDate: "desc" }, { createdAt: "desc" }],
    take: 100,
  });
}

export async function getTransfers(financialSpaceId: string) {
  return database().accountTransfer.findMany({
    where: { financialSpaceId, deletedAt: null },
    include: {
      sourceAccount: {
        select: {
          name: true,
          type: true,
          ownership: true,
          holderMember: { select: { user: { select: { name: true } } } },
        },
      },
      destinationAccount: {
        select: {
          name: true,
          type: true,
          ownership: true,
          holderMember: { select: { user: { select: { name: true } } } },
        },
      },
    },
    orderBy: [{ transferDate: "desc" }, { createdAt: "desc" }],
    take: 100,
  });
}
