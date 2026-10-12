import type { Metadata } from "next";
import { ArrowDownRight, ArrowRightLeft, ArrowUpRight, Plus, ReceiptText } from "lucide-react";
import Link from "next/link";

import { formatAccountLabel } from "@/features/finance/accounts";
import { formatCivilDate } from "@/features/finance/dates";
import { decimalToCents, formatCents } from "@/features/finance/money";
import { getTransactions, getTransfers } from "@/features/finance/queries";
import { formatPercentageInput, parsePercentageUnits } from "@/features/finance/splits";
import { requireFinancialContext } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Movimentações" };

const splitMethodLabels = {
  INDIVIDUAL: "Responsável",
  EQUAL: "Divisão igual",
  PERCENTAGE: "Divisão percentual",
  CUSTOM: "Divisão personalizada",
  INCOME_BASED: "Proporcional à renda",
} as const;

function formatStoredPercentage(value: { toString(): string }) {
  const units = parsePercentageUnits(value.toString());
  return units === null ? value.toString().replace(".", ",") : formatPercentageInput(units);
}

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const context = await requireFinancialContext();
  const params = await searchParams;
  const type = params.tipo === "receita" ? "INCOME" : params.tipo === "despesa" ? "EXPENSE" : undefined;
  const transferOnly = params.tipo === "transferencia";
  const status = params.status === "pendente" ? "PENDING" : params.status === "pago" ? "PAID" : undefined;
  const showTransfers = transferOnly || (!params.tipo && !status);
  const [transactions, transfers] = await Promise.all([
    transferOnly
      ? Promise.resolve([])
      : getTransactions(context.space.id, { type, status }),
    showTransfers ? getTransfers(context.space.id) : Promise.resolve([]),
  ]);
  const movements = [
    ...transactions.map((transaction) => ({
      kind: "transaction" as const,
      occurredOn: transaction.competenceDate,
      createdAt: transaction.createdAt,
      data: transaction,
    })),
    ...transfers.map((transfer) => ({
      kind: "transfer" as const,
      occurredOn: transfer.transferDate,
      createdAt: transfer.createdAt,
      data: transfer,
    })),
  ].sort(
    (left, right) =>
      right.occurredOn.getTime() - left.occurredOn.getTime() ||
      right.createdAt.getTime() - left.createdAt.getTime(),
  ).slice(0, 100);

  return (
    <div>
      {params.criada === "1" && (
        <div className="mb-6 rounded-2xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm font-semibold text-brand-800" role="status">
          Movimentação registrada com sucesso.
        </div>
      )}
      {params.transferida === "1" && (
        <div className="mb-6 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-800" role="status">
          Transferência registrada com sucesso.
        </div>
      )}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-brand-700">Fluxo financeiro</p>
          <h1 className="mt-1 text-3xl font-bold tracking-[-0.045em] text-ink">Movimentações</h1>
          <p className="mt-2 text-sm leading-6 text-muted sm:text-base">Receitas, despesas e transferências registradas neste espaço.</p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex">
          <Link href="/app/transferencias/nova" className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-brand-200 bg-white px-4 text-sm font-bold text-brand-800 hover:bg-brand-50">
            <ArrowRightLeft className="size-4" /> Transferir
          </Link>
          <Link href="/app/movimentacoes/nova" className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 text-sm font-bold text-white hover:bg-brand-700">
            <Plus className="size-4" /> Nova movimentação
          </Link>
        </div>
      </header>

      <nav className="mt-6 flex flex-wrap gap-2" aria-label="Filtros de movimentações">
        {[
          ["/app/movimentacoes", "Todas", !params.tipo && !status],
          ["/app/movimentacoes?tipo=despesa", "Despesas", type === "EXPENSE"],
          ["/app/movimentacoes?tipo=receita", "Receitas", type === "INCOME"],
          ["/app/movimentacoes?tipo=transferencia", "Transferências", transferOnly],
          ["/app/movimentacoes?status=pendente", "Pendentes", status === "PENDING"],
        ].map(([href, label, active]) => (
          <Link
            key={String(href)}
            href={String(href)}
            aria-current={active ? "page" : undefined}
            className={`rounded-full px-4 py-2 text-xs font-bold ${active ? "bg-brand-700 text-white" : "border border-line bg-white text-muted hover:text-ink"}`}
          >
            {label}
          </Link>
        ))}
      </nav>

      {movements.length === 0 ? (
        <section className="mt-5 rounded-[20px] border border-dashed border-brand-200 bg-white px-6 py-12 text-center shadow-card">
          <ReceiptText className="mx-auto size-9 text-brand-500" />
          <h2 className="mt-4 font-bold text-ink">Nenhuma movimentação encontrada</h2>
          <p className="mt-2 text-sm text-muted">Registre uma receita, despesa ou transferência para começar.</p>
        </section>
      ) : (
        <section className="mt-5 overflow-hidden rounded-[20px] border border-line bg-white shadow-card">
          <ul className="divide-y divide-line">
            {movements.map((movement) => {
              if (movement.kind === "transfer") {
                const transfer = movement.data;
                const sourceLabel = formatAccountLabel({
                  ...transfer.sourceAccount,
                  holderName: transfer.sourceAccount.holderMember?.user.name,
                });
                const destinationLabel = formatAccountLabel({
                  ...transfer.destinationAccount,
                  holderName: transfer.destinationAccount.holderMember?.user.name,
                });
                return (
                  <li key={`transfer-${transfer.id}`} className="px-4 py-4 sm:px-6">
                    <div className="flex items-center gap-3">
                      <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-blue-50 text-blue-700">
                        <ArrowRightLeft className="size-5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate text-sm font-bold text-ink">
                            {transfer.description || "Transferência entre contas"}
                          </p>
                          <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-extrabold text-blue-700">
                            Transferida
                          </span>
                        </div>
                        <p className="mt-1 text-xs leading-5 text-muted">
                          <span className="block break-words"><strong>De:</strong> {sourceLabel}</span>
                          <span className="block break-words"><strong>Para:</strong> {destinationLabel}</span>
                          <span className="block">{formatCivilDate(transfer.transferDate)}</span>
                        </p>
                        {transfer.notes && (
                          <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted">
                            {transfer.notes}
                          </p>
                        )}
                      </div>
                      <p className="shrink-0 text-sm font-extrabold text-blue-800">
                        {formatCents(decimalToCents(transfer.amount), context.space.currency)}
                      </p>
                    </div>
                  </li>
                );
              }

              const transaction = movement.data;
              const income = transaction.type === "INCOME";
              const cents = decimalToCents(transaction.amount);
              return (
                <li key={`transaction-${transaction.id}`} className="px-4 py-4 sm:px-6">
                  <div className="flex items-center gap-3">
                    <span className={`grid size-10 shrink-0 place-items-center rounded-2xl ${income ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"}`}>
                      {income ? <ArrowUpRight className="size-5" /> : <ArrowDownRight className="size-5" />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-bold text-ink">{transaction.description}</p>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold ${transaction.status === "PAID" ? "bg-brand-100 text-brand-800" : "bg-amber-50 text-amber-700"}`}>
                          {transaction.status === "PAID" ? (income ? "Recebida" : "Paga") : "Pendente"}
                        </span>
                      </div>
                      <p className="mt-1 truncate text-xs text-muted">
                        {transaction.category.name} · {transaction.account.name} · {formatCivilDate(transaction.competenceDate)}
                      </p>
                    </div>
                    <p className={`shrink-0 text-sm font-extrabold ${income ? "text-emerald-700" : "text-ink"}`}>
                      {income ? "+" : "−"} {formatCents(cents, context.space.currency)}
                    </p>
                  </div>
                  {transaction.splits.length > 0 && (
                    <div className="mt-3 flex flex-wrap items-center gap-1.5 sm:ml-[52px]">
                      <span className="mr-1 text-xs font-bold text-muted">
                        {splitMethodLabels[transaction.splitMethod]}:
                      </span>
                      {transaction.splits.map((split) => (
                        <span key={split.id} className="rounded-full bg-canvas px-2.5 py-1 text-xs font-semibold text-ink">
                          {split.member.user.name}: {formatCents(decimalToCents(split.amount), context.space.currency)}
                          {split.percentage ? ` (${formatStoredPercentage(split.percentage)}%)` : ""}
                        </span>
                      ))}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
