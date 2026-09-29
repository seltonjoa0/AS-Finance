import type { Metadata } from "next";
import { ArrowLeft, ArrowRightLeft, CircleAlert } from "lucide-react";
import Link from "next/link";

import { TransferForm } from "@/components/finance/transfer-form";
import { formatAccountLabel } from "@/features/finance/accounts";
import { todayInTimezone } from "@/features/finance/dates";
import { getFinanceCatalog } from "@/features/finance/queries";
import { requireFinancialContext } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Nova transferência" };

export default async function NewTransferPage() {
  const context = await requireFinancialContext();
  const catalog = await getFinanceCatalog(context.space.id);
  const ready = catalog.accounts.length >= 2;

  return (
    <div className="mx-auto max-w-4xl">
      <Link href="/app/movimentacoes" className="inline-flex items-center gap-2 text-sm font-bold text-muted hover:text-ink">
        <ArrowLeft className="size-4" /> Voltar
      </Link>
      <header className="mt-5">
        <p className="text-sm font-semibold text-brand-700">Entre contas</p>
        <h1 className="mt-1 text-3xl font-bold tracking-[-0.045em] text-ink">Nova transferência</h1>
        <p className="mt-2 text-sm leading-6 text-muted sm:text-base">
          Mova dinheiro sem criar uma receita ou despesa artificial.
        </p>
      </header>

      {!ready ? (
        <section className="mt-7 rounded-[20px] border border-amber-200 bg-amber-50 p-6">
          <div className="flex gap-3">
            <CircleAlert className="mt-0.5 size-5 shrink-0 text-amber-700" />
            <div>
              <h2 className="font-bold text-ink">Cadastre pelo menos duas contas</h2>
              <p className="mt-1 text-sm leading-6 text-muted">
                Uma transferência precisa de uma conta de origem e outra de destino.
              </p>
              <Link href="/app/contas" className="mt-4 inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-bold text-ink shadow-sm">
                <ArrowRightLeft className="size-4" /> Gerenciar contas
              </Link>
            </div>
          </div>
        </section>
      ) : (
        <section className="mt-7 rounded-[20px] border border-line bg-white p-5 shadow-card sm:p-8">
          <TransferForm
            accounts={catalog.accounts.map((account) => ({
              id: account.id,
              label: formatAccountLabel({
                ...account,
                holderName: account.holderMember?.user.name,
              }),
            }))}
            today={todayInTimezone(context.space.timezone)}
          />
        </section>
      )}
    </div>
  );
}
