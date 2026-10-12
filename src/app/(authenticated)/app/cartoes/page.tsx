import type { Metadata } from "next";
import {
  CalendarDays,
  CircleAlert,
  CreditCard,
  Gauge,
  Plus,
  ReceiptText,
  ShieldCheck,
  ShoppingCart,
  UserRound,
  WalletCards,
} from "lucide-react";
import Link from "next/link";

import { CreditCardForm } from "@/components/finance/credit-card-form";
import { CreditCardInvoiceControls } from "@/components/finance/credit-card-invoice-controls";
import { CreditCardPurchaseForm } from "@/components/finance/credit-card-purchase-form";
import { formatCivilDate } from "@/features/finance/dates";
import { decimalToCents, formatCents } from "@/features/finance/money";
import { getCreditCardDashboard } from "@/features/finance/queries";
import { requireFinancialContext } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Cartões" };

const invoiceStatus = {
  OPEN: {
    label: "Aberta",
    className: "bg-blue-50 text-blue-800",
  },
  CLOSED: {
    label: "Fechada",
    className: "bg-amber-50 text-amber-800",
  },
  PAID: {
    label: "Paga",
    className: "bg-brand-100 text-brand-800",
  },
} as const;

function civilDate(value: string) {
  return new Date(value + "T00:00:00.000Z");
}

function limitProgress(usedCents: bigint, limitCents: bigint) {
  if (limitCents <= 0n) return usedCents > 0n ? 100 : 0;
  return Math.min(100, Number((usedCents * 10_000n) / limitCents) / 100);
}

