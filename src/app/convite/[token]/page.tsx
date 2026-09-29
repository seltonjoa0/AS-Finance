import type { Metadata } from "next";
import { CircleAlert, Clock3, ShieldCheck, UsersRound } from "lucide-react";
import Link from "next/link";

import { AcceptInvitationForm } from "@/components/invitations/accept-invitation-form";
import { Logo } from "@/components/ui/logo";
import { logoutForInvitationAction } from "@/features/invitations/actions";
import { invitationStatus, maskEmail } from "@/features/invitations/policy";
import { invitationTokenSchema } from "@/features/invitations/schemas";
import { hashInvitationToken } from "@/features/invitations/token";
import { getCurrentSession } from "@/lib/auth/session";
import { database } from "@/lib/db/client";

export const metadata: Metadata = { title: "Convite para espaço" };

export default async function InvitationPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const tokenResult = invitationTokenSchema.safeParse(token);
  const [invitation, session] = await Promise.all([
    tokenResult.success
      ? database().spaceInvitation.findUnique({
          where: { tokenHash: hashInvitationToken(tokenResult.data) },
          include: { financialSpace: { select: { name: true } } },
        })
      : Promise.resolve(null),
    getCurrentSession(),
  ]);
  const status = invitation
    ? invitationStatus(invitation, session?.user.email)
    : "expired";
  const next = `/convite/${token}`;
  const authQuery = `next=${encodeURIComponent(next)}`;

  return (
    <main className="min-h-dvh bg-canvas px-5 py-8 sm:px-8 sm:py-12">
      <div className="mx-auto max-w-lg">
        <div className="flex justify-center"><Logo /></div>
        <section className="mt-8 rounded-[24px] border border-white bg-white p-6 text-center shadow-card sm:p-9">
          {status === "available" && invitation ? (
            <>
              <span className="mx-auto grid size-14 place-items-center rounded-[20px] bg-brand-100 text-brand-700">
                <UsersRound className="size-7" />
              </span>
              <p className="mt-5 text-xs font-bold uppercase tracking-[0.14em] text-brand-700">Convite para colaborar</p>
              <h1 className="mt-2 text-2xl font-bold tracking-[-0.04em] text-ink sm:text-3xl">
                Entre em {invitation.financialSpace.name}
              </h1>
              <p className="mt-3 text-sm leading-6 text-muted">
                O convite foi destinado a <strong className="text-ink">{maskEmail(invitation.email)}</strong> e permite acessar as finanças compartilhadas como MEMBER.
              </p>
              <div className="mt-5 flex items-center justify-center gap-2 text-xs font-semibold text-muted">
                <Clock3 className="size-4" /> Expira em {new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium" }).format(invitation.expiresAt)}
              </div>

              {!session ? (
                <div className="mt-7 grid gap-3 sm:grid-cols-2">
                  <Link href={`/login?${authQuery}`} className="inline-flex h-12 items-center justify-center rounded-2xl bg-brand-600 px-5 text-sm font-bold text-white hover:bg-brand-700">Já tenho conta</Link>
                  <Link href={`/cadastro?${authQuery}`} className="inline-flex h-12 items-center justify-center rounded-2xl border border-line bg-white px-5 text-sm font-bold text-ink hover:bg-canvas">Criar minha conta</Link>
                </div>
              ) : (
                <>
                  <p className="mt-6 rounded-2xl bg-canvas px-4 py-3 text-sm text-muted">
                    Você está conectado como <strong className="text-ink">{session.user.email}</strong>.
                  </p>
                  <AcceptInvitationForm token={token} />
                </>
              )}
            </>
          ) : status === "wrong-account" && invitation && session ? (
            <>
              <span className="mx-auto grid size-14 place-items-center rounded-[20px] bg-amber-50 text-amber-700"><CircleAlert className="size-7" /></span>
              <h1 className="mt-5 text-2xl font-bold text-ink">Use a conta convidada</h1>
              <p className="mt-3 text-sm leading-6 text-muted">Este link foi enviado para {maskEmail(invitation.email)}, mas você está conectado como {session.user.email}.</p>
              <form action={logoutForInvitationAction} className="mt-6">
                <input type="hidden" name="token" value={token} />
                <button type="submit" className="h-12 w-full rounded-2xl bg-brand-600 px-5 text-sm font-bold text-white hover:bg-brand-700">Trocar de conta</button>
              </form>
            </>
          ) : (
            <>
              <span className="mx-auto grid size-14 place-items-center rounded-[20px] bg-red-50 text-red-600"><CircleAlert className="size-7" /></span>
              <h1 className="mt-5 text-2xl font-bold text-ink">Convite indisponível</h1>
              <p className="mt-3 text-sm leading-6 text-muted">O link expirou, foi cancelado ou já foi utilizado. Peça um novo convite ao responsável pelo espaço.</p>
              <Link href={session ? "/app" : "/login"} className="mt-6 inline-flex h-12 w-full items-center justify-center rounded-2xl border border-line bg-white px-5 text-sm font-bold text-ink hover:bg-canvas">Voltar para a Aflora</Link>
            </>
          )}
        </section>
        <p className="mt-5 flex items-center justify-center gap-2 text-center text-xs text-muted"><ShieldCheck className="size-4" /> O link é pessoal e só funciona para o e-mail convidado.</p>
      </div>
    </main>
  );
}
