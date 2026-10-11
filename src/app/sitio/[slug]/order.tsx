"use client";

import { useActionState, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { money } from "@/lib/interview";
import type { SiteCopy, SiteItem } from "@/lib/site";
import { submitOrder, type LeadState } from "./actions";

// El pedido del cliente en la página pública: botón "Agregar al pedido" en cada producto,
// barra abajo con el total y una hoja para mandar sus datos. Los precios de aquí son solo para mostrar:
// la base de datos pone los de verdad al recibir el pedido.

type Line = { key: string; id: string; name: string; qty: number; options: Record<string, string>; unit: number | null; quote: boolean };

let lines: Line[] = [];
const subs = new Set<() => void>();
const EMPTY: Line[] = [];
const setLines = (next: Line[]) => {
  lines = next;
  subs.forEach((f) => f());
};
const useLines = () =>
  useSyncExternalStore(
    (f) => (subs.add(f), () => subs.delete(f)),
    () => lines,
    () => EMPTY,
  );

const quoteOnly = (s: SiteItem) => s.kind !== "product" || s.priceMode === "quote" || s.price === null;
const outline = "inline-flex min-h-11 items-center justify-center gap-2 rounded-[var(--rb)] border border-current px-4 text-sm font-semibold transition active:scale-[0.98]";
const input = "min-h-12 rounded-[var(--r)] border border-[var(--line)] bg-[var(--surface)] px-4 text-[var(--ink)] placeholder:text-[var(--muted)]";

export function AddToOrder({ item }: { item: SiteItem }) {
  const variants = item.variants ?? [];
  const [picked, setPicked] = useState<Record<string, string>>(() => Object.fromEntries(variants.map((v) => [v.name, v.options[0] ?? ""])));
  const [added, setAdded] = useState(false);
  const quote = quoteOnly(item);

  function add() {
    const key = `${item.id}|${JSON.stringify(picked)}`;
    const found = lines.find((l) => l.key === key);
    setLines(
      found
        ? lines.map((l) => (l === found ? { ...l, qty: Math.min(99, l.qty + 1) } : l))
        : [...lines, { key, id: item.id!, name: item.name, qty: 1, options: picked, unit: item.priceMode === "fixed" ? item.price : null, quote }],
    );
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {variants.map((v) => (
        <label key={v.name} className="flex items-center gap-1 text-sm">
          <span className="sr-only">{v.name}</span>
          <select
            value={picked[v.name]}
            onChange={(e) => setPicked({ ...picked, [v.name]: e.target.value })}
            className="min-h-11 rounded-[var(--r)] border border-current/30 bg-transparent px-2"
          >
            {v.options.map((o) => (
              <option key={o} value={o}>
                {v.name}: {o}
              </option>
            ))}
          </select>
        </label>
      ))}
      <button type="button" onClick={add} className={outline}>
        {added ? "Agregado ✓" : quote ? "Pedir cotización" : "Agregar al pedido"}
      </button>
    </div>
  );
}

export function OrderBar({ slug, currency, copy }: { slug: string; currency: string; copy?: SiteCopy }) {
  const items = useLines();
  const dialog = useRef<HTMLDialogElement>(null);
  const [state, action, pending] = useActionState<LeadState, FormData>(submitOrder.bind(null, slug), {});
  const isOrder = items.some((l) => !l.quote);
  const known = items.reduce((t, l) => t + (l.unit ?? 0) * l.qty, 0);
  const pendingPrice = items.some((l) => l.unit === null);
  const count = items.reduce((t, l) => t + l.qty, 0);
  const done = Boolean(state.ok) && !items.length; // si agrega más después de enviar, vuelve a salir el formulario

  useEffect(() => {
    if (state.ok) setLines([]);
  }, [state]);

  if (!items.length && !state.ok) return null;
  const qty = (l: Line, d: number) => setLines(lines.map((x) => (x === l ? { ...x, qty: x.qty + d } : x)).filter((x) => x.qty > 0));
  const totalText = `${known ? money(known, currency) : ""}${pendingPrice ? `${known ? " + " : ""}a cotizar` : ""}`;

  return (
    <>
      {items.length > 0 && (
        <button
          type="button"
          onClick={() => dialog.current?.showModal()}
          className="fixed bottom-5 left-5 right-24 z-20 flex min-h-14 items-center justify-between gap-3 rounded-[var(--rb)] bg-[var(--btn)] px-5 font-semibold text-[var(--on-btn)] shadow-xl md:left-auto md:right-5 md:w-96"
        >
          <span>
            {isOrder ? "Tu pedido" : "Tu cotización"} · {count}
          </span>
          <span>{totalText} →</span>
        </button>
      )}
      <dialog
        ref={dialog}
        aria-label={isOrder ? "Tu pedido" : "Tu cotización"}
        className="m-auto max-h-[90dvh] w-[min(100%-2rem,32rem)] rounded-[var(--rl)] bg-[var(--bg)] p-0 text-[var(--ink)] backdrop:bg-black/50"
      >
        <div className="flex flex-col gap-5 p-6">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-2xl font-semibold [font-family:var(--heading)]">{done ? "¡Listo!" : isOrder ? "Tu pedido" : "Tu cotización"}</h2>
            <button type="button" onClick={() => dialog.current?.close()} aria-label="Cerrar" className="flex size-11 items-center justify-center rounded-full text-2xl">
              ×
            </button>
          </div>
          {done ? (
            <p role="status" className="text-lg">
              {copy?.thanks ?? "¡Gracias! Recibimos tus datos y te contactamos muy pronto."}
            </p>
          ) : (
            <>
              <ul className="flex flex-col divide-y divide-[var(--line)]">
                {items.map((l) => (
                  <li key={l.key} className="flex items-center justify-between gap-3 py-3">
                    <span className="min-w-0">
                      <span className="block font-semibold">{l.name}</span>
                      <span className="block text-sm text-[var(--muted)]">
                        {[...Object.entries(l.options).map(([k, v]) => `${k}: ${v}`), l.unit === null ? "a cotizar" : money(l.unit * l.qty, currency)].join(" · ")}
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-1">
                      <button type="button" onClick={() => qty(l, -1)} aria-label={`Quitar uno de ${l.name}`} className="size-11 rounded-full border border-[var(--line)]">
                        −
                      </button>
                      <span className="w-6 text-center tabular-nums">{l.qty}</span>
                      <button type="button" onClick={() => qty(l, 1)} disabled={l.qty >= 99} aria-label={`Agregar uno de ${l.name}`} className="size-11 rounded-full border border-[var(--line)]">
                        +
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
              <p className="flex justify-between font-semibold">
                <span>Total</span>
                <span>{totalText}</span>
              </p>
              <form action={action} className="flex flex-col gap-3">
                <input type="hidden" name="items" value={JSON.stringify(items.map(({ id, qty, options }) => ({ id, qty, options })))} />
                <label className="flex flex-col gap-1 text-sm font-semibold">
                  {copy?.nameLabel ?? "Tu nombre"}
                  <input name="name" required maxLength={120} autoComplete="name" className={input} />
                </label>
                <label className="flex flex-col gap-1 text-sm font-semibold">
                  Teléfono o WhatsApp
                  <input name="phone" type="tel" maxLength={40} autoComplete="tel" className={input} />
                </label>
                <label className="flex flex-col gap-1 text-sm font-semibold">
                  Correo
                  <input name="email" type="email" maxLength={200} autoComplete="email" className={input} />
                </label>
                <label className="flex flex-col gap-1 text-sm font-semibold">
                  Nota (opcional)
                  <textarea name="note" rows={2} maxLength={1000} className={`${input} py-3`} />
                </label>
                {state.error && (
                  <p role="alert" className="text-sm text-[#d14343]">
                    {state.error}
                  </p>
                )}
                <button type="submit" disabled={pending} className="min-h-12 rounded-[var(--rb)] bg-[var(--btn)] px-6 font-semibold text-[var(--on-btn)] disabled:opacity-60">
                  {pending ? "Enviando…" : isOrder ? "Enviar pedido" : "Pedir cotización"}
                </button>
                <p className="text-sm text-[var(--muted)]">Te contactamos para confirmar{isOrder ? " y acordar el pago y la entrega" : " el precio"}.</p>
              </form>
            </>
          )}
        </div>
      </dialog>
    </>
  );
}
