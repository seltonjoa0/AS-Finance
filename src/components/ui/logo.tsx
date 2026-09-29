import { Sprout } from "lucide-react";

type LogoProps = {
  compact?: boolean;
};

export function Logo({ compact = false }: LogoProps) {
  return (
    <div className="inline-flex items-center gap-2.5" aria-label="Aflora">
      <span className="grid size-9 place-items-center rounded-xl bg-brand-500 text-white shadow-[0_6px_18px_rgba(50,154,98,0.2)]">
        <Sprout aria-hidden="true" size={19} strokeWidth={2.3} />
      </span>
      {!compact && (
        <span className="text-[1.08rem] font-bold tracking-[-0.035em] text-ink">
          aflora
        </span>
      )}
    </div>
  );
}
