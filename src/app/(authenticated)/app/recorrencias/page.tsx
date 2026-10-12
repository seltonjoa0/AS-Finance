import type { Metadata } from "next";
import {
  ArrowDownRight,
  ArrowUpRight,
  CalendarClock,
  CircleAlert,
  Plus,
  Repeat2,
} from "lucide-react";
import Link from "next/link";

import {
  MaterializeRecurringRulesButton,
  RecurringRuleControls,
} from "@/components/finance/recurring-rule-controls";
import { RecurringRuleForm } from "@/components/finance/recurring-rule-form";
import { formatCivilDate, todayInTimezone } from "@/features/finance/dates";
import { decimalToCents, formatCents } from "@/features/finance/money";
import {
  getFinanceCatalog,
  getRecurringRules,
} from "@/features/finance/queries";
import { requireFinancialContext } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Recorrências" };

const ruleStatus = {
  ACTIVE: {
    label: "Ativa",
    className: "bg-brand-100 text-brand-800",
  },
  PAUSED: {
    label: "Pausada",
    className: "bg-amber-50 text-amber-800",
  },
  ENDED: {
    label: "Encerrada",
    className: "bg-canvas text-muted",
  },
} as const;

const splitMethodLabels = {
  INDIVIDUAL: "Responsabilidade individual",
  EQUAL: "Divisão igual",
  PERCENTAGE: "Divisão percentual",
  CUSTOM: "Divisão personalizada",
  INCOME_BASED: "Proporcional à renda",
} as const;

