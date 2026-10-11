"use client";

import { useTransition } from "react";
import { setItemActive } from "./actions";

// Mostrar u ocultar en la página (por ejemplo, si se agotó) sin borrarlo.
export function VisibleToggle({ id, active }: { id: string; active: boolean }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      onClick={() => start(() => setItemActive(id, !active))}
      disabled={pending}
      aria-pressed={active}
      aria-label={active ? "Ocultar de mi página" : "Mostrar en mi página"}
      title={active ? "Se ve en tu página. Toca para ocultarlo." : "Está oculto. Toca para mostrarlo."}
      className={`self-start rounded-full px-3 py-1.5 text-xs font-semibold transition disabled:opacity-50 ${active ? "bg-lime/15 text-lime" : "bg-panel-2 text-muted"}`}
    >
      {active ? "Visible" : "Oculto"}
    </button>
  );
}
