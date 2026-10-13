"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { money } from "@/lib/interview";
import type { SiteItem } from "@/lib/site";
import { cartLines, changeQty, setLines, subtotalOf, useCart } from "./cart";

// En la página pública: botón "Agregar al pedido" en cada producto y el carrito (barra abajo + hoja con el detalle).
// Del carrito se pasa al checkout (/sitio/<negocio>/pagar).

const quoteOnly = (s: SiteItem) => s.kind !== "product" || s.priceMode === "quote" || s.price === null;
const outline = "inline-flex min-h-11 items-center justify-center gap-2 rounded-[var(--rb)] border border-current px-4 text-sm font-semibold transition active:scale-[0.98]";

export function AddToOrder({ item, slug }: { item: SiteItem; slug: string }) {
  useCart(slug); // carga el carrito guardado de este negocio
  const variants = item.variants ?? [];
  const [picked, setPicked] = useState<Record<string, string>>(() => Object.fromEntries(variants.map((v) => [v.name, v.options[0] ?? ""])));
  const [added, setAdded] = useState(false);
  const quote = quoteOnly(item);

  function add() {
    const lines = cartLines();
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

export function OrderBar({ slug, currency }: { slug: string; currency: string }) {
  const items = useCart(slug);
  const dialog = useRef<HTMLDialogElement>(null);
  if (!items.length) return null;
  const isOrder = items.some((l) => !l.quote);
  const subtotal = subtotalOf(items);
  const pendingPrice = items.some((l) => l.unit === null);
  const count = items.reduce((t, l) => t + l.qty, 0);
  const totalText = `${subtotal ? money(subtotal, currency) : ""}${pendingPrice ? `${subtotal ? " + " : ""}a cotizar` : ""}`;
  const title = isOrder ? "Tu carrito" : "Tu cotización";

  return (
    <>
      <button
        type="button"
        onClick={() => dialog.current?.showModal()}
        className="fixed bottom-5 left-5 right-24 z-20 flex min-h-14 items-center justify-between gap-3 rounded-[var(--rb)] bg-[var(--btn)] px-5 font-semibold text-[var(--on-btn)] shadow-xl md:left-auto md:right-5 md:w-96"
      >
        <span>
          {title} · {count}
        </span>
        <span>{totalText} →</span>
      </button>
      <dialog
        ref={dialog}
        aria-label={title}
        className="m-auto max-h-[90dvh] w-[min(100%-2rem,32rem)] rounded-[var(--rl)] bg-[var(--bg)] p-0 text-[var(--ink)] backdrop:bg-black/50"
      >
        <div className="flex flex-col gap-5 p-6">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-2xl font-semibold [font-family:var(--heading)]">{title}</h2>
            <button type="button" onClick={() => dialog.current?.close()} aria-label="Cerrar" className="flex size-11 items-center justify-center rounded-full text-2xl">
              ×
            </button>
          </div>
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
                  <button type="button" onClick={() => changeQty(l, -1)} aria-label={`Quitar uno de ${l.name}`} className="size-11 rounded-full border border-[var(--line)]">
                    −
                  </button>
                  <span className="w-6 text-center tabular-nums">{l.qty}</span>
                  <button type="button" onClick={() => changeQty(l, 1)} disabled={l.qty >= 99} aria-label={`Agregar uno de ${l.name}`} className="size-11 rounded-full border border-[var(--line)]">
                    +
                  </button>
                </span>
              </li>
            ))}
          </ul>
          <p className="flex justify-between font-semibold">
            <span>Subtotal</span>
            <span>{totalText}</span>
          </p>
          {isOrder && <p className="text-sm text-[var(--muted)]">El envío (si lo pides a domicilio) se suma en el siguiente paso.</p>}
          <Link
            href={`/sitio/${slug}/pagar`}
            className="flex min-h-12 items-center justify-center rounded-[var(--rb)] bg-[var(--btn)] px-6 font-semibold text-[var(--on-btn)]"
          >
            {isOrder ? "Continuar con mi pedido" : "Continuar con mi cotización"} →
          </Link>
        </div>
      </dialog>
    </>
  );
}
