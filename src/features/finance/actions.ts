"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { civilDate, todayInTimezone } from "@/features/finance/dates";
import { centsToDecimal, parseMoneyToCents } from "@/features/finance/money";
import {
  accountSchema,
  categorySchema,
  transferSchemaForDate,
  transactionSchema,
} from "@/features/finance/schemas";
import {
  buildTransactionSplits,
  parseSplitDetails,
} from "@/features/finance/splits";
import { requireFinancialContext } from "@/lib/auth/session";
import { database } from "@/lib/db/client";
import { fieldErrors, type FormState } from "@/lib/validation/form-state";

export async function createAccountAction(
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  const context = await requireFinancialContext();
  const result = accountSchema.safeParse(Object.fromEntries(formData));

  if (!result.success) {
    return { status: "error", fieldErrors: fieldErrors(result.error) };
  }

  const { name, type, ownership, holderMemberId, openingBalance } = result.data;
  const holder = holderMemberId
    ? await database().spaceMember.findFirst({
        where: {
          id: holderMemberId,
          financialSpaceId: context.space.id,
          revokedAt: null,
        },
        select: { id: true },
      })
    : null;

  if (ownership === "INDIVIDUAL" && !holder) {
    return {
      status: "error",
      fieldErrors: { holderMemberId: ["Titular inválido para este espaço."] },
    };
  }

  const openingBalanceCents = parseMoneyToCents(openingBalance, true)!;

  try {
    await database().account.create({
      data: {
        financialSpaceId: context.space.id,
        name,
        type,
        ownership,
        holderMemberId: ownership === "INDIVIDUAL" ? holder!.id : null,
        openingBalance: centsToDecimal(openingBalanceCents),
        currency: context.space.currency,
        createdById: context.user.id,
      },
    });
  } catch {
    return { status: "error", message: "Não foi possível criar a conta. Tente novamente." };
  }

  revalidatePath("/app", "layout");
  return { status: "success", message: "Conta criada com sucesso." };
}

export async function createCategoryAction(
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  const context = await requireFinancialContext();
  const result = categorySchema.safeParse(Object.fromEntries(formData));

  if (!result.success) {
    return { status: "error", fieldErrors: fieldErrors(result.error) };
  }

  const duplicate = await database().category.findFirst({
    where: {
      financialSpaceId: context.space.id,
      type: result.data.type,
      name: { equals: result.data.name, mode: "insensitive" },
    },
    select: { id: true, deletedAt: true },
  });

  if (duplicate) {
    return {
      status: "error",
      fieldErrors: { name: ["Já existe uma categoria com esse nome e tipo."] },
    };
  }

  try {
    await database().category.create({
      data: {
        financialSpaceId: context.space.id,
        name: result.data.name,
        type: result.data.type,
        createdById: context.user.id,
      },
    });
  } catch {
    return { status: "error", message: "Não foi possível criar a categoria." };
  }

  revalidatePath("/app/categorias");
  revalidatePath("/app/movimentacoes/nova");
  return { status: "success", message: "Categoria criada com sucesso." };
}

export async function createTransferAction(
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  const context = await requireFinancialContext();
  const result = transferSchemaForDate(
    todayInTimezone(context.space.timezone),
  ).safeParse(Object.fromEntries(formData));

  if (!result.success) {
    return { status: "error", fieldErrors: fieldErrors(result.error) };
  }

  const data = result.data;
  const accounts = await database().account.findMany({
    where: {
      id: { in: [data.sourceAccountId, data.destinationAccountId] },
      financialSpaceId: context.space.id,
      deletedAt: null,
    },
    select: { id: true, currency: true },
  });
  const accountById = new Map(accounts.map((account) => [account.id, account]));
  const sourceAccount = accountById.get(data.sourceAccountId);
  const destinationAccount = accountById.get(data.destinationAccountId);

  if (!sourceAccount) {
    return {
      status: "error",
      fieldErrors: { sourceAccountId: ["Conta de origem inválida para este espaço."] },
    };
  }
  if (!destinationAccount) {
    return {
      status: "error",
      fieldErrors: { destinationAccountId: ["Conta de destino inválida para este espaço."] },
    };
  }
  if (sourceAccount.currency !== destinationAccount.currency) {
    return {
      status: "error",
      fieldErrors: {
        destinationAccountId: ["As contas precisam utilizar a mesma moeda."],
      },
    };
  }

  const amountCents = parseMoneyToCents(data.amount)!;

  try {
    await database().accountTransfer.create({
      data: {
        financialSpaceId: context.space.id,
        sourceAccountId: sourceAccount.id,
        destinationAccountId: destinationAccount.id,
        createdById: context.user.id,
        amount: centsToDecimal(amountCents),
        transferDate: civilDate(data.transferDate),
        description: data.description || null,
        notes: data.notes || null,
      },
    });
  } catch {
    return { status: "error", message: "Não foi possível registrar a transferência." };
  }

  revalidatePath("/app", "layout");
  redirect("/app/movimentacoes?transferida=1");
}

