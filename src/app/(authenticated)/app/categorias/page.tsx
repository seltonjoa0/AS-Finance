import type { Metadata } from "next";
import { ArrowDownRight, ArrowUpRight, Tags } from "lucide-react";

import { CategoryForm } from "@/components/finance/category-form";
import { requireFinancialContext } from "@/lib/auth/session";
import { database } from "@/lib/db/client";

export const metadata: Metadata = { title: "Categorias" };

export default async function CategoriesPage() {
  const context = await requireFinancialContext();
  const categories = await database().category.findMany({
    where: { financialSpaceId: context.space.id, deletedAt: null },
    orderBy: [{ type: "asc" }, { name: "asc" }],
  });
  const expenses = categories.filter((category) => category.type === "EXPENSE");
  const incomes = categories.filter((category) => category.type === "INCOME");

  return (
    <div>
      <header>
        <p className="text-sm font-semibold text-brand-700">Organização</p>
        <h1 className="mt-1 text-3xl font-bold tracking-[-0.045em] text-ink">Categorias</h1>
        <p className="mt-2 text-sm leading-6 text-muted sm:text-base">
          Crie a classificação usada nas receitas e despesas do espaço.
        </p>
      </header>

      <div className="mt-7 grid gap-5 xl:grid-cols-[1fr_380px] xl:items-start">
        <section className="grid gap-5 md:grid-cols-2">
          {[
            { title: "Despesas", items: expenses, icon: ArrowDownRight, tone: "bg-red-50 text-red-600" },
            { title: "Receitas", items: incomes, icon: ArrowUpRight, tone: "bg-emerald-50 text-emerald-700" },
          ].map(({ title, items, icon: Icon, tone }) => (
            <article key={title} className="rounded-[20px] border border-line bg-white p-5 shadow-card sm:p-6">
              <div className="flex items-center justify-between border-b border-line pb-4">
                <div className="flex items-center gap-3">
                  <span className={`grid size-9 place-items-center rounded-xl ${tone}`}><Icon className="size-4" /></span>
                  <h2 className="font-bold text-ink">{title}</h2>
                </div>
                <span className="text-xs font-bold text-muted">{items.length}</span>
              </div>
              {items.length === 0 ? (
                <div className="py-8 text-center">
                  <Tags className="mx-auto size-6 text-[#b5beb7]" />
                  <p className="mt-2 text-sm text-muted">Nenhuma categoria.</p>
                </div>
              ) : (
                <ul className="divide-y divide-line">
                  {items.map((category) => (
                    <li key={category.id} className="flex items-center gap-3 py-3 text-sm font-semibold text-ink">
                      <span className="size-2 rounded-full bg-brand-400" />
                      {category.name}
                    </li>
                  ))}
                </ul>
              )}
            </article>
          ))}
        </section>

        <aside className="rounded-[20px] border border-line bg-white p-5 shadow-card sm:p-6 xl:sticky xl:top-8">
          <h2 className="font-bold text-ink">Nova categoria</h2>
          <p className="mt-1 text-sm leading-6 text-muted">Use nomes curtos e claros para facilitar os próximos relatórios.</p>
          <div className="mt-6"><CategoryForm /></div>
        </aside>
      </div>
    </div>
  );
}
