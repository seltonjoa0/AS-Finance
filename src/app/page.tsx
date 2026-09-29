import {
  ArrowRight,
  Check,
  HeartHandshake,
  LockKeyhole,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { LucideIcon } from "lucide-react";

import { LoginForm } from "@/components/auth/login-form";
import { Logo } from "@/components/ui/logo";
import {
  getCurrentSession,
  getFinancialContext,
} from "@/lib/auth/session";

const benefits: Array<{ icon: LucideIcon; label: string }> = [
  { icon: LockKeyhole, label: "Dados protegidos" },
  { icon: HeartHandshake, label: "Feito para dois" },
  { icon: TrendingUp, label: "Planos mais claros" },
];

export default async function HomePage() {
  const session = await getCurrentSession();
  if (session) {
    const context = await getFinancialContext();
    redirect(context ? "/app" : "/onboarding");
  }

  return (
    <main className="min-h-dvh overflow-hidden bg-canvas">
      <div className="mx-auto flex min-h-dvh max-w-[1440px] flex-col px-5 sm:px-8 lg:px-12">
        <header className="flex h-20 shrink-0 items-center justify-between">
          <Logo />
          <Link
            href="/cadastro"
            className="rounded-xl border border-line bg-white px-4 py-2.5 text-sm font-bold text-ink shadow-sm hover:border-brand-300 hover:text-brand-800"
          >
            Criar conta
          </Link>
        </header>

        <div className="grid flex-1 items-center gap-12 py-10 lg:grid-cols-[1.08fr_0.92fr] lg:gap-20 lg:py-14">
          <section className="relative max-w-2xl">
            <div
              className="absolute -left-32 top-4 -z-0 size-80 rounded-full bg-brand-200/45 blur-3xl"
              aria-hidden="true"
            />
            <div className="relative">
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-3.5 py-2 text-xs font-bold text-brand-800">
                <Sparkles className="size-3.5" aria-hidden="true" />
                Cuidar do dinheiro também é cuidar da vida a dois
              </div>
              <h1 className="max-w-xl text-[2.55rem] leading-[1.04] font-bold tracking-[-0.06em] text-ink sm:text-5xl lg:text-[3.7rem]">
                Finanças a dois,
                <span className="block text-brand-600">sem complicação.</span>
              </h1>
              <p className="mt-6 max-w-xl text-base leading-7 text-muted sm:text-lg sm:leading-8">
                Um espaço claro e seguro para organizar decisões, dividir
                responsabilidades e construir planos juntos.
              </p>

              <div className="mt-8 grid max-w-lg gap-3 sm:grid-cols-3">
                {benefits.map(({ icon: Icon, label }) => (
                  <div
                    key={String(label)}
                    className="flex items-center gap-2.5 text-sm font-semibold text-[#566059]"
                  >
                    <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-white text-brand-700 shadow-sm">
                      <Icon className="size-4" aria-hidden="true" />
                    </span>
                    {label}
                  </div>
                ))}
              </div>

              <div className="relative mt-10 hidden max-w-[540px] sm:block" aria-hidden="true">
                <div className="rounded-[22px] border border-white bg-white/90 p-5 shadow-card backdrop-blur-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold text-muted">Seu espaço</p>
                      <p className="mt-1 font-bold text-ink">Nossa vida financeira</p>
                    </div>
                    <span className="grid size-9 place-items-center rounded-full bg-brand-100 text-brand-700">
                      <Check className="size-4" />
                    </span>
                  </div>
                  <div className="mt-5 grid grid-cols-3 gap-3">
                    {["Organizar", "Compartilhar", "Planejar"].map((item, index) => (
                      <div key={item} className="rounded-2xl bg-canvas p-3.5">
                        <span className="mb-5 block h-1.5 rounded-full bg-line">
                          <span
                            className="block h-full rounded-full bg-brand-400"
                            style={{ width: `${78 - index * 17}%` }}
                          />
                        </span>
                        <p className="text-xs font-bold text-[#566059]">{item}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="relative mx-auto w-full max-w-[440px] lg:mx-0 lg:justify-self-end">
            <div
              className="absolute -inset-16 -z-0 rounded-full bg-[#dfeafb]/55 blur-3xl"
              aria-hidden="true"
            />
            <div className="relative rounded-[26px] border border-white/90 bg-white p-6 shadow-card sm:p-8">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-brand-700">
                Que bom ter você aqui
              </p>
              <h2 className="mt-2 text-2xl font-bold tracking-[-0.04em] text-ink">
                Entre no seu espaço
              </h2>
              <p className="mt-2 mb-7 text-sm leading-6 text-muted">
                Continue de onde parou e cuide dos próximos passos.
              </p>
              <LoginForm />
              <div className="mt-6 flex items-center gap-3 text-xs text-[#9aa19c]">
                <span className="h-px flex-1 bg-line" />
                ainda não tem conta?
                <span className="h-px flex-1 bg-line" />
              </div>
              <Link
                href="/cadastro"
                className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-line text-sm font-bold text-ink hover:border-brand-300 hover:bg-brand-50 hover:text-brand-800"
              >
                Começar agora
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            </div>
          </section>
        </div>

        <footer className="flex min-h-16 items-center justify-between border-t border-line/80 py-4 text-xs text-muted">
          <p>© {new Date().getFullYear()} Aflora</p>
          <p className="hidden sm:block">Privacidade e clareza desde o início.</p>
        </footer>
      </div>
    </main>
  );
}
