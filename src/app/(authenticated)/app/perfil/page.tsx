import type { Metadata } from "next";
import { KeyRound, LogOut, Mail, UserRound } from "lucide-react";

import { logoutAction } from "@/features/auth/actions";
import { requireFinancialContext } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Meu perfil" };

export default async function ProfilePage() {
  const context = await requireFinancialContext();
  const initials = context.user.name
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  return (
    <div className="mx-auto max-w-3xl">
      <header>
        <p className="text-sm font-semibold text-brand-700">Perfil</p>
        <h1 className="mt-1 text-3xl font-bold tracking-[-0.045em] text-ink">
          Seus dados
        </h1>
        <p className="mt-2 text-sm leading-6 text-muted sm:text-base">
          Informações usadas para identificar você nos espaços financeiros.
        </p>
      </header>

      <section className="mt-7 overflow-hidden rounded-[20px] border border-line bg-white shadow-card">
        <div className="flex flex-col items-center gap-4 border-b border-line bg-[linear-gradient(135deg,#f2fbf6_0%,#ffffff_70%)] p-7 text-center sm:flex-row sm:text-left">
          <span className="grid size-20 shrink-0 place-items-center rounded-[26px] bg-brand-500 text-xl font-extrabold text-white shadow-[0_10px_26px_rgba(50,154,98,0.2)]">
            {initials}
          </span>
          <div>
            <h2 className="text-xl font-bold tracking-[-0.03em] text-ink">{context.user.name}</h2>
            <p className="mt-1 text-sm text-muted">Membro de {context.space.name}</p>
            <span className="mt-3 inline-block rounded-full bg-brand-100 px-3 py-1 text-[10px] font-extrabold tracking-wide text-brand-800">
              {context.membership.role}
            </span>
          </div>
        </div>

        <dl className="divide-y divide-line px-5 sm:px-7">
          <div className="flex items-center gap-4 py-5">
            <span className="grid size-10 place-items-center rounded-2xl bg-canvas text-muted">
              <UserRound className="size-5" aria-hidden="true" />
            </span>
            <div>
              <dt className="text-xs font-semibold text-muted">Nome</dt>
              <dd className="mt-1 text-sm font-bold text-ink">{context.user.name}</dd>
            </div>
          </div>
          <div className="flex items-center gap-4 py-5">
            <span className="grid size-10 place-items-center rounded-2xl bg-canvas text-muted">
              <Mail className="size-5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <dt className="text-xs font-semibold text-muted">E-mail</dt>
              <dd className="mt-1 truncate text-sm font-bold text-ink">{context.user.email}</dd>
            </div>
          </div>
          <div className="flex items-center gap-4 py-5">
            <span className="grid size-10 place-items-center rounded-2xl bg-canvas text-muted">
              <KeyRound className="size-5" aria-hidden="true" />
            </span>
            <div>
              <dt className="text-xs font-semibold text-muted">Segurança</dt>
              <dd className="mt-1 text-sm font-bold text-ink">Senha protegida com Argon2id</dd>
            </div>
          </div>
        </dl>

        <div className="border-t border-line p-5 sm:p-7">
          <form action={logoutAction}>
            <button
              type="submit"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-red-100 bg-red-50 px-5 text-sm font-bold text-red-700 hover:border-red-200 hover:bg-red-100"
            >
              <LogOut className="size-4" aria-hidden="true" />
              Sair da conta
            </button>
          </form>
        </div>
      </section>
    </div>
  );
}
