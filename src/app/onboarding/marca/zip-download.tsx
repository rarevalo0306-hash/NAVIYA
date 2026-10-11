"use client";

import { useState } from "react";

// Armar el .zip del kit tarda unos 25 segundos: mientras, el botón avisa que se está preparando
// (con un enlace normal parecía que no pasaba nada).
export function ZipDownload({ href, filename }: { href: string; filename: string }) {
  const [state, setState] = useState<"idle" | "busy" | "error">("idle");

  async function download() {
    if (state === "busy") return;
    setState("busy");
    try {
      const res = await fetch(href);
      if (!res.ok) throw new Error(await res.text());
      const url = URL.createObjectURL(await res.blob());
      const a = Object.assign(document.createElement("a"), { href: url, download: filename });
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
      setState("idle");
    } catch (error) {
      console.error("Descarga del kit:", error);
      setState("error");
    }
  }

  return (
    <span className="flex flex-col gap-1">
      <button
        type="button"
        onClick={download}
        aria-busy={state === "busy"}
        className="inline-flex min-h-12 items-center gap-2 rounded-full bg-lime px-6 font-semibold text-lime-ink transition active:scale-[0.98] disabled:opacity-70"
        disabled={state === "busy"}
      >
        {state === "busy" && <span aria-hidden className="size-4 rounded-full border-2 border-lime-ink/30 border-t-lime-ink motion-safe:animate-spin" />}
        {state === "busy" ? "Preparando tu kit… (unos 30 segundos)" : "Descargar todo (.zip)"}
      </button>
      {state === "error" && (
        <span role="alert" className="text-sm text-muted">
          No se pudo descargar. Intenta de nuevo.
        </span>
      )}
    </span>
  );
}
