"use client";

import { useActionState } from "react";
import { saveDomain, type DomainState } from "./actions";

export function DomainForm({ current }: { current: string | null }) {
  const [state, action, pending] = useActionState<DomainState, FormData>(saveDomain, {});
  return (
    <form action={action} className="flex flex-col gap-2">
      <label htmlFor="dominio" className="text-sm font-semibold text-muted">
        Tu dominio
      </label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          id="dominio"
          name="domain"
          defaultValue={current ?? ""}
          placeholder="minegocio.com"
          autoCapitalize="none"
          className="min-h-12 flex-1 rounded-[14px] border border-line bg-ink px-4 text-bone placeholder:text-muted/70"
        />
        <button type="submit" disabled={pending} className="min-h-12 rounded-full bg-lime px-6 font-semibold text-lime-ink disabled:opacity-60">
          {pending ? "Guardando…" : "Guardar"}
        </button>
      </div>
      {state.error && (
        <p role="alert" className="text-sm text-[#ff8a8a]">
          {state.error}
        </p>
      )}
    </form>
  );
}
