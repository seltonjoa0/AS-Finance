import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { LoginForm } from "@/components/auth/login-form";
import { AuthCard } from "@/components/ui/auth-card";
import {
  getCurrentSession,
  getFinancialContext,
} from "@/lib/auth/session";
import { safeRedirectPath } from "@/lib/auth/safe-redirect";

export const metadata: Metadata = { title: "Entrar" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const next = safeRedirectPath(params.next);
  const session = await getCurrentSession();
  if (session) {
    if (next) redirect(next);
    const context = await getFinancialContext();
    redirect(context ? "/app" : "/onboarding");
  }

  return (
    <AuthCard
      eyebrow="Bem-vindo de volta"
      title="Entre no seu espaço"
      description="Seus planos continuam aqui, organizados e seguros."
      footer={{
        text: "Ainda não tem conta?",
        href: next ? `/cadastro?next=${encodeURIComponent(next)}` : "/cadastro",
        label: "Criar agora",
      }}
    >
      <LoginForm next={next ?? undefined} />
    </AuthCard>
  );
}
