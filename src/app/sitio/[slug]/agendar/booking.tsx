"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { formatSlot } from "@/lib/booking";
import type { SiteItem } from "@/lib/site";
import { bookAppointment, getSlots, type BookingResult } from "../actions";

// El cliente elige servicio, día y hora (los horarios libres vienen de la base), deja sus datos y agenda.

const input = "min-h-12 w-full rounded-[var(--r)] border border-[var(--line)] bg-[var(--surface)] px-4 text-[var(--ink)]";
const label = "flex flex-col gap-1 text-sm font-semibold";
const primary = "min-h-12 rounded-[var(--rb)] bg-[var(--btn)] px-6 font-semibold text-[var(--on-btn)] disabled:opacity-60";
const pill = (on: boolean) =>
  `min-h-11 rounded-[var(--rb)] border px-4 text-sm font-semibold transition ${on ? "border-[var(--btn)] bg-[var(--btn)] text-[var(--on-btn)]" : "border-[var(--line)]"}`;
const DAYS = 21;

// Fecha de hoy en la zona del negocio (YYYY-MM-DD) y los días siguientes.
function nextDays(tz: string) {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(new Date());
  const base = new Date(`${today}T12:00:00Z`);
  return Array.from({ length: DAYS }, (_, i) => new Date(base.getTime() + i * 86_400_000).toISOString().slice(0, 10));
}

// Enlace para guardar la cita en Google Calendar.
function calendarLink(r: BookingResult) {
  const stamp = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const q = new URLSearchParams({ action: "TEMPLATE", text: `${r.service} · ${r.business}`, dates: `${stamp(r.starts_at)}/${stamp(r.ends_at)}` });
  return `https://calendar.google.com/calendar/render?${q}`;
}

