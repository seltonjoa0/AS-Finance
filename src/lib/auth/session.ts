import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { database } from "@/lib/db/client";
import { SESSION_COOKIE_NAME } from "@/lib/auth/constants";
import { hashSessionToken } from "@/lib/auth/session-token";

type SessionCookie = {
  token: string;
  expiresAt: Date;
};

export async function setSessionCookie({ token, expiresAt }: SessionCookie) {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
    priority: "high",
  });
}

export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

export async function getCurrentSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!token) return null;

  const session = await database().session.findUnique({
    where: { tokenHash: hashSessionToken(token) },
    select: {
      id: true,
      userId: true,
      activeFinancialSpaceId: true,
      expiresAt: true,
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          createdAt: true,
          updatedAt: true,
        },
      },
    },
  });

  if (!session || session.expiresAt <= new Date()) return null;

  return session;
}

export async function requireUser() {
  const session = await getCurrentSession();
  if (!session) redirect("/login?motivo=sessao");
  return session;
}

export async function getFinancialContext() {
  const session = await getCurrentSession();
  if (!session) return null;
  return findFinancialContext(session);
}

async function findFinancialContext(
  session: NonNullable<Awaited<ReturnType<typeof getCurrentSession>>>,
) {
  if (!session.activeFinancialSpaceId) return null;

  const membership = await database().spaceMember.findUnique({
    where: {
      financialSpaceId_userId: {
        financialSpaceId: session.activeFinancialSpaceId,
        userId: session.userId,
      },
    },
    include: { financialSpace: true },
  });

  if (
    !membership ||
    membership.revokedAt ||
    membership.financialSpace.deletedAt
  ) {
    return null;
  }

  return {
    session,
    user: session.user,
    space: membership.financialSpace,
    membership,
  };
}

export async function requireFinancialContext() {
  const session = await requireUser();
  const context = await findFinancialContext(session);

  if (!context || context.session.id !== session.id) redirect("/onboarding");
  return context;
}
