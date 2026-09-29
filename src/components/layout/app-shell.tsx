import { LogOut } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { Logo } from "@/components/ui/logo";
import { NavLinks } from "@/components/layout/nav-links";
import { SpaceSwitcher } from "@/components/layout/space-switcher";
import { logoutAction } from "@/features/auth/actions";

type AppShellProps = {
  children: ReactNode;
  user: { name: string; email: string };
  space: { id: string; name: string };
  spaces: Array<{ id: string; name: string }>;
};

function Avatar({ name }: { name: string }) {
  const initials = name
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  return (
    <span className="grid size-10 shrink-0 place-items-center rounded-full bg-brand-100 text-xs font-extrabold text-brand-800">
      {initials}
    </span>
  );
}

export function AppShell({ children, user, space, spaces }: AppShellProps) {
  return (
    <div className="min-h-dvh bg-canvas lg:grid lg:grid-cols-[268px_1fr]">
      <aside className="sticky top-0 hidden h-dvh flex-col border-r border-line bg-white px-5 py-6 lg:flex">
        <div className="px-2">
          <Logo />
        </div>

        <div className="mt-8 rounded-2xl border border-line bg-canvas p-3.5">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted">
            Espaço atual
          </p>
          <div className="mt-2">
            <SpaceSwitcher currentId={space.id} spaces={spaces} />
          </div>
        </div>

        <nav className="mt-7 flex-1" aria-label="Navegação principal">
          <p className="px-3 text-[10px] font-bold uppercase tracking-[0.14em] text-[#a1a8a3]">
            Menu
          </p>
          <NavLinks />
        </nav>

        <div className="border-t border-line pt-5">
          <div className="flex items-center gap-3 px-1">
            <Avatar name={user.name} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-ink">{user.name}</p>
              <p className="truncate text-xs text-muted">{user.email}</p>
            </div>
            <form action={logoutAction}>
              <button
                type="submit"
                className="grid size-9 place-items-center rounded-xl text-muted hover:bg-red-50 hover:text-red-600"
                aria-label="Sair da conta"
                title="Sair"
              >
                <LogOut className="size-4" aria-hidden="true" />
              </button>
            </form>
          </div>
        </div>
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-line/80 bg-canvas/90 px-5 backdrop-blur-xl sm:px-8 lg:hidden">
          <Logo compact />
          <div className="min-w-0 flex-1 px-4 text-center">
            <SpaceSwitcher currentId={space.id} spaces={spaces} compact />
          </div>
          <Link href="/app/perfil" aria-label="Abrir perfil">
            <Avatar name={user.name} />
          </Link>
        </header>

        <main className="mx-auto w-full max-w-[1240px] px-5 pt-7 pb-28 sm:px-8 sm:pt-9 lg:px-10 lg:py-10 xl:px-12">
          {children}
        </main>

        <nav
          className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white/95 px-4 pb-[max(10px,env(safe-area-inset-bottom))] backdrop-blur-xl lg:hidden"
          aria-label="Navegação móvel"
        >
          <NavLinks mobile />
        </nav>
      </div>
    </div>
  );
}
