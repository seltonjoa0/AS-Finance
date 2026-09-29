"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { financialSpaceSchema } from "@/features/spaces/schemas";
import { buildInitialSpaceData } from "@/features/spaces/factory";
import {
  requireFinancialContext,
  requireUser,
} from "@/lib/auth/session";
import { database } from "@/lib/db/client";
import { z } from "zod";
import {
  fieldErrors,
  type FormState,
} from "@/lib/validation/form-state";

export async function createSpaceAction(
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireUser();
  const result = financialSpaceSchema.safeParse(Object.fromEntries(formData));

  if (!result.success) {
    return { status: "error", fieldErrors: fieldErrors(result.error) };
  }

  const existingMembership = await database().spaceMember.findFirst({
    where: {
      userId: session.userId,
      revokedAt: null,
      financialSpace: { deletedAt: null },
    },
    select: { financialSpaceId: true },
  });

  if (existingMembership) {
    await database().session.update({
      where: { id: session.id },
      data: { activeFinancialSpaceId: existingMembership.financialSpaceId },
    });
    redirect("/app");
  }

  try {
    await database().$transaction(async (transaction) => {
      const space = await transaction.financialSpace.create({
        data: buildInitialSpaceData(session.userId, result.data.name),
      });

      await transaction.session.update({
        where: { id: session.id },
        data: { activeFinancialSpaceId: space.id },
      });
    });
  } catch {
    return {
      status: "error",
      message: "Não foi possível criar o espaço. Tente novamente.",
    };
  }

  redirect("/app?bem-vindo=1");
}

export async function updateSpaceAction(
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  const context = await requireFinancialContext();
  if (context.membership.role !== "OWNER") {
    return {
      status: "error",
      message: "Somente o responsável pelo espaço pode alterar estes dados.",
    };
  }

  const result = financialSpaceSchema.safeParse(Object.fromEntries(formData));
  if (!result.success) {
    return { status: "error", fieldErrors: fieldErrors(result.error) };
  }

  const updated = await database().financialSpace.updateMany({
    where: { id: context.space.id, deletedAt: null },
    data: { name: result.data.name },
  });

  if (updated.count !== 1) {
    return {
      status: "error",
      message: "Não foi possível salvar as alterações.",
    };
  }

  revalidatePath("/app", "layout");
  return { status: "success", message: "Nome do espaço atualizado." };
}

export async function switchSpaceAction(formData: FormData) {
  const session = await requireUser();
  const result = z.string().uuid().safeParse(formData.get("financialSpaceId"));
  if (!result.success) return;

  const membership = await database().spaceMember.findFirst({
    where: {
      financialSpaceId: result.data,
      userId: session.userId,
      revokedAt: null,
      financialSpace: { deletedAt: null },
    },
    select: { financialSpaceId: true },
  });
  if (!membership) return;

  await database().session.updateMany({
    where: { id: session.id, userId: session.userId },
    data: { activeFinancialSpaceId: membership.financialSpaceId },
  });
  revalidatePath("/app", "layout");
  redirect("/app");
}
