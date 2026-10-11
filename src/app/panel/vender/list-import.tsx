"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import type { ListItem } from "@/lib/catalog";
import { shrinkImage } from "@/lib/shrink-image";
import { addItems } from "./actions";

// "Subir mi lista de precios": Nuna lee la foto o el PDF, el dueño revisa lo que encontró y lo agrega de una vez.
export function ListImport() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<"idle" | "reading" | "review" | "saving">("idle");
  const [items, setItems] = useState<(ListItem & { keep: boolean })[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function read(file: File) {
    if (file.type === "application/pdf" && file.size > 4 * 1024 * 1024) return setError("El PDF es muy grande (máximo 4 MB).");
    setError(null);
    setState("reading");
    try {
      const body = new FormData();
      body.append("archivo", file.type.startsWith("image/") ? await shrinkImage(file, 2000) : file, file.name);
      const res = await fetch("/api/vender/lista", { method: "POST", body });
      const json = (await res.json().catch(() => ({}))) as { items?: ListItem[]; error?: string };
      if (!res.ok || !json.items) throw new Error(json.error ?? "No pude leer la lista.");
      if (!json.items.length) throw new Error("No encontré productos ni servicios en ese archivo. Intenta con una foto más clara.");
      setItems(json.items.map((i) => ({ ...i, keep: true })));
      setState("review");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No pude leer la lista.");
      setState("idle");
    }
  }

  async function save() {
    setState("saving");
    const r = await addItems(
      items.filter((i) => i.keep).map((i) => ({ kind: i.kind, name: i.name, price: i.price, price_mode: i.price_mode, description: i.description, category: i.category })),
    );
    if ("error" in r) {
      setError(r.error);
      setState("review");
      return;
    }
    setItems([]);
    setState("idle");
    router.refresh();
  }

  const chosen = items.filter((i) => i.keep).length;
  return (
    <>
      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,application/pdf"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) void read(f);
        }}
      />
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        disabled={state !== "idle"}
        className="inline-flex min-h-12 items-center gap-2 rounded-full border border-line px-5 font-semibold transition hover:bg-panel disabled:opacity-60"
      >
        {state === "reading" && <span aria-hidden className="size-4 rounded-full border-2 border-bone/30 border-t-bone motion-safe:animate-spin" />}
        {state === "reading" ? "Nuna está leyendo tu lista…" : "Subir mi lista de precios"}
      </button>
      {error && (
        <p role="alert" className="w-full text-sm text-muted">
          {error}
        </p>
      )}

      {(state === "review" || state === "saving") && (
        <div role="dialog" aria-modal="true" aria-labelledby="lista-titulo" className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-3 sm:items-center">
          <div className="flex max-h-[90dvh] w-full max-w-lg flex-col overflow-hidden rounded-[28px] border border-white/[0.08] bg-panel">
            <div className="flex flex-col gap-1 p-5">
              <h2 id="lista-titulo" className="font-display text-2xl font-bold">
                Nuna encontró {items.length}
              </h2>
              <p className="text-sm text-muted">Quita lo que no quieras agregar. Después puedes ponerles foto y descripción.</p>
            </div>
            <ul className="flex flex-1 flex-col gap-2 overflow-y-auto px-5">
              {items.map((i, n) => (
                <li key={n}>
                  <label className="flex items-start gap-3 rounded-2xl bg-panel-2 p-3">
                    <input
                      type="checkbox"
                      checked={i.keep}
                      onChange={(e) => setItems((all) => all.map((x, k) => (k === n ? { ...x, keep: e.target.checked } : x)))}
                      className="mt-1 size-5 accent-lime"
                    />
                    <span className="flex min-w-0 flex-col">
                      <span className="font-semibold">{i.name}</span>
                      <span className="text-sm text-muted">
                        {i.kind === "service" ? "Servicio" : "Producto"} ·{" "}
                        {i.price === null || i.price_mode === "quote" ? "A cotizar" : `${i.price_mode === "from" ? "desde " : ""}${i.price}`}
                        {i.category ? ` · ${i.category}` : ""}
                      </span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap justify-end gap-2 p-5">
              <button type="button" onClick={() => setState("idle")} disabled={state === "saving"} className="min-h-12 rounded-full border border-line px-5 font-semibold">
                Cancelar
              </button>
              <button type="button" onClick={save} disabled={!chosen || state === "saving"} className="min-h-12 rounded-full bg-lime px-6 font-semibold text-lime-ink disabled:opacity-50">
                {state === "saving" ? "Agregando…" : `Agregar ${chosen}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