function dateFromCivilDate(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

export default async function RecurringRulesPage() {
  const context = await requireFinancialContext();
  const [rules, catalog] = await Promise.all([
    getRecurringRules(context.space.id),
    getFinanceCatalog(context.space.id),
  ]);
  const members = catalog.members.filter((member) => member.revokedAt === null);
  const hasExpense = catalog.categories.some(
    (category) => category.type === "EXPENSE",
  );
  const hasIncome = catalog.categories.some(
    (category) => category.type === "INCOME",
  );
  const ready =
    catalog.accounts.length > 0 &&
    members.length > 0 &&
    (hasExpense || hasIncome);
  const memberNames = new Map(
    catalog.members.map((member) => [member.id, member.name]),
  );

  return (
    <div>
      <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-brand-700">
            Planejamento mensal
          </p>
          <h1 className="mt-1 text-3xl font-bold tracking-[-0.045em] text-ink">
            Recorrências
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted sm:text-base">
            Organize receitas e despesas que se repetem. As ocorrências entram
            como previsões pendentes até você confirmá-las.
          </p>
        </div>
        <div className="grid gap-2 min-[420px]:grid-cols-2 sm:flex sm:items-start">
          <MaterializeRecurringRulesButton />
          <Link
            href="#nova-recorrencia"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 text-sm font-bold text-white hover:bg-brand-700"
          >
            <Plus className="size-4" aria-hidden="true" />
            Nova recorrência
          </Link>
        </div>
      </header>

      <section
        className="mt-6 rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm leading-6 text-blue-900"
        aria-label="Como funcionam as previsões"
      >
        <div className="flex gap-3">
          <CalendarClock
            className="mt-0.5 size-5 shrink-0"
            aria-hidden="true"
          />
          <p>
            Use <strong>Atualizar previsões</strong> para completar o calendário
            financeiro. O processamento é idempotente: executar novamente não
            duplica ocorrências já criadas.
          </p>
        </div>
      </section>

      <div className="mt-7 grid gap-6 xl:grid-cols-[minmax(0,1fr)_440px] xl:items-start">
        <section aria-labelledby="recurring-rules-title">
          <div className="flex items-center justify-between gap-3">
            <h2 id="recurring-rules-title" className="font-bold text-ink">
              Regras cadastradas
            </h2>
            <span className="shrink-0 rounded-full bg-white px-3 py-1 text-xs font-bold text-muted shadow-sm">
              {rules.length} {rules.length === 1 ? "regra" : "regras"}
            </span>
          </div>

          {rules.length === 0 ? (
            <div className="mt-4 rounded-[20px] border border-dashed border-brand-200 bg-white px-6 py-12 text-center shadow-card">
              <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-brand-100 text-brand-700">
                <Repeat2 className="size-7" aria-hidden="true" />
              </span>
              <h3 className="mt-4 font-bold text-ink">
                Nenhuma recorrência cadastrada
              </h3>
              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted">
                Comece pelo salário, aluguel ou outra movimentação que se repete
                todos os meses.
              </p>
              <Link
                href="#nova-recorrencia"
                className="mt-5 inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 text-sm font-bold text-white hover:bg-brand-700"
              >
                <Plus className="size-4" aria-hidden="true" />
                Criar primeira recorrência
              </Link>
            </div>
          ) : (
            <ul className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
              {rules.map((rule) => {
                const income = rule.type === "INCOME";
                const status = ruleStatus[rule.status];
                const responsibilityNames = rule.splits
                  .map((split) => memberNames.get(split.memberId))
                  .filter((name): name is string => Boolean(name));

                return (
                  <li
                    key={rule.id}
                    className="min-w-0 rounded-[20px] border border-line bg-white p-5 shadow-card"
                  >
                    <div className="flex items-start gap-3">
                      <span
                        className={`grid size-10 shrink-0 place-items-center rounded-2xl ${
                          income
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-red-50 text-red-600"
                        }`}
                      >
                        {income ? (
                          <ArrowUpRight className="size-5" aria-hidden="true" />
                        ) : (
                          <ArrowDownRight
                            className="size-5"
                            aria-hidden="true"
                          />
                        )}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="min-w-0 truncate text-sm font-bold text-ink">
                            {rule.description}
                          </h3>
                          <span
                            className={`rounded-full px-2.5 py-1 text-[10px] font-extrabold ${status.className}`}
                          >
                            {status.label}
                          </span>
                        </div>
                        <p
                          className={`mt-2 text-xl font-extrabold tracking-[-0.03em] ${
                            income ? "text-emerald-700" : "text-ink"
                          }`}
                        >
                          {income ? "+" : "−"}{" "}
                          {formatCents(
                            decimalToCents(rule.amount),
                            context.space.currency,
                          )}
                        </p>
                      </div>
                    </div>

                    <dl className="mt-4 grid gap-3 rounded-2xl bg-canvas p-4 text-xs">
                      <div className="flex items-start justify-between gap-3">
                        <dt className="text-muted">Conta</dt>
                        <dd className="max-w-[65%] text-right font-bold text-ink">
                          {rule.account.name}
                        </dd>
                      </div>
                      <div className="flex items-start justify-between gap-3">
                        <dt className="text-muted">Categoria</dt>
                        <dd className="max-w-[65%] text-right font-bold text-ink">
                          {rule.category.name}
                        </dd>
                      </div>
                      <div className="flex items-start justify-between gap-3">
                        <dt className="text-muted">Divisão</dt>
                        <dd className="max-w-[65%] text-right font-bold text-ink">
                          {splitMethodLabels[rule.splitMethod]}
                        </dd>
                      </div>
                      {!income && rule.payerMember && (
                        <div className="flex items-start justify-between gap-3">
                          <dt className="text-muted">Pagador previsto</dt>
                          <dd className="max-w-[65%] text-right font-bold text-ink">
                            {rule.payerMember.user.name}
                          </dd>
                        </div>
                      )}
                      {responsibilityNames.length > 0 && (
                        <div className="flex items-start justify-between gap-3">
                          <dt className="text-muted">Responsáveis</dt>
                          <dd className="max-w-[65%] text-right font-bold text-ink">
                            {responsibilityNames.join(", ")}
                          </dd>
                        </div>
                      )}
                      <div className="flex items-start justify-between gap-3">
                        <dt className="text-muted">Próxima ocorrência</dt>
                        <dd className="max-w-[65%] text-right font-bold text-ink">
                          {rule.nextOccurrenceDate
                            ? formatCivilDate(
                                dateFromCivilDate(rule.nextOccurrenceDate),
                              )
                            : rule.status === "ENDED"
                              ? "Recorrência encerrada"
                              : "Sem ocorrência futura"}
                        </dd>
                      </div>
                      <div className="flex items-start justify-between gap-3">
                        <dt className="text-muted">Período</dt>
                        <dd className="max-w-[65%] text-right font-bold text-ink">
                          Desde {formatCivilDate(dateFromCivilDate(rule.startDate))}
                          {rule.endDate
                            ? ` até ${formatCivilDate(dateFromCivilDate(rule.endDate))}`
                            : ", sem data final"}
                        </dd>
                      </div>
                    </dl>

                    {rule.status === "PAUSED" && (
                      <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs font-semibold leading-5 text-amber-800">
                        Pausada: previsões futuras ficam suspensas até a retomada.
                      </p>
                    )}

                    <RecurringRuleControls
                      ruleId={rule.id}
                      status={rule.status}
                      description={rule.description}
                    />
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <aside
          id="nova-recorrencia"
          className="scroll-mt-24 rounded-[20px] border border-line bg-white p-5 shadow-card sm:p-6 xl:sticky xl:top-8"
          aria-labelledby="new-recurring-rule-title"
        >
          <h2 id="new-recurring-rule-title" className="font-bold text-ink">
            Nova recorrência mensal
          </h2>
          <p className="mt-1 text-sm leading-6 text-muted">
            Defina uma vez e gere previsões mensais sem perder o controle de
            quando o dinheiro realmente entrou ou saiu.
          </p>

          {!ready ? (
            <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-900">
              <div className="flex gap-3">
                <CircleAlert
                  className="mt-0.5 size-5 shrink-0"
                  aria-hidden="true"
                />
                <div>
                  <h3 className="text-sm font-bold">Complete o cadastro básico</h3>
                  <p className="mt-1 text-xs leading-5">
                    É necessário ter ao menos uma conta, uma categoria e um
                    membro ativo para criar recorrências.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {catalog.accounts.length === 0 && (
                      <Link
                        href="/app/contas"
                        className="inline-flex min-h-11 items-center rounded-xl bg-white px-4 text-xs font-bold text-amber-900 shadow-sm"
                      >
                        Criar conta
                      </Link>
                    )}
                    {!hasExpense && !hasIncome && (
                      <Link
                        href="/app/categorias"
                        className="inline-flex min-h-11 items-center rounded-xl bg-white px-4 text-xs font-bold text-amber-900 shadow-sm"
                      >
                        Criar categoria
                      </Link>
                    )}
                    {members.length === 0 && (
                      <Link
                        href="/app/configuracoes"
                        className="inline-flex min-h-11 items-center rounded-xl bg-white px-4 text-xs font-bold text-amber-900 shadow-sm"
                      >
                        Ver membros
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-6">
              <RecurringRuleForm
                accounts={catalog.accounts}
                categories={catalog.categories}
                members={members}
                today={todayInTimezone(context.space.timezone)}
                initialType={hasExpense ? "EXPENSE" : "INCOME"}
              />
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
