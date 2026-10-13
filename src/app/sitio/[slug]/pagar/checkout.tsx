"use client";

import Link from "next/link";
import { useState } from "react";
import { deliveryFee, type CheckoutSettings } from "@/lib/checkout";
import { money } from "@/lib/interview";
import { placeOrder, type OrderResult } from "../actions";
import { setLines, subtotalOf, useCart } from "../cart";

// Checkout como visitante, en dos pasos: 1) tus datos y cómo recibes el pedido, 2) resumen y pago.
// Lo que se muestra aquí es estimado: la base calcula precios y envío al confirmar.

const input = "min-h-12 w-full rounded-[var(--r)] border border-[var(--line)] bg-[var(--surface)] px-4 text-[var(--ink)] placeholder:text-[var(--muted)]";
const label = "flex flex-col gap-1 text-sm font-semibold";
const primary = "min-h-12 rounded-[var(--rb)] bg-[var(--btn)] px-6 font-semibold text-[var(--on-btn)] disabled:opacity-60";
const choice = (on: boolean) =>
  `flex cursor-pointer flex-col gap-1 rounded-[var(--rl)] border p-4 ${on ? "border-[var(--btn)] bg-[var(--surface)]" : "border-[var(--line)]"}`;

export function Checkout(props: { slug: string; currency: string; settings: CheckoutSettings; paymentMethods: string[]; thanks?: string }) {
  const { slug, currency, settings, paymentMethods } = props;
  const items = useCart(slug);
  const [step, setStep] = useState<1 | 2>(1);
  const [form, setForm] = useState({ name: "", phone: "", email: "", note: "", address: "", payment: paymentMethods.length === 1 ? paymentMethods[0] : "" });
  const [fulfillment, setFulfillment] = useState<"delivery" | "pickup" | "">(settings.delivery && !settings.pickup ? "delivery" : !settings.delivery ? "pickup" : "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<OrderResult | null>(null);
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm({ ...form, [k]: e.target.value });

  const isOrder = items.some((l) => !l.quote);
  const subtotal = subtotalOf(items);
  const pendingPrice = items.some((l) => l.unit === null);
  const fee = fulfillment === "delivery" ? deliveryFee(settings, subtotal) : null;
  const m = (n: number) => money(n, currency);

  if (done) {
    return (
      <section className="mx-auto flex max-w-xl flex-col gap-5 py-6" role="status">
        <h1 className="text-4xl font-semibold tracking-tight [font-family:var(--heading)]">
          {done.kind === "order" ? `¡Pedido #${done.number} recibido!` : "¡Recibimos tu solicitud!"}
        </h1>
        <p className="text-lg">{props.thanks ?? "Te contactamos muy pronto por WhatsApp para confirmar."}</p>
        {done.total !== null && (
          <div className="flex flex-col gap-1 rounded-[var(--rl)] bg-[var(--surface)] p-5">
            {done.subtotal !== null && <Row label="Subtotal" value={m(done.subtotal)} />}
            {done.fulfillment === "delivery" && <Row label="Envío" value={done.delivery_fee === null ? "te lo confirmamos" : done.delivery_fee === 0 ? "Gratis" : m(done.delivery_fee)} />}
            <Row label="Total" value={m(done.total)} strong />
          </div>
        )}
        {done.payment && <p>Forma de pago: <strong>{done.payment}</strong></p>}
        {done.payment_note && (
          <div className="flex flex-col gap-1 rounded-[var(--rl)] border border-[var(--line)] p-5">
            <span className="text-sm font-semibold uppercase tracking-wider text-[var(--muted)]">Cómo pagar</span>
            <p className="whitespace-pre-line">{done.payment_note}</p>
          </div>
        )}
        {done.fulfillment === "pickup" && done.pickup_note && <p className="whitespace-pre-line">Para recoger: {done.pickup_note}</p>}
        <Link href={`/sitio/${slug}`} className="self-start underline underline-offset-4">
          ← Volver a la tienda
        </Link>
      </section>
    );
  }

  if (!items.length) {
    return (
      <section className="mx-auto flex max-w-xl flex-col gap-4 py-10 text-center">
        <h1 className="text-3xl font-semibold [font-family:var(--heading)]">Tu carrito está vacío</h1>
        <Link href={`/sitio/${slug}#servicios`} className={`${primary} inline-flex items-center justify-center self-center`}>
          Ver productos
        </Link>
      </section>
    );
  }

  async function submit() {
    setPending(true);
    setError(null);
    const r = await placeOrder(slug, {
      ...form,
      fulfillment: isOrder ? fulfillment : "",
      items: items.map(({ id, qty, options }) => ({ id, qty, options })),
    }).catch(() => ({ error: "Se cortó la conexión. Intenta de nuevo." }));
    setPending(false);
    if ("error" in r) return setError(r.error);
    setLines([]);
    setDone(r.ok);
    window.scrollTo({ top: 0 });
  }

  const summary = (
    <aside className="flex flex-col gap-3 rounded-[var(--rl)] bg-[var(--surface)] p-5 md:sticky md:top-6">
      <h2 className="text-lg font-semibold [font-family:var(--heading)]">Tu pedido</h2>
      <ul className="flex flex-col gap-2 text-sm">
        {items.map((l) => (
          <li key={l.key} className="flex justify-between gap-3">
            <span>
              {l.qty} × {l.name}
              {Object.keys(l.options).length > 0 && <span className="text-[var(--muted)]"> ({Object.values(l.options).join(", ")})</span>}
            </span>
            <span className="shrink-0">{l.unit === null ? "a cotizar" : m(l.unit * l.qty)}</span>
          </li>
        ))}
      </ul>
      <div className="flex flex-col gap-1 border-t border-[var(--line)] pt-3">
        <Row label="Subtotal" value={`${m(subtotal)}${pendingPrice ? " + a cotizar" : ""}`} />
        {isOrder && fulfillment === "delivery" && <Row label="Envío" value={fee === null ? "te lo confirmamos" : fee === 0 ? "Gratis" : m(fee)} />}
        {isOrder && fulfillment === "pickup" && <Row label="Envío" value="Recoges tú" />}
        <Row label="Total" value={`${m(subtotal + (fee ?? 0))}${pendingPrice || (fulfillment === "delivery" && fee === null) ? " + por confirmar" : ""}`} strong />
      </div>
      <Link href={`/sitio/${slug}`} className="text-sm underline underline-offset-4">
        ← Seguir comprando
      </Link>
    </aside>
  );

  return (
    <div className="grid gap-8 md:grid-cols-[1fr_22rem] md:items-start">
      <div className="flex flex-col gap-6">
        <ol className="flex gap-2 text-sm font-semibold" aria-label="Pasos">
          <li className={step === 1 ? "text-[var(--ink)]" : "text-[var(--muted)]"}>1. Tus datos{isOrder ? " y entrega" : ""}</li>
          {isOrder && <li className="text-[var(--muted)]">→</li>}
          {isOrder && <li className={step === 2 ? "text-[var(--ink)]" : "text-[var(--muted)]"}>2. Pago</li>}
        </ol>

        {step === 1 ? (
          <form
            className="flex flex-col gap-5"
            onSubmit={(e) => {
              e.preventDefault();
              if (isOrder) setStep(2);
              else void submit();
            }}
          >
            <h1 className="text-3xl font-semibold tracking-tight [font-family:var(--heading)]">{isOrder ? "¿A quién se lo enviamos?" : "Tus datos"}</h1>
            <label className={label}>
              Nombre
              <input required maxLength={120} autoComplete="name" value={form.name} onChange={set("name")} className={input} />
            </label>
            <div className="grid gap-5 sm:grid-cols-2">
              <label className={label}>
                Teléfono o WhatsApp
                <input required type="tel" minLength={6} maxLength={40} autoComplete="tel" value={form.phone} onChange={set("phone")} className={input} />
              </label>
              <label className={label}>
                Correo
                <input required type="email" maxLength={200} autoComplete="email" value={form.email} onChange={set("email")} className={input} />
              </label>
            </div>

            {isOrder && (
              <fieldset className="flex flex-col gap-3">
                <legend className="mb-2 text-lg font-semibold [font-family:var(--heading)]">¿Cómo lo recibes?</legend>
                {settings.delivery && (
                  <label className={choice(fulfillment === "delivery")}>
                    <span className="flex items-center gap-3 font-semibold">
                      <input type="radio" name="fulfillment" required checked={fulfillment === "delivery"} onChange={() => setFulfillment("delivery")} />
                      Entrega a domicilio
                    </span>
                    {settings.deliveryNote && <span className="text-sm text-[var(--muted)]">{settings.deliveryNote}</span>}
                  </label>
                )}
                {settings.pickup && (
                  <label className={choice(fulfillment === "pickup")}>
                    <span className="flex items-center gap-3 font-semibold">
                      <input type="radio" name="fulfillment" required checked={fulfillment === "pickup"} onChange={() => setFulfillment("pickup")} />
                      Recoger en el local
                    </span>
                    {settings.pickupNote && <span className="text-sm text-[var(--muted)]">{settings.pickupNote}</span>}
                  </label>
                )}
                {fulfillment === "delivery" && (
                  <label className={label}>
                    Dirección de entrega
                    <textarea required minLength={5} maxLength={300} rows={2} autoComplete="street-address" value={form.address} onChange={set("address")} className={`${input} py-3`} />
                  </label>
                )}
              </fieldset>
            )}

            <label className={label}>
              {!isOrder ? "¿Qué necesitas? (opcional)" : fulfillment === "delivery" ? "Instrucciones de entrega (referencias, horario) — opcional" : fulfillment === "pickup" ? "¿Cuándo pasas a recoger? — opcional" : "Notas (opcional)"}
              <textarea maxLength={1000} rows={2} value={form.note} onChange={set("note")} className={`${input} py-3`} />
            </label>
            {error && (
              <p role="alert" className="text-sm text-[#d14343]">
                {error}
              </p>
            )}
            <button type="submit" disabled={pending} className={`${primary} self-start`}>
              {isOrder ? "Continuar al pago →" : pending ? "Enviando…" : "Pedir cotización"}
            </button>
          </form>
        ) : (
          <form
            className="flex flex-col gap-5"
            onSubmit={(e) => {
              e.preventDefault();
              void submit();
            }}
          >
            <h1 className="text-3xl font-semibold tracking-tight [font-family:var(--heading)]">¿Cómo vas a pagar?</h1>
            {paymentMethods.length > 0 ? (
              <fieldset className="flex flex-col gap-3">
                <legend className="sr-only">Forma de pago</legend>
                {paymentMethods.map((p) => (
                  <label key={p} className={choice(form.payment === p)}>
                    <span className="flex items-center gap-3 font-semibold">
                      <input type="radio" name="payment" required checked={form.payment === p} onChange={() => setForm({ ...form, payment: p })} />
                      {p}
                    </span>
                  </label>
                ))}
              </fieldset>
            ) : (
              <p className="text-[var(--muted)]">El negocio te confirma cómo pagar al recibir tu pedido.</p>
            )}
            {settings.paymentNote && <p className="whitespace-pre-line rounded-[var(--rl)] border border-[var(--line)] p-4 text-sm">{settings.paymentNote}</p>}
            {error && (
              <p role="alert" className="text-sm text-[#d14343]">
                {error}
              </p>
            )}
            <div className="flex flex-wrap items-center gap-4">
              <button type="submit" disabled={pending} className={primary}>
                {pending ? "Enviando…" : "Confirmar pedido"}
              </button>
              <button type="button" onClick={() => setStep(1)} className="min-h-12 underline underline-offset-4">
                ← Cambiar mis datos
              </button>
            </div>
            <p className="text-sm text-[var(--muted)]">Al confirmar, el negocio recibe tu pedido y te escribe por WhatsApp para coordinar.</p>
          </form>
        )}
      </div>
      {summary}
    </div>
  );
}

function Row({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <p className={`flex justify-between gap-3 ${strong ? "text-lg font-semibold" : ""}`}>
      <span>{label}</span>
      <span>{value}</span>
    </p>
  );
}
