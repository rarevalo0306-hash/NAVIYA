import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

// Cobros con Stripe: planes de Orbusiness (suscripción mensual con 14 días de prueba, con tarjeta)
// y el kit de marca (pago único). Llamadas directas a la API (pocas) y firma del webhook verificada aquí.

const KEY = () => process.env.STRIPE_SECRET_KEY?.trim() || "";
export const stripeEnabled = () => Boolean(KEY());

export type Plan = "esencial" | "pro";
export const PLANS: Record<Plan, { name: string; price: number; lookup: string; videos: number; features: string[] }> = {
  esencial: {
    name: "Esencial",
    price: 29,
    lookup: "orbusiness_esencial_monthly",
    videos: 3,
    features: ["Página web con tienda y citas", "CRM y pedidos", "Nuna contesta por texto (página y WhatsApp)", "3 videos con IA al mes"],
  },
  pro: {
    name: "Pro",
    price: 59,
    lookup: "orbusiness_pro_monthly",
    videos: 10,
    features: ["Todo lo de Esencial", "Nuna también por voz", "10 videos con IA al mes", "Tu dominio propio incluido"],
  },
};
export const TRIAL_DAYS = 14;
export const isPlan = (p: unknown): p is Plan => p === "esencial" || p === "pro";

// Stripe recibe formularios con claves anidadas: line_items[0][price]=...
export function stripeForm(obj: Record<string, unknown>, prefix = "", out = new URLSearchParams()) {
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (Array.isArray(v)) v.forEach((item, i) => (typeof item === "object" && item !== null ? stripeForm(item as Record<string, unknown>, `${key}[${i}]`, out) : out.append(`${key}[${i}]`, String(item))));
    else if (typeof v === "object") stripeForm(v as Record<string, unknown>, key, out);
    else out.append(key, String(v));
  }
  return out;
}

export async function stripe<T = Record<string, unknown>>(path: string, params?: Record<string, unknown>, method: "GET" | "POST" = params ? "POST" : "GET"): Promise<T> {
  const body = params ? stripeForm(params) : null;
  const url = `https://api.stripe.com/v1${path}${method === "GET" && body ? `?${body}` : ""}`;
  const res = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${KEY()}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: method === "POST" ? body : undefined,
    signal: AbortSignal.timeout(20_000),
  });
  const json = (await res.json()) as T & { error?: { message?: string } };
  if (!res.ok) throw new Error(`Stripe ${res.status}: ${json.error?.message ?? ""}`);
  return json;
}

// Precio mensual del plan; si no existe en la cuenta de Stripe, lo crea (una sola vez, por lookup_key).
export async function planPrice(plan: Plan) {
  const p = PLANS[plan];
  const found = await stripe<{ data: { id: string }[] }>("/prices", { "lookup_keys[]": p.lookup, active: true }, "GET");
  if (found.data[0]) return found.data[0].id;
  const product = await stripe<{ id: string }>("/products", { name: `Orbusiness ${p.name}` });
  const price = await stripe<{ id: string }>("/prices", { product: product.id, unit_amount: p.price * 100, currency: "usd", recurring: { interval: "month" }, lookup_key: p.lookup });
  return price.id;
}

// Avisos de Stripe: encabezado Stripe-Signature "t=...,v1=..." = HMAC-SHA256 de "t.cuerpo" con el secreto del webhook.
export function validStripeSignature(payload: string, header: string | null, secret = process.env.STRIPE_WEBHOOK_SECRET?.trim() || "", now = Date.now()) {
  if (!header || !secret) return false;
  const parts = Object.fromEntries(header.split(",").map((p) => p.split("=") as [string, string]));
  const t = Number(parts.t);
  if (!t || Math.abs(now / 1000 - t) > 300) return false; // máximo 5 minutos de diferencia
  const expected = Buffer.from(createHmac("sha256", secret).update(`${t}.${payload}`, "utf8").digest("hex"));
  return header
    .split(",")
    .filter((p) => p.startsWith("v1="))
    .some((p) => {
      const got = Buffer.from(p.slice(3));
      return got.length === expected.length && timingSafeEqual(got, expected);
    });
}
