import type { Metadata } from "next";
import { Landmark, UsersRound, WalletCards } from "lucide-react";

import { AccountForm } from "@/components/finance/account-form";
import { formatCents } from "@/features/finance/money";
import { getAccountsWithBalances, getFinanceCatalog } from "@/features/finance/queries";
import { requireFinancialContext } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Contas" };

const typeLabels = {
  CHECKING: "Conta corrente",
  SAVINGS: "Poupança",
  CASH: "Dinheiro",
  INVESTMENT: "Investimentos",
  CREDIT_CARD: "Cartão de crédito",
  OTHER: "Outra",
} as const;

export default async function AccountsPage() {
  const context = await requireFinancialContext();
  const [accounts, catalog] = await Promise.all([
    getAccountsWithBalances(context.space.id),
    getFinanceCatalog(context.space.id),
  ]);

  return (
    <div>
      <header>
        <p className="text-sm font-semibold text-brand-700">Organização</p>
        <h1 className="mt-1 text-3xl font-bold tracking-[-0.045em] text-ink">Contas</h1>
        <p className="mt-2 text-sm leading-6 text-muted sm:text-base">
          Cadastre onde o dinheiro fica e acompanhe o saldo consolidado.
        </p>
      </header>

      <div className="mt-7 grid gap-5 xl:grid-cols-[1fr_380px] xl:items-start">
        <section aria-labelledby="accounts-list-title">
          <div className="flex items-center justify-between">
            <h2 id="accounts-list-title" className="font-bold text-ink">Contas ativas</h2>
            <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-muted shadow-sm">
              {accounts.length} {accounts.length === 1 ? "conta" : "contas"}
            </span>
          </div>

          {accounts.length === 0 ? (
            <div className="mt-4 rounded-[20px] border border-dashed border-brand-200 bg-white p-8 text-center shadow-card">
              <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-brand-100 text-brand-700">
                <WalletCards className="size-7" aria-hidden="true" />
              </span>
              <h3 className="mt-4 font-bold text-ink">Nenhuma conta cadastrada</h3>
              <p className="mt-2 text-sm text-muted">Crie a primeira conta usando o formulário ao lado.</p>
            </div>
          ) : (
            <ul className="mt-4 grid gap-3 sm:grid-cols-2">
              {accounts.map((account) => (
                <li key={account.id} className="rounded-[20px] border border-line bg-white p-5 shadow-card">
                  <div className="flex items-start justify-between gap-3">
                    <span className="grid size-10 place-items-center rounded-2xl bg-brand-100 text-brand-700">
                      <Landmark className="size-5" aria-hidden="true" />
                    </span>
                    <span className="rounded-full bg-canvas px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-muted">
                      {account.ownership === "SHARED" ? "Compartilhada" : "Individual"}
                    </span>
                  </div>
                  <h3 className="mt-4 truncate font-bold text-ink">{account.name}</h3>
                  <p className="mt-1 text-xs text-muted">{typeLabels[account.type]}</p>
                  <p className={`mt-5 text-xl font-extrabold tracking-[-0.03em] ${account.balanceCents < 0n ? "text-red-600" : "text-ink"}`}>
                    {formatCents(account.balanceCents, account.currency)}
                  </p>
                  <p className="mt-1 flex items-center gap-1.5 text-xs text-muted">
                    <UsersRound className="size-3.5" aria-hidden="true" />
                    {account.holderMember?.user.name ?? "Todos do espaço"}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <aside className="rounded-[20px] border border-line bg-white p-5 shadow-card sm:p-6 xl:sticky xl:top-8">
          <h2 className="font-bold text-ink">Nova conta</h2>
          <p className="mt-1 text-sm leading-6 text-muted">O saldo inicial entra no cálculo sem criar uma receita artificial.</p>
          <div className="mt-6"><AccountForm members={catalog.members} /></div>
        </aside>
      </div>
    </div>
  );
}
