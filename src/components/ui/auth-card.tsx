import Link from "next/link";
import type { ReactNode } from "react";

import { Logo } from "@/components/ui/logo";

type AuthCardProps = {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
  footer: { text: string; href: string; label: string };
};

export function AuthCard({
  eyebrow,
  title,
  description,
  children,
  footer,
}: AuthCardProps) {
  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden px-5 py-10 sm:px-8">
      <div
        className="pointer-events-none absolute -left-28 -top-28 size-80 rounded-full bg-brand-200/40 blur-3xl"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -bottom-40 -right-28 size-96 rounded-full bg-[#dfeafb]/50 blur-3xl"
        aria-hidden="true"
      />
      <div className="relative w-full max-w-[440px]">
        <div className="mb-7 flex justify-center">
          <Link href="/" aria-label="Voltar ao início">
            <Logo />
          </Link>
        </div>
        <section className="rounded-[24px] border border-white/80 bg-white p-6 shadow-card sm:p-8">
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-brand-700">
            {eyebrow}
          </p>
          <h1 className="text-2xl font-bold tracking-[-0.04em] text-ink sm:text-[1.8rem]">
            {title}
          </h1>
          <p className="mt-2 mb-7 text-sm leading-6 text-muted">{description}</p>
          {children}
        </section>
        <p className="mt-6 text-center text-sm text-muted">
          {footer.text}{" "}
          <Link
            href={footer.href}
            className="font-bold text-brand-700 hover:text-brand-800"
          >
            {footer.label}
          </Link>
        </p>
      </div>
    </main>
  );
}
