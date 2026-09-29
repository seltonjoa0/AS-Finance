"use server";

import { redirect } from "next/navigation";

import { loginSchema, registerSchema } from "@/features/auth/schemas";
import {
  clearSessionCookie,
  getCurrentSession,
  setSessionCookie,
} from "@/lib/auth/session";
import {
  createSessionToken,
  hashSessionToken,
  sessionExpiration,
} from "@/lib/auth/session-token";
import { safeRedirectPath } from "@/lib/auth/safe-redirect";
import { database } from "@/lib/db/client";
import { getServerEnv } from "@/lib/env";
import { hashPassword, verifyPassword } from "@/lib/security/password";
import {
  clearAuthAttempts,
  consumeAuthAttempt,
} from "@/lib/security/rate-limit";
import {
  fieldErrors,
  type FormState,
} from "@/lib/validation/form-state";

const GENERIC_AUTH_ERROR = "E-mail ou senha inválidos.";

export async function registerAction(
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  const result = registerSchema.safeParse(Object.fromEntries(formData));

  if (!result.success) {
    return { status: "error", fieldErrors: fieldErrors(result.error) };
  }

  const rateKey = `register:${result.data.email}`;
  if (!consumeAuthAttempt(rateKey).allowed) {
    return {
      status: "error",
      message: "Muitas tentativas. Aguarde alguns minutos e tente novamente.",
    };
  }

  const client = database();
  const existingUser = await client.user.findUnique({
    where: { email: result.data.email },
    select: { id: true },
  });

  if (existingUser) {
    return {
      status: "error",
      message: "Não foi possível criar a conta com esses dados.",
    };
  }

  try {
    const passwordHash = await hashPassword(result.data.password);
    const token = createSessionToken();
    const expiresAt = sessionExpiration(getServerEnv().SESSION_TTL_DAYS);

    await client.user.create({
      data: {
        name: result.data.name,
        email: result.data.email,
        passwordHash,
        sessions: {
          create: {
            tokenHash: hashSessionToken(token),
            expiresAt,
          },
        },
      },
    });

    await setSessionCookie({ token, expiresAt });
    clearAuthAttempts(rateKey);
  } catch {
    return {
      status: "error",
      message: "Não foi possível criar sua conta. Tente novamente.",
    };
  }

  redirect(safeRedirectPath(result.data.next) ?? "/onboarding");
}

export async function loginAction(
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  const result = loginSchema.safeParse(Object.fromEntries(formData));

  if (!result.success) {
    return { status: "error", fieldErrors: fieldErrors(result.error) };
  }

  const rateKey = `login:${result.data.email}`;
  if (!consumeAuthAttempt(rateKey).allowed) {
    return {
      status: "error",
      message: "Muitas tentativas. Aguarde alguns minutos e tente novamente.",
    };
  }

  const user = await database().user.findUnique({
    where: { email: result.data.email },
    select: { id: true, passwordHash: true },
  });

  if (!user || !(await verifyPassword(user.passwordHash, result.data.password))) {
    return { status: "error", message: GENERIC_AUTH_ERROR };
  }

  const membership = await database().spaceMember.findFirst({
    where: {
      userId: user.id,
      revokedAt: null,
      financialSpace: { deletedAt: null },
    },
    select: { financialSpaceId: true },
    orderBy: { createdAt: "asc" },
  });

  const token = createSessionToken();
  const expiresAt = sessionExpiration(getServerEnv().SESSION_TTL_DAYS);

  await database().session.create({
    data: {
      tokenHash: hashSessionToken(token),
      userId: user.id,
      activeFinancialSpaceId: membership?.financialSpaceId,
      expiresAt,
    },
  });

  await setSessionCookie({ token, expiresAt });
  clearAuthAttempts(rateKey);
  redirect(
    safeRedirectPath(result.data.next) ?? (membership ? "/app" : "/onboarding"),
  );
}

export async function logoutAction() {
  const session = await getCurrentSession();

  if (session) {
    await database().session.deleteMany({ where: { id: session.id } });
  }

  await clearSessionCookie();
  redirect("/?saiu=1");
}
