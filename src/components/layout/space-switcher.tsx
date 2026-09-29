"use client";

import { ChevronDown } from "lucide-react";
import { useRef } from "react";

import { switchSpaceAction } from "@/features/spaces/actions";

type SpaceSwitcherProps = {
  currentId: string;
  spaces: Array<{ id: string; name: string }>;
  compact?: boolean;
};

export function SpaceSwitcher({ currentId, spaces, compact = false }: SpaceSwitcherProps) {
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form ref={formRef} action={switchSpaceAction} className="relative min-w-0">
      <label htmlFor={compact ? "mobile-space" : "desktop-space"} className="sr-only">
        Espaço financeiro atual
      </label>
      <select
        id={compact ? "mobile-space" : "desktop-space"}
        name="financialSpaceId"
        defaultValue={currentId}
        onChange={() => formRef.current?.requestSubmit()}
        className={`w-full appearance-none truncate bg-transparent pr-6 font-bold text-ink outline-none ${
          compact ? "max-w-48 text-center text-sm" : "text-sm"
        }`}
        aria-label="Trocar espaço financeiro"
      >
        {spaces.map((space) => (
          <option key={space.id} value={space.id}>{space.name}</option>
        ))}
      </select>
      {spaces.length > 1 && (
        <ChevronDown className="pointer-events-none absolute top-1/2 right-0 size-4 -translate-y-1/2 text-muted" aria-hidden="true" />
      )}
    </form>
  );
}
