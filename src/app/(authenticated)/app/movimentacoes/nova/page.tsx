import type { Metadata } from "next";
import { ArrowLeft, CircleAlert } from "lucide-react";
import Link from "next/link";

import { TransactionForm } from "@/components/finance/transaction-form";
import { todayInTimezone } from "@/features/finance/dates";
import { getFinanceCatalog } from "@/features/finance/queries";
import { requireFinancialContext } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Nova movimentação" };

export default async function NewTransactionPage() {
  const context = await requireFinancialContext();
  const catalog = await getFinanceCatalog(context.space.id);
  const hasExpense = catalog.categories.some((category) => category.type === "EXPENSE");
  const hasIncome = catalog.categories.some((category) => category.type === "INCOME");
  const ready = catalog.accounts.length > 0 && (hasExpense || hasIncome);

  return (
    <div className="mx-auto max-w-4xl">
      <Link href="/app/movimentacoes" className="inline-flex items-center gap-2 text-sm font-bold text-muted hover:text-ink">
        <ArrowLeft className="size-4" /> Voltar
      </Link>
      <header className="mt-5">
        <p className="text-sm font-semibold text-brand-700">Fluxo financeiro</p>
        <h1 className="mt-1 text-3xl font-bold tracking-[-0.045em] text-ink">Nova movimentação</h1>
        <p className="mt-2 text-sm leading-6 text-muted sm:text-base">Registre o valor, a data e quem pagou ou ficou responsável.</p>
      </header>

      {!ready ? (
        <section className="mt-7 rounded-[20px] border border-amber-200 bg-amber-50 p-6">
          <div className="flex gap-3">
            <CircleAlert className="mt-0.5 size-5 shrink-0 text-amber-700" />
            <div>
              <h2 className="font-bold text-ink">Complete o cadastro básico</h2>
              <p className="mt-1 text-sm leading-6 text-muted">Você precisa de ao menos uma conta e uma categoria antes de registrar movimentações.</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {catalog.accounts.length === 0 && <Link href="/app/contas" className="rounded-xl bg-white px-4 py-2 text-sm font-bold text-ink shadow-sm">Criar conta</Link>}
                {!hasExpense && !hasIncome && <Link href="/app/categorias" className="rounded-xl bg-white px-4 py-2 text-sm font-bold text-ink shadow-sm">Criar categoria</Link>}
              </div>
            </div>
          </div>
        </section>
      ) : (
        <section className="mt-7 rounded-[20px] border border-line bg-white p-5 shadow-card sm:p-8">
          <TransactionForm
            accounts={catalog.accounts}
            categories={catalog.categories}
            members={catalog.members}
            incomeHistory={catalog.incomeHistory}
            canManageIncome={context.membership.role === "OWNER"}
            today={todayInTimezone(context.space.timezone)}
            initialType={hasExpense ? "EXPENSE" : "INCOME"}
          />
        </section>
      )}
    </div>
  );
}
