"use client";

import { useTransition } from "react";
import { setNunaReplies } from "./actions";

export function NunaSwitch({ on }: { on: boolean }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      disabled={pending}
      onClick={() => start(() => setNunaReplies(!on))}
      className="flex min-h-12 items-center gap-3 rounded-full bg-panel px-4 text-sm font-semibold disabled:opacity-50"
    >
      <span aria-hidden className={`flex h-6 w-11 items-center rounded-full p-0.5 transition ${on ? "bg-lime" : "bg-panel-2"}`}>
        <span className={`size-5 rounded-full bg-ink transition ${on ? "translate-x-5" : ""}`} />
      </span>
      {on ? "Nuna contesta los mensajes" : "Nuna está en pausa"}
    </button>
  );
}
