"use client";

import { useSyncExternalStore } from "react";

// Carrito del cliente en la página pública. Se guarda en el navegador por negocio, así no se pierde
// al recargar ni al pasar al checkout. Los precios aquí son solo para mostrar: los de verdad los pone la base.

export type Line = { key: string; id: string; name: string; qty: number; options: Record<string, string>; unit: number | null; quote: boolean };

let slug = "";
let lines: Line[] = [];
const subs = new Set<() => void>();
const EMPTY: Line[] = [];
const storeKey = () => `orbusiness:carrito:${slug}`;

function load(s: string) {
  if (slug === s) return;
  slug = s;
  try {
    const saved = JSON.parse(localStorage.getItem(storeKey()) ?? "[]");
    lines = Array.isArray(saved) ? saved.filter((l) => l && typeof l.id === "string" && typeof l.qty === "number").slice(0, 50) : [];
  } catch {
    lines = [];
  }
}

export function setLines(next: Line[]) {
  lines = next;
  try {
    localStorage.setItem(storeKey(), JSON.stringify(next));
  } catch {}
  subs.forEach((f) => f());
}

export const cartLines = () => lines;

export function useCart(s: string) {
  return useSyncExternalStore(
    (f) => (subs.add(f), () => subs.delete(f)),
    () => (load(s), lines),
    () => EMPTY,
  );
}

export const changeQty = (l: Line, d: number) => setLines(lines.map((x) => (x.key === l.key ? { ...x, qty: Math.min(99, x.qty + d) } : x)).filter((x) => x.qty > 0));
export const subtotalOf = (items: Line[]) => items.reduce((t, l) => t + (l.unit ?? 0) * l.qty, 0);
