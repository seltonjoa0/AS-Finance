"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { invitationStatus } from "@/features/invitations/policy";
import {
  invitationIdSchema,
  invitationSchema,
  invitationTokenSchema,
} from "@/features/invitations/schemas";
import {
  createInvitationToken,
  hashInvitationToken,
  invitationExpiration,
} from "@/features/invitations/token";
import {
  clearSessionCookie,
  getCurrentSession,
  requireFinancialContext,
} from "@/lib/auth/session";
import { database } from "@/lib/db/client";
import { fieldErrors, type FormState } from "@/lib/validation/form-state";

export type InvitationFormState = FormState & { invitationPath?: string };

export async function createInvitationAction(
  _previousState: InvitationFormState,
  formData: FormData,
): Promise<InvitationFormState> {
  const context = await requireFinancialContext();
  if (context.membership.role !== "OWNER") {
    return { status: "error", message: "Somente o responsável pode convidar membros." };
  }

  const result = invitationSchema.safeParse(Object.fromEntries(formData));
  if (!result.success) {
    return { status: "error", fieldErrors: fieldErrors(result.error) };
  }

  const email = result.data.email;
  await database().spaceInvitation.updateMany({
    where: {
      financialSpaceId: context.space.id,
      email,
      acceptedAt: null,
      revokedAt: null,
      expiresAt: { lte: new Date() },
    },
    data: { revokedAt: new Date() },
  });

  const [member, pendingCount, pendingInvitation] = await Promise.all([
    database().spaceMember.findFirst({
      where: {
        financialSpaceId: context.space.id,
        revokedAt: null,
        user: { email },
      },
      select: { id: true },
    }),
    database().spaceInvitation.count({
      where: {
        financialSpaceId: context.space.id,
        acceptedAt: null,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
    }),
    database().spaceInvitation.findFirst({
      where: {
        financialSpaceId: context.space.id,
        email,
        acceptedAt: null,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      select: { id: true },
    }),
  ]);

  if (member) {
    return { status: "error", fieldErrors: { email: ["Essa pessoa já participa do espaço."] } };
  }
  if (pendingInvitation) {
    return { status: "error", fieldErrors: { email: ["Já existe um convite válido para este e-mail."] } };
  }
  if (pendingCount >= 20) {
    return { status: "error", message: "Cancele algum convite pendente antes de criar outro." };
  }

  const token = createInvitationToken();
  try {
    await database().spaceInvitation.create({
      data: {
        financialSpaceId: context.space.id,
        email,
        role: "MEMBER",
        tokenHash: hashInvitationToken(token),
        expiresAt: invitationExpiration(),
        createdById: context.user.id,
      },
    });
  } catch {
    return { status: "error", message: "Não foi possível criar o convite. Tente novamente." };
  }

  revalidatePath("/app/configuracoes");
  return {
    status: "success",
    message: "Convite criado. Compartilhe o link com segurança.",
    invitationPath: `/convite/${token}`,
  };
}

export async function acceptInvitationAction(
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  const tokenResult = invitationTokenSchema.safeParse(formData.get("token"));
  if (!tokenResult.success) return { status: "error", message: "Este convite não é válido." };

  const token = tokenResult.data;
  const session = await getCurrentSession();
  if (!session) redirect(`/login?next=${encodeURIComponent(`/convite/${token}`)}`);

  const invitation = await database().spaceInvitation.findUnique({
    where: { tokenHash: hashInvitationToken(token) },
    select: {
      id: true,
      email: true,
      role: true,
      financialSpaceId: true,
      expiresAt: true,
      acceptedAt: true,
      revokedAt: true,
    },
  });

  if (!invitation) return { status: "error", message: "Este convite não é válido." };
  const status = invitationStatus(invitation, session.user.email);
  if (status === "wrong-account") {
    return { status: "error", message: "Este convite foi enviado para outro e-mail." };
  }
  if (status !== "available") {
    return { status: "error", message: "Este convite expirou ou já foi utilizado." };
  }

  try {
    await database().$transaction(async (transaction) => {
      const claimed = await transaction.spaceInvitation.updateMany({
        where: {
          id: invitation.id,
          acceptedAt: null,
          revokedAt: null,
          expiresAt: { gt: new Date() },
        },
        data: { acceptedAt: new Date(), acceptedById: session.userId },
      });
      if (claimed.count !== 1) throw new Error("Invitation is no longer available");

      const membership = await transaction.spaceMember.findUnique({
        where: {
          financialSpaceId_userId: {
            financialSpaceId: invitation.financialSpaceId,
            userId: session.userId,
          },
        },
        select: { id: true, role: true },
      });

      if (membership) {
        await transaction.spaceMember.update({
          where: { id: membership.id },
          data: {
            revokedAt: null,
            role: membership.role === "OWNER" ? "OWNER" : invitation.role,
          },
        });
      } else {
        await transaction.spaceMember.create({
          data: {
            financialSpaceId: invitation.financialSpaceId,
            userId: session.userId,
            role: invitation.role,
          },
        });
      }

      await transaction.session.updateMany({
        where: { id: session.id, userId: session.userId },
        data: { activeFinancialSpaceId: invitation.financialSpaceId },
      });
    });
  } catch {
    return { status: "error", message: "Não foi possível aceitar o convite. Tente novamente." };
  }

  redirect("/app?convite=aceito");
}

export async function revokeInvitationAction(formData: FormData) {
  const context = await requireFinancialContext();
  if (context.membership.role !== "OWNER") return;

  const result = invitationIdSchema.safeParse(formData.get("invitationId"));
  if (!result.success) return;

  await database().spaceInvitation.updateMany({
    where: {
      id: result.data,
      financialSpaceId: context.space.id,
      acceptedAt: null,
      revokedAt: null,
    },
    data: { revokedAt: new Date() },
  });
  revalidatePath("/app/configuracoes");
}

export async function logoutForInvitationAction(formData: FormData) {
  const tokenResult = invitationTokenSchema.safeParse(formData.get("token"));
  if (!tokenResult.success) redirect("/login");

  const session = await getCurrentSession();
  if (session) await database().session.deleteMany({ where: { id: session.id } });
  await clearSessionCookie();
  const next = `/convite/${tokenResult.data}`;
  redirect(`/login?next=${encodeURIComponent(next)}`);
}