export function Booking(props: { slug: string; tz: string; services: (SiteItem & { priceText: string })[]; initial: string }) {
  const { slug, tz, services } = props;
  const days = nextDays(tz);
  const [service, setService] = useState(props.initial);
  const [day, setDay] = useState(days[0]);
  const [slots, setSlots] = useState<string[] | null>(null);
  const [slot, setSlot] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", phone: "", email: "", note: "" });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<BookingResult | null>(null);
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm({ ...form, [k]: e.target.value });

  useEffect(() => {
    let live = true;
    void getSlots(slug, service, day).then((s) => live && setSlots(s));
    return () => {
      live = false;
    };
  }, [slug, service, day]);

  if (done) {
    return (
      <section className="mx-auto flex max-w-xl flex-col gap-5 py-6" role="status">
        <h1 className="text-4xl font-semibold tracking-tight [font-family:var(--heading)]">¡Tu cita quedó agendada!</h1>
        <div className="flex flex-col gap-1 rounded-[var(--rl)] bg-[var(--surface)] p-5 text-lg">
          <strong>{done.service}</strong>
          <span className="first-letter:uppercase">{formatSlot(done.starts_at, done.tz)}</span>
          <span className="text-sm text-[var(--muted)]">{done.business}</span>
        </div>
        <p>Te escribimos para confirmarte. Si necesitas cambiarla, contáctanos.</p>
        <div className="flex flex-wrap gap-4">
          <a href={calendarLink(done)} target="_blank" rel="noopener" className={`${primary} inline-flex items-center`}>
            Guardar en mi calendario
          </a>
          <Link href={`/sitio/${slug}`} className="inline-flex min-h-12 items-center underline underline-offset-4">
            ← Volver a la página
          </Link>
        </div>
      </section>
    );
  }

  async function submit() {
    if (!slot) return;
    setPending(true);
    setError(null);
    const r = await bookAppointment(slug, { service, start: slot, ...form }).catch(() => ({ error: "Se cortó la conexión. Intenta de nuevo." }));
    setPending(false);
    if ("error" in r) {
      setError(r.error);
      setSlot(null);
      setSlots(null);
      void getSlots(slug, service, day).then(setSlots);
      return;
    }
    setDone(r.ok);
    window.scrollTo({ top: 0 });
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8">
      <h1 className="text-4xl font-semibold tracking-tight [font-family:var(--heading)]">Agenda tu cita</h1>

      <section className="flex flex-col gap-3" aria-labelledby="paso-servicio">
        <h2 id="paso-servicio" className="text-lg font-semibold [font-family:var(--heading)]">1. ¿Qué servicio?</h2>
        <div className="flex flex-col gap-2">
          {services.map((s) => (
            <label key={s.id} className={`flex cursor-pointer items-center justify-between gap-3 rounded-[var(--rl)] border p-4 ${service === s.id ? "border-[var(--btn)] bg-[var(--surface)]" : "border-[var(--line)]"}`}>
              <span className="flex items-center gap-3 font-semibold">
                <input
                  type="radio"
                  name="servicio"
                  checked={service === s.id}
                  onChange={() => {
                    setService(s.id!);
                    setSlot(null);
                    setSlots(null);
                  }}
                />
                {s.name}
              </span>
              <span className="text-sm text-[var(--muted)]">{s.priceText}</span>
            </label>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-3" aria-labelledby="paso-dia">
        <h2 id="paso-dia" className="text-lg font-semibold [font-family:var(--heading)]">2. ¿Qué día?</h2>
        <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-2">
          {days.map((d) => {
            const date = new Date(`${d}T12:00:00Z`);
            const on = d === day;
            return (
              <button
                key={d}
                type="button"
                onClick={() => {
                  setDay(d);
                  setSlot(null);
                  setSlots(null);
                }}
                aria-pressed={on}
                className={`flex min-w-16 shrink-0 flex-col items-center rounded-[var(--r)] border px-3 py-2 ${on ? "border-[var(--btn)] bg-[var(--btn)] text-[var(--on-btn)]" : "border-[var(--line)]"}`}
              >
                <span className="text-xs uppercase">{new Intl.DateTimeFormat("es", { weekday: "short", timeZone: "UTC" }).format(date)}</span>
                <span className="text-xl font-semibold">{date.getUTCDate()}</span>
                <span className="text-xs">{new Intl.DateTimeFormat("es", { month: "short", timeZone: "UTC" }).format(date)}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="flex flex-col gap-3" aria-labelledby="paso-hora" aria-live="polite">
        <h2 id="paso-hora" className="text-lg font-semibold [font-family:var(--heading)]">3. ¿A qué hora?</h2>
        {slots === null ? (
          <p className="text-[var(--muted)]">Buscando horarios…</p>
        ) : slots.length ? (
          <div className="flex flex-wrap gap-2">
            {slots.map((s) => (
              <button key={s} type="button" onClick={() => setSlot(s)} aria-pressed={slot === s} className={pill(slot === s)}>
                {formatSlot(s, tz, { hour: "numeric", minute: "2-digit" })}
              </button>
            ))}
          </div>
        ) : (
          <p className="text-[var(--muted)]">No hay horarios libres este día. Prueba otro.</p>
        )}
      </section>

      {slot && (
        <form
          className="flex flex-col gap-5"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <h2 className="text-lg font-semibold [font-family:var(--heading)]">4. Tus datos</h2>
          <p className="rounded-[var(--rl)] bg-[var(--surface)] p-4 first-letter:uppercase">
            {services.find((s) => s.id === service)?.name} · {formatSlot(slot, tz)}
          </p>
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
          <label className={label}>
            Algo que debamos saber (opcional)
            <textarea maxLength={1000} rows={2} value={form.note} onChange={set("note")} className={`${input} py-3`} />
          </label>
          {error && (
            <p role="alert" className="text-sm text-[#d14343]">
              {error}
            </p>
          )}
          <button type="submit" disabled={pending} className={`${primary} self-start`}>
            {pending ? "Agendando…" : "Confirmar mi cita"}
          </button>
        </form>
      )}
      {error && !slot && (
        <p role="alert" className="text-sm text-[#d14343]">
          {error}
        </p>
      )}
    </div>
  );
}
