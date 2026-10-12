import "server-only";

import { calculateCreditCardLimit } from "@/features/finance/credit-cards";
import {
  monthRangeInTimezone,
  todayInTimezone,
} from "@/features/finance/dates";
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
      where: { ...baseWhere, type: { not: "CREDIT_CARD" } },
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
      where: {
        financialSpaceId,
        type: { not: "CREDIT_CARD" },
        deletedAt: null,
      },
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
  const [accounts, categories, members, incomeHistory] = await Promise.all([
    database().account.findMany({
      where: {
        financialSpaceId,
        type: { not: "CREDIT_CARD" },
        deletedAt: null,
      },
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
      where: { financialSpaceId },
      select: {
        id: true,
        createdAt: true,
        revokedAt: true,
        user: { select: { name: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
    database().memberIncome.findMany({
      where: { financialSpaceId },
      select: { memberId: true, amount: true, effectiveFrom: true },
      orderBy: [{ effectiveFrom: "desc" }, { createdAt: "desc" }],
    }),
  ]);

  return {
    accounts,
    categories,
    members: members.map((member) => ({
      id: member.id,
      name: member.user.name,
      joinedAt: member.createdAt.toISOString(),
      revokedAt: member.revokedAt?.toISOString() ?? null,
    })),
    incomeHistory: incomeHistory.map((income) => ({
      memberId: income.memberId,
      amount: income.amount.toString(),
      effectiveFrom: income.effectiveFrom.toISOString().slice(0, 10),
    })),
  };
}

export async function getMemberIncomeHistory(financialSpaceId: string) {
  const [members, history] = await Promise.all([
    database().spaceMember.findMany({
      where: { financialSpaceId, revokedAt: null },
      select: { id: true, user: { select: { name: true } } },
      orderBy: { createdAt: "asc" },
    }),
    database().memberIncome.findMany({
      where: { financialSpaceId },
      select: {
        id: true,
        memberId: true,
        amount: true,
        effectiveFrom: true,
        createdAt: true,
        creator: { select: { name: true } },
        member: { select: { user: { select: { name: true } } } },
      },
      orderBy: [{ effectiveFrom: "desc" }, { createdAt: "asc" }],
    }),
  ]);

  return {
    members: members.map((member) => ({ id: member.id, name: member.user.name })),
    history: history.map((income) => ({
      id: income.id,
      memberId: income.memberId,
      amount: income.amount.toString(),
      effectiveFrom: income.effectiveFrom.toISOString().slice(0, 10),
      createdAt: income.createdAt,
      createdBy: income.creator.name,
      memberName: income.member.user.name,
    })),
  };
}

export async function getRecurringRules(financialSpaceId: string) {
  const rules = await database().recurringRule.findMany({
    where: { financialSpaceId, deletedAt: null },
    select: {
      id: true,
      description: true,
      amount: true,
      type: true,
      status: true,
      state: true,
      splitMethod: true,
      startDate: true,
      endDate: true,
      nextOccurrence: true,
      account: { select: { name: true } },
      category: { select: { name: true } },
      payerMember: { select: { user: { select: { name: true } } } },
      splits: {
        select: {
          memberId: true,
          amount: true,
          percentage: true,
        },
        orderBy: { createdAt: "asc" },
      },
    },
    orderBy: [{ state: "asc" }, { nextOccurrence: "asc" }, { createdAt: "desc" }],
  });

  return rules.map((rule) => ({
    id: rule.id,
    description: rule.description,
    amount: rule.amount.toString(),
    type: rule.type,
    status: rule.state,
    transactionStatus: rule.status,
    splitMethod: rule.splitMethod,
    startDate: rule.startDate.toISOString().slice(0, 10),
    endDate: rule.endDate?.toISOString().slice(0, 10) ?? null,
    nextOccurrenceDate:
      rule.nextOccurrence?.toISOString().slice(0, 10) ?? null,
    account: rule.account,
    category: rule.category,
    payerMember: rule.payerMember,
    splits: rule.splits.map((split) => ({
      memberId: split.memberId,
      value:
        rule.splitMethod === "PERCENTAGE"
          ? (split.percentage?.toString() ?? "")
          : split.amount.toString(),
    })),
  }));
}

export async function getCreditCardDashboard(
  financialSpaceId: string,
  timeZone: string,
  currency: string,
) {
  const cards = await database().creditCard.findMany({
    where: {
      financialSpaceId,
      deletedAt: null,
      account: { deletedAt: null },
    },
    select: {
      id: true,
      bank: true,
      creditLimit: true,
      closingDay: true,
      dueDay: true,
      account: {
        select: {
          id: true,
          name: true,
          openingBalance: true,
          holderMember: {
            select: { id: true, user: { select: { name: true } } },
          },
        },
      },
      invoices: {
        select: {
          id: true,
          status: true,
          closingDate: true,
          dueDate: true,
          paidAt: true,
          transactions: {
            where: { deletedAt: null },
            select: {
              id: true,
              description: true,
              amount: true,
              competenceDate: true,
              category: { select: { name: true } },
              payerMember: {
                select: { user: { select: { name: true } } },
              },
            },
            orderBy: [{ competenceDate: "desc" }, { createdAt: "desc" }],
          },
        },
        orderBy: { closingDate: "desc" },
        take: 12,
      },
    },
    orderBy: { createdAt: "asc" },
  });

  const accountIds = cards.map((card) => card.account.id);
  const [transactionGroups, transfers, members, categories, paymentAccounts, incomeHistory] =
    await Promise.all([
      accountIds.length === 0
        ? Promise.resolve([])
        : database().financialTransaction.groupBy({
            by: ["accountId", "type"],
            where: {
              financialSpaceId,
              accountId: { in: accountIds },
              status: "PAID",
              deletedAt: null,
            },
            _sum: { amount: true },
          }),
      accountIds.length === 0
        ? Promise.resolve([])
        : database().accountTransfer.findMany({
            where: {
              financialSpaceId,
              deletedAt: null,
              OR: [
                { sourceAccountId: { in: accountIds } },
                { destinationAccountId: { in: accountIds } },
              ],
            },
            select: {
              sourceAccountId: true,
              destinationAccountId: true,
              amount: true,
            },
          }),
      database().spaceMember.findMany({
        where: { financialSpaceId },
        select: {
          id: true,
          createdAt: true,
          revokedAt: true,
          user: { select: { name: true } },
        },
        orderBy: { createdAt: "asc" },
      }),
      database().category.findMany({
        where: { financialSpaceId, type: "EXPENSE", deletedAt: null },
        select: { id: true, name: true, type: true },
        orderBy: { name: "asc" },
      }),
      database().account.findMany({
        where: {
          financialSpaceId,
          type: { not: "CREDIT_CARD" },
          deletedAt: null,
        },
        select: {
          id: true,
          name: true,
          type: true,
          ownership: true,
          holderMember: { select: { user: { select: { name: true } } } },
        },
        orderBy: { name: "asc" },
      }),
      database().memberIncome.findMany({
        where: { financialSpaceId },
        select: { memberId: true, amount: true, effectiveFrom: true },
        orderBy: [{ effectiveFrom: "desc" }, { createdAt: "desc" }],
      }),
    ]);

  return {
    cards: cards.map((card) => {
      const groups = transactionGroups.filter(
        (group) => group.accountId === card.account.id,
      );
      const incomingTransferCents = transfers
        .filter((transfer) => transfer.destinationAccountId === card.account.id)
        .reduce(
          (total, transfer) => total + decimalToCents(transfer.amount),
          0n,
        );
      const outgoingTransferCents = transfers
        .filter((transfer) => transfer.sourceAccountId === card.account.id)
        .reduce(
          (total, transfer) => total + decimalToCents(transfer.amount),
          0n,
        );
      const balanceCents = calculateAccountBalanceCents({
        openingCents: decimalToCents(card.account.openingBalance),
        incomeCents: groupedTotal(groups, "INCOME"),
        expenseCents: groupedTotal(groups, "EXPENSE"),
        incomingTransferCents,
        outgoingTransferCents,
      });
      const limit = calculateCreditCardLimit({
        limitCents: decimalToCents(card.creditLimit),
        accountBalanceCents: balanceCents,
      });

      return {
        id: card.id,
        accountId: card.account.id,
        name: card.account.name,
        bank: card.bank,
        creditLimit: card.creditLimit.toString(),
        closingDay: card.closingDay,
        dueDay: card.dueDay,
        holder: {
          id: card.account.holderMember!.id,
          name: card.account.holderMember!.user.name,
        },
        balanceCents,
        ...limit,
        invoices: card.invoices.map((invoice) => ({
          id: invoice.id,
          status: invoice.status,
          closingDate: invoice.closingDate.toISOString().slice(0, 10),
          dueDate: invoice.dueDate.toISOString().slice(0, 10),
          totalCents: invoice.transactions.reduce(
            (total, transaction) => total + decimalToCents(transaction.amount),
            0n,
          ),
          purchaseCount: invoice.transactions.length,
          purchases: invoice.transactions.map((purchase) => ({
            id: purchase.id,
            description: purchase.description,
            amountCents: decimalToCents(purchase.amount),
            purchaseDate: purchase.competenceDate.toISOString().slice(0, 10),
            categoryName: purchase.category.name,
            payerName: purchase.payerMember?.user.name ?? null,
          })),
          paidAt: invoice.paidAt,
        })),
      };
    }),
    members: members.map((member) => ({
      id: member.id,
      name: member.user.name,
      joinedAt: member.createdAt.toISOString(),
      revokedAt: member.revokedAt?.toISOString() ?? null,
    })),
    categories,
    paymentAccounts,
    incomeHistory: incomeHistory.map((income) => ({
      memberId: income.memberId,
      amount: income.amount.toString(),
      effectiveFrom: income.effectiveFrom.toISOString().slice(0, 10),
    })),
    today: todayInTimezone(timeZone),
    currency,
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