export async function createTransactionAction(
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  const context = await requireFinancialContext();
  const result = transactionSchema.safeParse(Object.fromEntries(formData));

  if (!result.success) {
    return { status: "error", fieldErrors: fieldErrors(result.error) };
  }

  const data = result.data;
  const [account, category, activeMembers] = await Promise.all([
    database().account.findFirst({
      where: { id: data.accountId, financialSpaceId: context.space.id, deletedAt: null },
      select: { id: true },
    }),
    database().category.findFirst({
      where: { id: data.categoryId, financialSpaceId: context.space.id, deletedAt: null },
      select: { id: true, type: true },
    }),
    database().spaceMember.findMany({
      where: { financialSpaceId: context.space.id, revokedAt: null },
      select: { id: true },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  if (!account) {
    return { status: "error", fieldErrors: { accountId: ["Conta inválida para este espaço."] } };
  }
  if (!category || category.type !== data.type) {
    return {
      status: "error",
      fieldErrors: { categoryId: ["Categoria incompatível com a movimentação."] },
    };
  }

  const activeMemberIds = new Set(activeMembers.map((member) => member.id));
  if (data.payerMemberId && !activeMemberIds.has(data.payerMemberId)) {
    return { status: "error", fieldErrors: { payerMemberId: ["Pagador inválido."] } };
  }
  const amountCents = parseMoneyToCents(data.amount)!;
  const splitDetails = parseSplitDetails(data.splitDetails);
  if (!splitDetails) {
    return {
      status: "error",
      fieldErrors: { splitDetails: ["A divisão enviada não está em um formato válido."] },
    };
  }

  const splitResult = buildTransactionSplits({
    method: data.splitMethod,
    totalCents: amountCents,
    memberIds: activeMembers.map((member) => member.id),
    responsibleMemberId: data.responsibleMemberId,
    details: splitDetails,
  });

  if (!splitResult.success) {
    const field = data.splitMethod === "INDIVIDUAL" ? "responsibleMemberId" : "splitDetails";
    return { status: "error", fieldErrors: { [field]: [splitResult.message] } };
  }

  try {
    await database().financialTransaction.create({
      data: {
        financialSpaceId: context.space.id,
        accountId: account.id,
        categoryId: category.id,
        payerMemberId: data.type === "EXPENSE" ? (data.payerMemberId ?? null) : null,
        createdById: context.user.id,
        type: data.type,
        status: data.status,
        splitMethod: data.splitMethod,
        description: data.description,
        amount: centsToDecimal(amountCents),
        competenceDate: civilDate(data.competenceDate),
        dueDate: data.dueDate ? civilDate(data.dueDate) : null,
        paidAt: data.status === "PAID" ? new Date() : null,
        notes: data.notes || null,
        splits: {
          create: splitResult.splits.map((split) => ({
            financialSpaceId: context.space.id,
            memberId: split.memberId,
            amount: centsToDecimal(split.cents),
            percentage: split.percentage ?? null,
          })),
        },
      },
    });
  } catch {
    return { status: "error", message: "Não foi possível salvar a movimentação." };
  }

  revalidatePath("/app", "layout");
  redirect("/app/movimentacoes?criada=1");
}
