"use client";

import {
  CreditCard,
  FolderTree,
  Home,
  Plus,
  ReceiptText,
  Repeat2,
  Settings,
  UserRound,
  WalletCards,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/app", label: "Visão geral", mobileLabel: "Início", icon: Home },
  { href: "/app/movimentacoes", label: "Movimentações", mobileLabel: "Movimentos", icon: ReceiptText },
  { href: "/app/recorrencias", label: "Recorrências", mobileLabel: "Recorrentes", icon: Repeat2 },
  { href: "/app/cartoes", label: "Cartões", mobileLabel: "Cartões", icon: CreditCard },
  { href: "/app/contas", label: "Contas", mobileLabel: "Contas", icon: WalletCards },
  { href: "/app/categorias", label: "Categorias", mobileLabel: "Categorias", icon: FolderTree },
  { href: "/app/configuracoes", label: "Configurações", mobileLabel: "Ajustes", icon: Settings },
  { href: "/app/perfil", label: "Meu perfil", mobileLabel: "Perfil", icon: UserRound },
];

export function NavLinks({ mobile = false }: { mobile?: boolean }) {
  const pathname = usePathname();

  if (mobile) {
    const mobileItems = [
      navItems[0]!,
      navItems[1]!,
      { href: "/app/movimentacoes/nova", label: "Adicionar", mobileLabel: "Adicionar", icon: Plus },
      navItems[2]!,
      navItems[3]!,
      navItems[6]!,
    ];

    return (
      <ul className="mx-auto grid max-w-lg grid-cols-6">
        {mobileItems.map(({ href, mobileLabel, icon: Icon }) => {
          const isAdd = href === "/app/movimentacoes/nova";
          const active = isAdd
            ? pathname === href
            : href === "/app"
              ? pathname === href
              : href === "/app/movimentacoes"
                ? pathname.startsWith(href) && pathname !== "/app/movimentacoes/nova"
                : pathname.startsWith(href);

          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-16 flex-col items-center justify-center gap-1 text-[10px] font-bold ${
                  active || isAdd ? "text-brand-700" : "text-muted"
                }`}
              >
                <span className={isAdd ? "grid size-9 place-items-center rounded-full bg-brand-600 text-white shadow-sm" : ""}>
                  <Icon className="size-5" aria-hidden="true" />
                </span>
                {mobileLabel}
              </Link>
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <ul className="mt-2 space-y-1">
      {navItems.map(({ href, label, icon: Icon }) => {
        const active = href === "/app" ? pathname === href : pathname.startsWith(href);

        return (
          <li key={href}>
            <Link
              href={href}
              aria-current={active ? "page" : undefined}
              className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold ${
                active
                  ? "bg-brand-100 text-brand-800"
                  : "text-[#616a63] hover:bg-canvas hover:text-ink"
              }`}
            >
              <Icon className="size-[18px]" aria-hidden="true" />
              {label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
