"use client";

import { AlertTriangle, RefreshCw } from "lucide-react";

export default function GlobalError({ reset }: { reset: () => void }) {
  return (
    <main className="grid min-h-dvh place-items-center bg-canvas px-5">
      <section className="w-full max-w-md rounded-[22px] border border-line bg-white p-7 text-center shadow-card">
        <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-amber-50 text-amber-700">
          <AlertTriangle className="size-6" aria-hidden="true" />
        </span>
        <h1 className="mt-5 text-xl font-bold tracking-[-0.03em] text-ink">
          Algo não saiu como esperado
        </h1>
        <p className="mt-2 text-sm leading-6 text-muted">
          Não foi possível carregar esta página. Seus dados não foram alterados.
        </p>
        <button
          type="button"
          onClick={reset}
          className="mt-6 inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-brand-600 px-5 text-sm font-bold text-white hover:bg-brand-700"
        >
          <RefreshCw className="size-4" aria-hidden="true" />
          Tentar novamente
        </button>
      </section>
    </main>
  );
}
