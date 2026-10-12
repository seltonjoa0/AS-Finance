"use server";

import { revalidatePath } from "next/cache";

import {
  creditCardInvoiceIdSchema,
  creditCardPaymentSchemaForDate,
  creditCardPurchaseSchemaForDate,
  creditCardSchema,
} from "@/features/finance/credit-card-schema";
import { resolveCreditCardInvoiceCycle } from "@/features/finance/credit-cards";
import {
  civilDate,
  civilDateInterval,
  todayInTimezone,
} from "@/features/finance/dates";
import { resolveIncomeDetails } from "@/features/finance/incomes";
import {
  centsToDecimal,
  decimalToCents,
  parseMoneyToCents,
} from "@/features/finance/money";
import {
  buildTransactionSplits,
  parseSplitDetails,
} from "@/features/finance/splits";
import { requireFinancialContext } from "@/lib/auth/session";
import { database } from "@/lib/db/client";
import { fieldErrors, type FormState } from "@/lib/validation/form-state";

class CreditCardActionError extends Error {}

function revalidateCreditCardFinance() {
  revalidatePath("/app", "layout");
  revalidatePath("/app/cartoes");
  revalidatePath("/app/contas");
  revalidatePath("/app/movimentacoes");
}

export async function createCreditCardAction(
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  void _previousState;
  const context = await requireFinancialContext();
  const result = creditCardSchema.safeParse(Object.fromEntries(formData));
  if (!result.success) {
    return { status: "error", fieldErrors: fieldErrors(result.error) };
  }

  const data = result.data;
  const holder = await database().spaceMember.findFirst({
    where: {
      id: data.holderMemberId,
      financialSpaceId: context.space.id,
      revokedAt: null,
    },
    select: { id: true },
  });
  if (!holder) {
    return {
      status: "error",
      fieldErrors: { holderMemberId: ["Titular inválido para este espaço."] },
    };
  }

  const limitCents = parseMoneyToCents(data.creditLimit)!;

  try {
    await database().$transaction(async (transaction) => {
      const account = await transaction.account.create({
        data: {
          financialSpaceId: context.space.id,
          name: data.name,
          type: "CREDIT_CARD",
          ownership: "INDIVIDUAL",
          holderMemberId: holder.id,
          openingBalance: "0.00",
          currency: context.space.currency,
          createdById: context.user.id,
        },
        select: { id: true },
      });

      await transaction.creditCard.create({
        data: {
          financialSpaceId: context.space.id,
          accountId: account.id,
          bank: data.bank,
          creditLimit: centsToDecimal(limitCents),
          closingDay: data.closingDay,
          dueDay: data.dueDay,
          createdById: context.user.id,
        },
      });
    });
  } catch {
    return {
      status: "error",
      message: "Não foi possível cadastrar o cartão. Tente novamente.",
    };
  }

  revalidateCreditCardFinance();
  return { status: "success", message: "Cartão cadastrado com sucesso." };
}

