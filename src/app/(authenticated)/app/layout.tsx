import { AppShell } from "@/components/layout/app-shell";
import { requireFinancialContext } from "@/lib/auth/session";
import { database } from "@/lib/db/client";
import type { ReactNode } from "react";

export default async function AuthenticatedLayout({
  children,
}: {
  children: ReactNode;
}) {
  const context = await requireFinancialContext();
  const memberships = await database().spaceMember.findMany({
    where: {
      userId: context.user.id,
      revokedAt: null,
      financialSpace: { deletedAt: null },
    },
    select: { financialSpace: { select: { id: true, name: true } } },
    orderBy: { createdAt: "asc" },
  });

  return (
    <AppShell
      user={{ name: context.user.name, email: context.user.email }}
      space={{ id: context.space.id, name: context.space.name }}
      spaces={memberships.map((membership) => membership.financialSpace)}
    >
      {children}
    </AppShell>
  );
}
