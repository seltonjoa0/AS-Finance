import {
  ArrowDownRight,
  ArrowRight,
  ArrowRightLeft,
  ArrowUpRight,
  CalendarClock,
  CircleDollarSign,
  PiggyBank,
  Plus,
  ReceiptText,
  Sparkles,
  WalletCards,
} from "lucide-react";
import Link from "next/link";

import { formatAccountLabel } from "@/features/finance/accounts";
import { formatCivilDate } from "@/features/finance/dates";
import { decimalToCents, formatCents } from "@/features/finance/money";
import { getFinanceOverview } from "@/features/finance/queries";
import { requireFinancialContext } from "@/lib/auth/session";

const toneClasses = {
  brand: "bg-brand-100 text-brand-700",
  green: "bg-emerald-50 text-emerald-700",
  red: "bg-red-50 text-red-600",
  amber: "bg-amber-50 text-amber-700",
};

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const context = await requireFinancialContext();
  const [params, overview] = await Promise.all([
    searchParams,
    getFinanceOverview(context.space.id, context.space.timezone),
  ]);
  const firstName = context.user.name.split(" ")[0];
  const summaryCards = [
    { label: "Saldo", value: formatCents(overview.balanceCents), icon: WalletCards, tone: "brand" as const },
    { label: "Receitas no mês", value: formatCents(overview.incomeCents), icon: CircleDollarSign, tone: "green" as const },
    { label: "Despesas no mês", value: formatCents(overview.expenseCents), icon: ReceiptText, tone: "red" as const },
    { label: "Compromissos", value: formatCents(overview.pendingCents), icon: CalendarClock, tone: "amber" as const },
  ];

  return (
    <div>
      {(params["bem-vindo"] === "1" || params.convite === "aceito") && (
        <div className="mb-6 flex items-center gap-3 rounded-2xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm font-semibold text-brand-800" role="status">
          <Sparkles className="size-4 shrink-0" aria-hidden="true" />
          {params.convite === "aceito"
            ? "Convite aceito. Você já está no novo espaço financeiro."
            : "Seu espaço foi criado. Tudo pronto para começar."}
        </div>
      )}

      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-brand-700">Visão geral</p>
          <h1 className="mt-1 text-3xl font-bold tracking-[-0.045em] text-ink sm:text-4xl">
            Olá, {firstName} <span aria-hidden="true">👋</span>
          </h1>
          <p className="mt-2 text-sm leading-6 text-muted sm:text-base">Seu panorama financeiro, sem complicação.</p>
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

      <section className="mt-7 grid grid-cols-2 gap-3 xl:grid-cols-4" aria-label="Resumo financeiro">
        {summaryCards.map(({ label, value, icon: Icon, tone }) => (
          <article key={label} className="rounded-[18px] border border-line bg-white p-4 shadow-card sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-semibold text-muted sm:text-sm">{label}</p>
                <p className="mt-2 truncate text-lg font-bold tracking-[-0.03em] text-ink sm:text-xl">{value}</p>
              </div>
              <span className={`grid size-9 shrink-0 place-items-center rounded-xl ${toneClasses[tone]}`}>
                <Icon className="size-[17px]" aria-hidden="true" />
              </span>
            </div>
          </article>
        ))}
      </section>

      {overview.accountCount === 0 ? (
        <section className="mt-5 grid gap-5 xl:grid-cols-[1.45fr_0.75fr]">
          <article className="flex min-h-[320px] flex-col items-center justify-center rounded-[20px] border border-line bg-white px-6 py-10 text-center shadow-card sm:px-10">
            <span className="relative grid size-16 place-items-center rounded-[22px] bg-brand-100 text-brand-700">
              <PiggyBank className="size-8" aria-hidden="true" />
              <span className="absolute -right-1 -top-1 size-4 rounded-full border-[3px] border-white bg-brand-400" />
            </span>
            <h2 className="mt-5 text-xl font-bold tracking-[-0.03em] text-ink">Comece pela primeira conta</h2>
            <p className="mt-2 max-w-md text-sm leading-6 text-muted">Cadastre onde seu dinheiro fica. Depois, crie categorias e registre receitas e despesas.</p>
            <Link href="/app/contas" className="mt-6 inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-brand-600 px-5 text-sm font-bold text-white hover:bg-brand-700">
              Criar primeira conta <ArrowRight className="size-4" />
            </Link>
          </article>
          <article className="rounded-[20px] border border-line bg-[#223b2e] p-6 text-white shadow-card sm:p-7">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-brand-300">Próximos passos</p>
            <h2 className="mt-3 text-xl font-bold tracking-[-0.03em]">Prepare seu espaço</h2>
            <ol className="mt-7 space-y-4 text-sm font-semibold">
              {["Cadastre uma conta", "Crie suas categorias", "Registre uma movimentação"].map((item, index) => (
                <li key={item} className="flex items-center gap-3">
                  <span className="grid size-7 place-items-center rounded-full bg-white/10 text-xs text-brand-300">{index + 1}</span>{item}
                </li>
              ))}
            </ol>
          </article>
        </section>
      ) : (
        <section className="mt-5 grid gap-5 xl:grid-cols-[1.45fr_0.75fr]">
          <article className="overflow-hidden rounded-[20px] border border-line bg-white shadow-card">
            <div className="flex items-center justify-between border-b border-line px-5 py-4 sm:px-6">
              <div><h2 className="font-bold text-ink">Movimentações recentes</h2><p className="mt-0.5 text-xs text-muted">Últimos registros do espaço</p></div>
              <Link href="/app/movimentacoes" className="text-xs font-bold text-brand-700 hover:text-brand-800">Ver todas</Link>
            </div>
            {overview.recent.length === 0 ? (
              <div className="px-6 py-12 text-center"><ReceiptText className="mx-auto size-7 text-[#b5beb7]" /><p className="mt-3 text-sm text-muted">Ainda não há movimentações.</p></div>
            ) : (
              <ul className="divide-y divide-line">
                {overview.recent.map((movement) => {
                  if (movement.kind === "transfer") {
                    const sourceLabel = formatAccountLabel({
                      ...movement.sourceAccount,
                      holderName: movement.sourceAccount.holderMember?.user.name,
                    });
                    const destinationLabel = formatAccountLabel({
                      ...movement.destinationAccount,
                      holderName: movement.destinationAccount.holderMember?.user.name,
                    });
                    return (
                      <li key={`transfer-${movement.id}`} className="flex items-center gap-3 px-5 py-4 sm:px-6">
                        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-700">
                          <ArrowRightLeft className="size-4" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-bold text-ink">{movement.description || "Transferência entre contas"}</p>
                          <p className="mt-0.5 truncate text-xs text-muted">
                            {sourceLabel} → {destinationLabel} · {formatCivilDate(movement.occurredOn)}
                          </p>
                        </div>
                        <p className="shrink-0 text-sm font-extrabold text-blue-800">
                          {formatCents(decimalToCents(movement.amount))}
                        </p>
                      </li>
                    );
                  }

                  const income = movement.type === "INCOME";
                  return (
                    <li key={`transaction-${movement.id}`} className="flex items-center gap-3 px-5 py-4 sm:px-6">
                      <span className={`grid size-9 shrink-0 place-items-center rounded-xl ${income ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"}`}>
                        {income ? <ArrowUpRight className="size-4" /> : <ArrowDownRight className="size-4" />}
                      </span>
                      <div className="min-w-0 flex-1"><p className="truncate text-sm font-bold text-ink">{movement.description}</p><p className="mt-0.5 truncate text-xs text-muted">{movement.category.name} · {formatCivilDate(movement.occurredOn)}</p></div>
                      <p className={`shrink-0 text-sm font-extrabold ${income ? "text-emerald-700" : "text-ink"}`}>{income ? "+" : "−"} {formatCents(decimalToCents(movement.amount))}</p>
                    </li>
                  );
                })}
              </ul>
            )}
          </article>
          <aside className="rounded-[20px] border border-line bg-white p-6 shadow-card">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-brand-700">Atalhos</p>
            <h2 className="mt-2 text-lg font-bold text-ink">Organize o essencial</h2>
            <div className="mt-5 space-y-2">
              <Link href="/app/contas" className="flex items-center justify-between rounded-xl bg-canvas px-4 py-3 text-sm font-bold text-ink hover:bg-brand-100">Gerenciar contas <ArrowRight className="size-4 text-muted" /></Link>
              <Link href="/app/categorias" className="flex items-center justify-between rounded-xl bg-canvas px-4 py-3 text-sm font-bold text-ink hover:bg-brand-100">Gerenciar categorias <ArrowRight className="size-4 text-muted" /></Link>
              <Link href="/app/transferencias/nova" className="flex items-center justify-between rounded-xl bg-canvas px-4 py-3 text-sm font-bold text-ink hover:bg-brand-100">Transferir entre contas <ArrowRight className="size-4 text-muted" /></Link>
            </div>
          </aside>
        </section>
      )}
    </div>
  );
}