export async function createCreditCardPurchaseAction(
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  void _previousState;
  const context = await requireFinancialContext();
  const today = todayInTimezone(context.space.timezone);
  const result = creditCardPurchaseSchemaForDate(today).safeParse(
    Object.fromEntries(formData),
  );
  if (!result.success) {
    return { status: "error", fieldErrors: fieldErrors(result.error) };
  }

  const data = result.data;
  const purchaseInterval = civilDateInterval(data.purchaseDate);
  const [card, category, eligibleMembers] = await Promise.all([
    database().creditCard.findFirst({
      where: {
        id: data.cardId,
        financialSpaceId: context.space.id,
        deletedAt: null,
        account: { deletedAt: null },
      },
      select: {
        id: true,
        closingDay: true,
        dueDay: true,
        account: {
          select: { id: true, holderMemberId: true },
        },
      },
    }),
    database().category.findFirst({
      where: {
        id: data.categoryId,
        financialSpaceId: context.space.id,
        type: "EXPENSE",
        deletedAt: null,
      },
      select: { id: true },
    }),
    database().spaceMember.findMany({
      where:
        data.splitMethod === "INCOME_BASED"
          ? {
              financialSpaceId: context.space.id,
              createdAt: { lt: purchaseInterval.endExclusive },
              OR: [
                { revokedAt: null },
                { revokedAt: { gt: purchaseInterval.start } },
              ],
            }
          : { financialSpaceId: context.space.id, revokedAt: null },
      select: { id: true, user: { select: { name: true } } },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  if (!card) {
    return {
      status: "error",
      fieldErrors: { cardId: ["Cartão inválido para este espaço."] },
    };
  }
  if (!category) {
    return {
      status: "error",
      fieldErrors: { categoryId: ["Categoria de despesa inválida."] },
    };
  }

  const eligibleMemberIds = eligibleMembers.map((member) => member.id);
  const payerMemberId =
    data.payerMemberId ?? card.account.holderMemberId ?? undefined;
  if (!payerMemberId || !eligibleMemberIds.includes(payerMemberId)) {
    return {
      status: "error",
      fieldErrors: {
        payerMemberId: [
          "Selecione um pagador que participe deste espaço na data da compra.",
        ],
      },
    };
  }

  const splitDetails = parseSplitDetails(data.splitDetails);
  if (!splitDetails) {
    return {
      status: "error",
      fieldErrors: {
        splitDetails: ["A divisão enviada não está em um formato válido."],
      },
    };
  }

  let authoritativeDetails = splitDetails;
  if (data.splitMethod === "INCOME_BASED") {
    const incomeHistory = await database().memberIncome.findMany({
      where: {
        financialSpaceId: context.space.id,
        memberId: { in: eligibleMemberIds },
        effectiveFrom: { lte: purchaseInterval.start },
      },
      select: { memberId: true, amount: true, effectiveFrom: true },
      orderBy: [{ effectiveFrom: "desc" }, { createdAt: "desc" }],
    });
    const resolved = resolveIncomeDetails({
      memberIds: eligibleMemberIds,
      history: incomeHistory.map((income) => ({
        memberId: income.memberId,
        amount: income.amount.toString(),
        effectiveFrom: income.effectiveFrom.toISOString().slice(0, 10),
      })),
      competenceDate: data.purchaseDate,
    });
    if (resolved.missingMemberIds.length > 0) {
      const missingNames = eligibleMembers
        .filter((member) => resolved.missingMemberIds.includes(member.id))
        .map((member) => member.user.name)
        .join(", ");
      return {
        status: "error",
        fieldErrors: {
          splitDetails: [`Cadastre uma renda vigente para: ${missingNames}.`],
        },
      };
    }
    authoritativeDetails = resolved.details;
  }

  const amountCents = parseMoneyToCents(data.amount)!;
  const splitResult = buildTransactionSplits({
    method: data.splitMethod,
    totalCents: amountCents,
    memberIds: eligibleMemberIds,
    responsibleMemberId: data.responsibleMemberId,
    details: authoritativeDetails,
  });
  if (!splitResult.success) {
    const field =
      data.splitMethod === "INDIVIDUAL"
        ? "responsibleMemberId"
        : "splitDetails";
    return { status: "error", fieldErrors: { [field]: [splitResult.message] } };
  }

  const cycle = resolveCreditCardInvoiceCycle({
    purchaseDate: data.purchaseDate,
    closingDay: card.closingDay,
    dueDay: card.dueDay,
  });

  try {
    await database().$transaction(async (transaction) => {
      const invoice = await transaction.creditCardInvoice.upsert({
        where: {
          creditCardId_closingDate: {
            creditCardId: card.id,
            closingDate: civilDate(cycle.closingDate),
          },
        },
        update: {},
        create: {
          financialSpaceId: context.space.id,
          creditCardId: card.id,
          closingDate: civilDate(cycle.closingDate),
          dueDate: civilDate(cycle.dueDate),
          status: "OPEN",
        },
        select: { id: true, status: true, dueDate: true },
      });
      if (invoice.status !== "OPEN") {
        throw new CreditCardActionError(
          "Esta fatura já foi fechada e não aceita novas compras.",
        );
      }

      await transaction.financialTransaction.create({
        data: {
          financialSpaceId: context.space.id,
          accountId: card.account.id,
          categoryId: category.id,
          payerMemberId,
          creditCardInvoiceId: invoice.id,
          createdById: context.user.id,
          type: "EXPENSE",
          status: "PAID",
          splitMethod: data.splitMethod,
          description: data.description,
          amount: centsToDecimal(amountCents),
          competenceDate: purchaseInterval.start,
          dueDate: invoice.dueDate,
          paidAt: new Date(),
          notes: data.notes || null,
          splits: {
            create: splitResult.splits.map((split) => ({
              memberId: split.memberId,
              amount: centsToDecimal(split.cents),
              percentage: split.percentage ?? null,
            })),
          },
        },
      });
    });
  } catch (error) {
    return {
      status: "error",
      message:
        error instanceof CreditCardActionError
          ? error.message
          : "Não foi possível registrar a compra no cartão.",
    };
  }

  revalidateCreditCardFinance();
  return {
    status: "success",
    message: `Compra registrada na fatura com vencimento em ${cycle.dueDate}.`,
  };
}

export async function closeCreditCardInvoiceAction(
  invoiceId: string,
  _previousState: FormState,
  _formData: FormData,
): Promise<FormState> {
  void _previousState;
  void _formData;
  const context = await requireFinancialContext();
  const idResult = creditCardInvoiceIdSchema.safeParse(invoiceId);
  if (!idResult.success) {
    return { status: "error", message: "Fatura de cartão inválida." };
  }

  const today = todayInTimezone(context.space.timezone);
  try {
    await database().$transaction(async (transaction) => {
      const invoice = await transaction.creditCardInvoice.findFirst({
        where: {
          id: idResult.data,
          financialSpaceId: context.space.id,
          creditCard: { deletedAt: null },
        },
        select: { id: true, status: true, closingDate: true },
      });
      if (!invoice) {
        throw new CreditCardActionError("Fatura não encontrada.");
      }
      if (invoice.status === "PAID") {
        throw new CreditCardActionError("Uma fatura paga não pode ser alterada.");
      }
      if (invoice.status === "CLOSED") return;
      if (invoice.closingDate > civilDate(today)) {
        throw new CreditCardActionError(
          "A fatura só pode ser fechada a partir do dia de fechamento.",
        );
      }

      const purchaseCount = await transaction.financialTransaction.count({
        where: {
          creditCardInvoiceId: invoice.id,
          financialSpaceId: context.space.id,
          deletedAt: null,
        },
      });
      if (purchaseCount === 0) {
        throw new CreditCardActionError("Não há compras nesta fatura.");
      }

      const updated = await transaction.creditCardInvoice.updateMany({
        where: {
          id: invoice.id,
          financialSpaceId: context.space.id,
          status: "OPEN",
        },
        data: { status: "CLOSED", closedAt: new Date() },
      });
      if (updated.count !== 1) {
        throw new CreditCardActionError("A fatura já foi alterada.");
      }
    });
  } catch (error) {
    return {
      status: "error",
      message:
        error instanceof CreditCardActionError
          ? error.message
          : "Não foi possível fechar a fatura.",
    };
  }

  revalidateCreditCardFinance();
  return { status: "success", message: "Fatura fechada com sucesso." };
}

export async function payCreditCardInvoiceAction(
  invoiceId: string,
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  void _previousState;
  const context = await requireFinancialContext();
  const idResult = creditCardInvoiceIdSchema.safeParse(invoiceId);
  if (!idResult.success) {
    return { status: "error", message: "Fatura de cartão inválida." };
  }

  const today = todayInTimezone(context.space.timezone);
  const result = creditCardPaymentSchemaForDate(today).safeParse(
    Object.fromEntries(formData),
  );
  if (!result.success) {
    return { status: "error", fieldErrors: fieldErrors(result.error) };
  }

  try {
    const outcome = await database().$transaction(async (transaction) => {
      const invoice = await transaction.creditCardInvoice.findFirst({
        where: {
          id: idResult.data,
          financialSpaceId: context.space.id,
          creditCard: { deletedAt: null, account: { deletedAt: null } },
        },
        select: {
          id: true,
          status: true,
          closingDate: true,
          paymentTransfer: { select: { id: true } },
          creditCard: {
            select: {
              account: {
                select: { id: true, name: true, currency: true },
              },
            },
          },
          transactions: {
            where: { deletedAt: null },
            select: { amount: true },
          },
        },
      });
      if (!invoice) {
        throw new CreditCardActionError("Fatura não encontrada.");
      }
      if (invoice.status === "PAID" && invoice.paymentTransfer) {
        return "ALREADY_PAID" as const;
      }
      if (invoice.status !== "CLOSED") {
        throw new CreditCardActionError(
          "Feche a fatura antes de registrar o pagamento.",
        );
      }

      const paymentDate = civilDate(result.data.paymentDate);
      if (paymentDate < invoice.closingDate) {
        throw new CreditCardActionError(
          "O pagamento não pode ser anterior ao fechamento da fatura.",
        );
      }

      const sourceAccount = await transaction.account.findFirst({
        where: {
          id: result.data.sourceAccountId,
          financialSpaceId: context.space.id,
          type: { not: "CREDIT_CARD" },
          deletedAt: null,
        },
        select: { id: true, currency: true },
      });
      if (!sourceAccount) {
        throw new CreditCardActionError(
          "Conta de pagamento inválida para este espaço.",
        );
      }
      if (sourceAccount.currency !== invoice.creditCard.account.currency) {
        throw new CreditCardActionError(
          "A conta e o cartão precisam utilizar a mesma moeda.",
        );
      }

      const totalCents = invoice.transactions.reduce(
        (total, transaction) => total + decimalToCents(transaction.amount),
        0n,
      );
      if (totalCents <= 0n) {
        throw new CreditCardActionError("A fatura não possui valor para pagamento.");
      }

      await transaction.accountTransfer.create({
        data: {
          financialSpaceId: context.space.id,
          sourceAccountId: sourceAccount.id,
          destinationAccountId: invoice.creditCard.account.id,
          creditCardInvoiceId: invoice.id,
          createdById: context.user.id,
          amount: centsToDecimal(totalCents),
          transferDate: paymentDate,
          description: `Pagamento da fatura · ${invoice.creditCard.account.name}`,
          notes: "Transferência vinculada ao pagamento da fatura do cartão.",
        },
      });
      await transaction.creditCardInvoice.update({
        where: { id: invoice.id },
        data: { status: "PAID", paidAt: new Date() },
      });
      return "PAID" as const;
    });

    revalidateCreditCardFinance();
    return {
      status: "success",
      message:
        outcome === "ALREADY_PAID"
          ? "Esta fatura já estava paga."
          : "Pagamento registrado como transferência, sem nova despesa.",
    };
  } catch (error) {
    // The database serializes the invoice/payment relationship. Depending on
    // which guard observes a concurrent payment first, the losing request can
    // receive either a unique-key or trigger error. Re-read the tenant-scoped
    // final state before reporting a technical failure.
    if (!(error instanceof CreditCardActionError)) {
      const alreadyPaid = await database().creditCardInvoice
        .findFirst({
          where: {
            id: idResult.data,
            financialSpaceId: context.space.id,
          },
          select: {
            status: true,
            paymentTransfer: { select: { id: true } },
          },
        })
        .catch(() => null);

      if (alreadyPaid?.status === "PAID" && alreadyPaid.paymentTransfer) {
        revalidateCreditCardFinance();
        return { status: "success", message: "Esta fatura já estava paga." };
      }
    }

    return {
      status: "error",
      message:
        error instanceof CreditCardActionError
          ? error.message
          : "Não foi possível pagar a fatura.",
    };
  }
}
