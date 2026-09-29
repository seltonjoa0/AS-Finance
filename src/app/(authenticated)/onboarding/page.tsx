import type { Metadata } from "next";
import { CheckCircle2, ShieldCheck, UsersRound } from "lucide-react";
import { redirect } from "next/navigation";

import { SpaceForm } from "@/components/auth/space-form";
import { Logo } from "@/components/ui/logo";
import { getFinancialContext, requireUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Criar espaço financeiro" };

export default async function OnboardingPage() {
  const session = await requireUser();
  if (await getFinancialContext()) redirect("/app");

  return (
    <main className="min-h-dvh bg-canvas px-5 py-8 sm:px-8 sm:py-12">
      <div className="mx-auto max-w-5xl">
        <div className="flex justify-center sm:justify-start">
          <Logo />
        </div>
        <div className="mt-10 grid items-center gap-10 lg:grid-cols-[1fr_440px] lg:gap-20">
          <section className="max-w-xl">
            <span className="inline-flex items-center gap-2 rounded-full bg-brand-100 px-3 py-1.5 text-xs font-bold text-brand-800">
              <CheckCircle2 className="size-3.5" aria-hidden="true" />
              Conta criada
            </span>
            <h1 className="mt-5 text-4xl leading-tight font-bold tracking-[-0.055em] text-ink sm:text-5xl">
              Agora, crie o espaço de vocês.
            </h1>
            <p className="mt-5 text-base leading-7 text-muted">
              Olá, {session.user.name.split(" ")[0]}. Este será o lugar onde as
              decisões financeiras ficam visíveis, organizadas e protegidas.
            </p>
            <div className="mt-8 space-y-4">
              <div className="flex gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-white text-brand-700 shadow-sm">
                  <UsersRound className="size-5" aria-hidden="true" />
                </span>
                <div>
                  <p className="font-bold text-ink">Feito para compartilhar</p>
                  <p className="mt-1 text-sm leading-6 text-muted">
                    Você será OWNER e poderá convidar os outros participantes depois.
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-white text-brand-700 shadow-sm">
                  <ShieldCheck className="size-5" aria-hidden="true" />
                </span>
                <div>
                  <p className="font-bold text-ink">Isolado e seguro</p>
                  <p className="mt-1 text-sm leading-6 text-muted">
                    O acesso é sempre validado pela sua participação no espaço.
                  </p>
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-[24px] border border-white bg-white p-6 shadow-card sm:p-8">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-brand-700">
              Passo 2 de 2
            </p>
            <h2 className="mt-2 text-2xl font-bold tracking-[-0.04em] text-ink">
              Como vamos chamar?
            </h2>
            <p className="mt-2 mb-7 text-sm leading-6 text-muted">
              Escolha um nome familiar. Ele aparecerá no topo do aplicativo.
            </p>
            <SpaceForm />
          </section>
        </div>
      </div>
    </main>
  );
}