export default async function CreditCardsPage() {
  const context = await requireFinancialContext();
  const dashboard = await getCreditCardDashboard(
    context.space.id,
    context.space.timezone,
    context.space.currency,
  );
  const totalLimitCents = dashboard.cards.reduce(
    (total, card) => total + decimalToCents(card.creditLimit),
    0n,
  );
  const totalUsedCents = dashboard.cards.reduce(
    (total, card) => total + card.usedCents,
    0n,
  );
  const totalAvailableCents = dashboard.cards.reduce(
    (total, card) => total + card.availableCents,
    0n,
  );
  const activeMembers = dashboard.members.filter(
    (member) => member.revokedAt === null,
  );
  const paymentAccounts = dashboard.paymentAccounts.map((account) => ({
    id: account.id,
    label:
      account.ownership === "INDIVIDUAL" && account.holderMember
        ? account.name + " · " + account.holderMember.user.name
        : account.name,
  }));

  return (
    <div>
      <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-brand-700">
            Crédito sob controle
          </p>
          <h1 className="mt-1 text-3xl font-bold tracking-[-0.045em] text-ink">
            Cartões e faturas
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted sm:text-base">
            Acompanhe o limite, registre compras no ciclo correto e pague cada
            fatura sem duplicar suas despesas.
          </p>
        </div>
        <div className="grid gap-2 min-[420px]:grid-cols-2 sm:flex">
          {dashboard.cards.length > 0 && (
            <Link
              href="#nova-compra"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-brand-200 bg-white px-4 text-sm font-bold text-brand-800 hover:bg-brand-50"
            >
              <ShoppingCart className="size-4" aria-hidden="true" />
              Registrar compra
            </Link>
          )}
          <Link
            href="#novo-cartao"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 text-sm font-bold text-white hover:bg-brand-700"
          >
            <Plus className="size-4" aria-hidden="true" />
            Novo cartão
          </Link>
        </div>
      </header>

      <section
        className="mt-6 rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm leading-6 text-blue-900"
        aria-label="Como o pagamento de faturas funciona"
      >
        <div className="flex gap-3">
          <ShieldCheck
            className="mt-0.5 size-5 shrink-0"
            aria-hidden="true"
          />
          <p>
            As compras já entram como despesas. Ao pagar a fatura, o sistema
            registra somente a transferência da sua conta para o cartão.
          </p>
        </div>
      </section>

      {dashboard.cards.length > 0 && (
        <section
          className="mt-6 grid gap-3 sm:grid-cols-3"
          aria-label="Resumo dos limites"
        >
          <article className="rounded-[20px] border border-line bg-white p-4 shadow-card sm:p-5">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-muted">
              <WalletCards className="size-4" aria-hidden="true" />
              Limite total
            </div>
            <p className="mt-3 text-xl font-extrabold tracking-[-0.03em] text-ink">
              {formatCents(totalLimitCents, dashboard.currency)}
            </p>
          </article>
          <article className="rounded-[20px] border border-line bg-white p-4 shadow-card sm:p-5">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-muted">
              <Gauge className="size-4" aria-hidden="true" />
              Limite utilizado
            </div>
            <p className="mt-3 text-xl font-extrabold tracking-[-0.03em] text-ink">
              {formatCents(totalUsedCents, dashboard.currency)}
            </p>
          </article>
          <article className="rounded-[20px] border border-brand-100 bg-brand-50 p-4 shadow-card sm:p-5">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-brand-700">
              <ShieldCheck className="size-4" aria-hidden="true" />
              Disponível
            </div>
            <p className="mt-3 text-xl font-extrabold tracking-[-0.03em] text-brand-900">
              {formatCents(totalAvailableCents, dashboard.currency)}
            </p>
          </article>
        </section>
      )}

      <section className="mt-8" aria-labelledby="cards-list-title">
        <div className="flex items-center justify-between gap-4">
          <h2 id="cards-list-title" className="font-bold text-ink">
            Seus cartões
          </h2>
          <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-muted shadow-sm">
            {dashboard.cards.length}{" "}
            {dashboard.cards.length === 1 ? "cartão" : "cartões"}
          </span>
        </div>

        {dashboard.cards.length === 0 ? (
          <div className="mt-4 rounded-[20px] border border-dashed border-brand-200 bg-white p-8 text-center shadow-card">
            <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-brand-100 text-brand-700">
              <CreditCard className="size-7" aria-hidden="true" />
            </span>
            <h3 className="mt-4 font-bold text-ink">
              Nenhum cartão cadastrado
            </h3>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted">
              Cadastre seu primeiro cartão para organizar compras, limites e
              faturas em um só lugar.
            </p>
            <Link
              href="#novo-cartao"
              className="mt-5 inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 text-sm font-bold text-white hover:bg-brand-700"
            >
              <Plus className="size-4" aria-hidden="true" />
              Cadastrar cartão
            </Link>
          </div>
        ) : (
          <ul className="mt-4 grid gap-5 xl:grid-cols-2 xl:items-start">
            {dashboard.cards.map((card) => {
              const limitCents = decimalToCents(card.creditLimit);
              const progress = limitProgress(card.usedCents, limitCents);

              return (
                <li
                  key={card.id}
                  className="overflow-hidden rounded-[22px] border border-line bg-white shadow-card"
                >
                  <div className="bg-gradient-to-br from-brand-900 to-brand-700 p-5 text-white sm:p-6">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="text-xs font-bold uppercase tracking-[0.14em] text-white/65">
                          {card.bank}
                        </p>
                        <h3 className="mt-1 truncate text-xl font-extrabold">
                          {card.name}
                        </h3>
                      </div>
                      <CreditCard
                        className="size-7 shrink-0 text-white/75"
                        aria-hidden="true"
                      />
                    </div>

                    <div className="mt-6 grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wide text-white/60">
                          Usado
                        </p>
                        <p className="mt-1 text-base font-extrabold">
                          {formatCents(card.usedCents, dashboard.currency)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] font-bold uppercase tracking-wide text-white/60">
                          Disponível
                        </p>
                        <p className="mt-1 text-base font-extrabold">
                          {formatCents(card.availableCents, dashboard.currency)}
                        </p>
                      </div>
                    </div>

                    <div
                      className="mt-4 h-2 overflow-hidden rounded-full bg-white/20"
                      aria-label={
                        String(Math.round(progress)) +
                        "% do limite do cartão utilizado"
                      }
                    >
                      <div
                        className={
                          "h-full rounded-full " +
                          (card.overLimitCents > 0n
                            ? "bg-red-300"
                            : progress >= 80
                              ? "bg-amber-300"
                              : "bg-white")
                        }
                        style={{ width: String(progress) + "%" }}
                      />
                    </div>
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-white/75">
                      <span>
                        Limite {formatCents(limitCents, dashboard.currency)}
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <UserRound className="size-3.5" aria-hidden="true" />
                        {card.holder.name}
                      </span>
                    </div>
                    {card.overLimitCents > 0n && (
                      <div className="mt-4 flex gap-2 rounded-xl bg-red-950/35 px-3 py-2 text-xs font-bold text-red-50">
                        <CircleAlert
                          className="size-4 shrink-0"
                          aria-hidden="true"
                        />
                        Limite excedido em{" "}
                        {formatCents(card.overLimitCents, dashboard.currency)}
                      </div>
                    )}
                  </div>

                  <div className="p-5 sm:p-6">
                    <div className="flex items-center justify-between gap-3">
                      <h4 className="flex items-center gap-2 text-sm font-bold text-ink">
                        <ReceiptText className="size-4" aria-hidden="true" />
                        Faturas
                      </h4>
                      <span className="text-xs text-muted">
                        Fecha dia {card.closingDay} · vence dia {card.dueDay}
                      </span>
                    </div>

                    {card.invoices.length === 0 ? (
                      <div className="mt-4 rounded-2xl bg-canvas px-4 py-5 text-center text-sm text-muted">
                        As faturas aparecerão após a primeira compra.
                      </div>
                    ) : (
                      <ul className="mt-4 space-y-3">
                        {card.invoices.map((invoice) => {
                          const status = invoiceStatus[invoice.status];
                          return (
                            <li
                              key={invoice.id}
                              className="rounded-2xl border border-line bg-[#fbfcfb] p-4"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <p className="text-xs font-semibold text-muted">
                                    Vencimento
                                  </p>
                                  <p className="mt-1 font-bold text-ink">
                                    {formatCivilDate(
                                      civilDate(invoice.dueDate),
                                    )}
                                  </p>
                                </div>
                                <span
                                  className={
                                    "rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide " +
                                    status.className
                                  }
                                >
                                  {status.label}
                                </span>
                              </div>
                              <div className="mt-4 flex items-end justify-between gap-3">
                                <div>
                                  <p className="text-lg font-extrabold tracking-[-0.025em] text-ink">
                                    {formatCents(
                                      invoice.totalCents,
                                      dashboard.currency,
                                    )}
                                  </p>
                                  <p className="mt-1 text-xs text-muted">
                                    {invoice.purchaseCount}{" "}
                                    {invoice.purchaseCount === 1
                                      ? "compra"
                                      : "compras"}
                                  </p>
                                </div>
                                <div className="text-right text-[11px] leading-5 text-muted">
                                  <p className="inline-flex items-center gap-1">
                                    <CalendarDays
                                      className="size-3"
                                      aria-hidden="true"
                                    />
                                    Fecha{" "}
                                    {formatCivilDate(
                                      civilDate(invoice.closingDate),
                                    )}
                                  </p>
                                  {invoice.paidAt && (
                                    <p>
                                      Paga em{" "}
                                      {new Intl.DateTimeFormat("pt-BR", {
                                        dateStyle: "short",
                                        timeZone: context.space.timezone,
                                      }).format(invoice.paidAt)}
                                    </p>
                                  )}
                                </div>
                              </div>
                              {invoice.purchases.length > 0 && (
                                <details className="group mt-4 rounded-xl border border-line bg-white">
                                  <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-3 text-xs font-bold text-ink marker:hidden">
                                    <span>
                                      Ver {invoice.purchases.length}{" "}
                                      {invoice.purchases.length === 1
                                        ? "compra"
                                        : "compras"}
                                    </span>
                                    <span
                                      className="text-brand-700 transition group-open:rotate-45"
                                      aria-hidden="true"
                                    >
                                      +
                                    </span>
                                  </summary>
                                  <ul className="space-y-1 border-t border-line p-2">
                                    {invoice.purchases.map((purchase) => (
                                      <li
                                        key={purchase.id}
                                        className="rounded-lg px-2 py-2.5 hover:bg-canvas"
                                      >
                                        <div className="flex items-start justify-between gap-3">
                                          <div className="min-w-0">
                                            <p className="truncate text-xs font-bold text-ink">
                                              {purchase.description}
                                            </p>
                                            <p className="mt-1 text-[11px] leading-4 text-muted">
                                              {purchase.categoryName} ·{" "}
                                              {formatCivilDate(
                                                civilDate(
                                                  purchase.purchaseDate,
                                                ),
                                              )}
                                            </p>
                                            {purchase.payerName && (
                                              <p className="mt-0.5 text-[11px] text-muted">
                                                Compra de {purchase.payerName}
                                              </p>
                                            )}
                                          </div>
                                          <span className="shrink-0 text-xs font-extrabold text-ink">
                                            {formatCents(
                                              purchase.amountCents,
                                              dashboard.currency,
                                            )}
                                          </span>
                                        </div>
                                      </li>
                                    ))}
                                  </ul>
                                </details>
                              )}
                              <CreditCardInvoiceControls
                                invoiceId={invoice.id}
                                status={invoice.status}
                                cardName={card.name}
                                closingDate={invoice.closingDate}
                                paymentAccounts={paymentAccounts}
                                today={dashboard.today}
                              />
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <div className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(340px,0.65fr)] xl:items-start">
        {dashboard.cards.length > 0 && (
          <section
            id="nova-compra"
            className="scroll-mt-24 rounded-[22px] border border-line bg-white p-5 shadow-card sm:p-7"
            aria-labelledby="new-purchase-title"
          >
            <div className="flex items-start gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-brand-100 text-brand-700">
                <ShoppingCart className="size-5" aria-hidden="true" />
              </span>
              <div>
                <h2 id="new-purchase-title" className="font-bold text-ink">
                  Registrar compra
                </h2>
                <p className="mt-1 text-sm leading-6 text-muted">
                  A data define automaticamente a fatura e o vencimento.
                </p>
              </div>
            </div>
            <div className="mt-6">
              <CreditCardPurchaseForm
                cards={dashboard.cards.map((card) => ({
                  id: card.id,
                  name: card.name,
                  bank: card.bank,
                }))}
                categories={dashboard.categories}
                members={dashboard.members}
                incomeHistory={dashboard.incomeHistory}
                today={dashboard.today}
              />
            </div>
          </section>
        )}

        <section
          id="novo-cartao"
          className="scroll-mt-24 rounded-[22px] border border-line bg-white p-5 shadow-card sm:p-7 xl:sticky xl:top-8"
          aria-labelledby="new-card-title"
        >
          <div className="flex items-start gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-brand-100 text-brand-700">
              <CreditCard className="size-5" aria-hidden="true" />
            </span>
            <div>
              <h2 id="new-card-title" className="font-bold text-ink">
                Novo cartão
              </h2>
              <p className="mt-1 text-sm leading-6 text-muted">
                Informe o limite e as datas do ciclo mensal.
              </p>
            </div>
          </div>
          <div className="mt-6">
            <CreditCardForm members={activeMembers} />
          </div>
        </section>
      </div>
    </div>
  );
}
