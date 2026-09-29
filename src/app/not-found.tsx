import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center bg-canvas px-5">
      <section className="text-center">
        <p className="text-sm font-bold text-brand-700">Erro 404</p>
        <h1 className="mt-2 text-3xl font-bold tracking-[-0.04em] text-ink">
          Página não encontrada
        </h1>
        <p className="mt-3 text-sm text-muted">O endereço pode ter mudado ou não existir.</p>
        <Link
          href="/"
          className="mt-6 inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-brand-600 px-5 text-sm font-bold text-white hover:bg-brand-700"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Voltar ao início
        </Link>
      </section>
    </main>
  );
}
