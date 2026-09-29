import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { RegisterForm } from "@/components/auth/register-form";
import { AuthCard } from "@/components/ui/auth-card";
import { getCurrentSession } from "@/lib/auth/session";
import { safeRedirectPath } from "@/lib/auth/safe-redirect";

export const metadata: Metadata = { title: "Criar conta" };

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const next = safeRedirectPath(params.next);
  if (await getCurrentSession()) redirect(next ?? "/app");

  return (
    <AuthCard
      eyebrow="Seu começo"
      title="Crie sua conta"
      description="Primeiro, seus dados. Depois, você dá um nome ao espaço que vão compartilhar."
      footer={{
        text: "Já tem conta?",
        href: next ? `/login?next=${encodeURIComponent(next)}` : "/login",
        label: "Entrar",
      }}
    >
      <RegisterForm next={next ?? undefined} />
    </AuthCard>
  );
}
