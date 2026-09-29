import type { Metadata } from "next";
import { Clock3, Crown, Globe2, Mail, ShieldCheck, UserPlus, UsersRound } from "lucide-react";

import { SpaceSettingsForm } from "@/components/auth/space-settings-form";
import { InvitationForm } from "@/components/invitations/invitation-form";
import { revokeInvitationAction } from "@/features/invitations/actions";
import { requireFinancialContext } from "@/lib/auth/session";
import { database } from "@/lib/db/client";

export const metadata: Metadata = { title: "Configurações" };

export default async function SettingsPage() {
  const context = await requireFinancialContext();
  const [members, invitations] = await Promise.all([
    database().spaceMember.findMany({
      where: {
        financialSpaceId: context.space.id,
        revokedAt: null,
      },
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: "asc" },
    }),
    database().spaceInvitation.findMany({
      where: {
        financialSpaceId: context.space.id,
        acceptedAt: null,
        revokedAt: null,
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
  ]);

  return (
    <div className="mx-auto max-w-4xl">
      <header>
        <p className="text-sm font-semibold text-brand-700">Configurações</p>
        <h1 className="mt-1 text-3xl font-bold tracking-[-0.045em] text-ink">
          Seu espaço financeiro
        </h1>
        <p className="mt-2 text-sm leading-6 text-muted sm:text-base">
          Dados básicos, participantes e regras que mantêm tudo organizado.
        </p>
      </header>

      <div className="mt-7 grid gap-5 md:grid-cols-[1.15fr_0.85fr]">
        <section className="rounded-[20px] border border-line bg-white p-5 shadow-card sm:p-7">
          <div className="flex items-center gap-3 border-b border-line pb-5">
            <span className="grid size-10 place-items-center rounded-2xl bg-brand-100 text-brand-700">
              <Globe2 className="size-5" aria-hidden="true" />
            </span>
            <div>
              <h2 className="font-bold text-ink">Informações gerais</h2>
              <p className="mt-0.5 text-xs text-muted">Identificação do espaço compartilhado</p>
            </div>
          </div>
          <div className="pt-6">
            <SpaceSettingsForm
              currentName={context.space.name}
              canEdit={context.membership.role === "OWNER"}
            />
          </div>
        </section>

        <aside className="rounded-[20px] border border-line bg-white p-5 shadow-card sm:p-7">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-2xl bg-[#eef4ff] text-[#5274b5]">
              <ShieldCheck className="size-5" aria-hidden="true" />
            </span>
            <div>
              <h2 className="font-bold text-ink">Padrões regionais</h2>
              <p className="mt-0.5 text-xs text-muted">Definidos para esta primeira versão</p>
            </div>
          </div>
          <dl className="mt-6 space-y-4">
            <div className="flex items-center justify-between border-b border-line pb-4">
              <dt className="text-sm text-muted">Moeda</dt>
              <dd className="text-sm font-bold text-ink">{context.space.currency}</dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-sm text-muted">Fuso horário</dt>
              <dd className="text-right text-sm font-bold text-ink">São Paulo</dd>
            </div>
          </dl>
        </aside>
      </div>

      {context.membership.role === "OWNER" && (
        <section className="mt-5 rounded-[20px] border border-line bg-white p-5 shadow-card sm:p-7">
          <div className="flex items-center gap-3 border-b border-line pb-5">
            <span className="grid size-10 place-items-center rounded-2xl bg-brand-100 text-brand-700">
              <UserPlus className="size-5" aria-hidden="true" />
            </span>
            <div>
              <h2 className="font-bold text-ink">Convidar membro</h2>
              <p className="mt-0.5 text-xs text-muted">Crie um link pessoal para compartilhar com seu parceiro</p>
            </div>
          </div>
          <div className="mt-6 grid gap-7 md:grid-cols-[1fr_0.95fr]">
            <InvitationForm />
            <div>
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-ink">Convites aguardando</h3>
                <span className="rounded-full bg-canvas px-2.5 py-1 text-[10px] font-bold text-muted">{invitations.length}</span>
              </div>
              {invitations.length === 0 ? (
                <div className="mt-3 rounded-2xl bg-canvas px-4 py-6 text-center">
                  <Mail className="mx-auto size-5 text-[#aab3ac]" />
                  <p className="mt-2 text-xs leading-5 text-muted">Nenhum convite pendente.</p>
                </div>
              ) : (
                <ul className="mt-3 divide-y divide-line rounded-2xl border border-line px-4">
                  {invitations.map((invitation) => {
                    const expired = invitation.expiresAt <= new Date();
                    return (
                      <li key={invitation.id} className="flex items-center gap-3 py-3">
                        <span className={`grid size-8 shrink-0 place-items-center rounded-xl ${expired ? "bg-red-50 text-red-600" : "bg-amber-50 text-amber-700"}`}>
                          <Clock3 className="size-4" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-bold text-ink">{invitation.email}</p>
                          <p className="mt-0.5 text-[10px] text-muted">{expired ? "Expirado" : `Expira em ${new Intl.DateTimeFormat("pt-BR").format(invitation.expiresAt)}`}</p>
                        </div>
                        <form action={revokeInvitationAction}>
                          <input type="hidden" name="invitationId" value={invitation.id} />
                          <button type="submit" className="text-[10px] font-bold text-red-600 hover:text-red-700">Cancelar</button>
                        </form>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </section>
      )}

      <section className="mt-5 rounded-[20px] border border-line bg-white p-5 shadow-card sm:p-7">
        <div className="flex items-start justify-between gap-4 border-b border-line pb-5">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-2xl bg-brand-100 text-brand-700">
              <UsersRound className="size-5" aria-hidden="true" />
            </span>
            <div>
              <h2 className="font-bold text-ink">Membros</h2>
              <p className="mt-0.5 text-xs text-muted">Pessoas com acesso a este espaço</p>
            </div>
          </div>
          <span className="rounded-full bg-canvas px-3 py-1.5 text-xs font-bold text-muted">
            {members.length} {members.length === 1 ? "membro" : "membros"}
          </span>
        </div>

        <ul className="divide-y divide-line">
          {members.map((member) => {
            const initials = member.user.name
              .split(" ")
              .slice(0, 2)
              .map((part) => part[0])
              .join("")
              .toUpperCase();

            return (
              <li key={member.id} className="flex items-center gap-3 py-4 last:pb-0">
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-brand-100 text-xs font-extrabold text-brand-800">
                  {initials}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-ink">
                    {member.user.name}
                    {member.user.id === context.user.id && (
                      <span className="ml-1 font-normal text-muted">(você)</span>
                    )}
                  </p>
                  <p className="truncate text-xs text-muted">{member.user.email}</p>
                </div>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1.5 text-[10px] font-extrabold tracking-wide text-amber-700">
                  {member.role === "OWNER" && <Crown className="size-3" aria-hidden="true" />}
                  {member.role}
                </span>
              </li>
            );
          })}
        </ul>

      </section>
    </div>
  );
}
