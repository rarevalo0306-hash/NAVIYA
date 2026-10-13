import { SubmitButton } from "@/components/submit-button";
import { requireBusiness } from "@/lib/business";
import { TIMEZONES, WEEKDAYS, bookingSettings } from "@/lib/booking";
import { addAppointment, saveBooking } from "./actions";
import { AppointmentStatus } from "./appointment-status";

const field = "min-h-11 rounded-[14px] border border-line bg-ink px-3 text-bone";
const box = "flex flex-col gap-4 rounded-[24px] border border-white/[0.06] bg-panel p-5";

// Agenda: las próximas citas y los horarios en que el negocio recibe citas en línea.
export default async function AgendaPage() {
  const { supabase, business } = await requireBusiness();
  const s = bookingSettings(business.booking, business.country_code);
  // eslint-disable-next-line react-hooks/purity -- página del servidor: se calcula en cada visita
  const since = new Date(Date.now() - 12 * 3600 * 1000).toISOString();
  const [{ data: appts }, { data: services }, { data: site }] = await Promise.all([
    supabase.from("appointments").select("*").eq("business_id", business.id).gte("starts_at", since).order("starts_at").limit(100),
    supabase.from("services").select("id, name").eq("business_id", business.id).eq("kind", "service").eq("active", true).order("sort"),
    supabase.from("websites").select("subdomain, status").eq("business_id", business.id).maybeSingle(),
  ]);
  const day = new Intl.DateTimeFormat("es", { weekday: "long", day: "numeric", month: "long", timeZone: s.tz });
  const hour = new Intl.DateTimeFormat("es", { hour: "numeric", minute: "2-digit", timeZone: s.tz });
  const groups = new Map<string, NonNullable<typeof appts>>();
  for (const a of appts ?? []) {
    const k = day.format(new Date(a.starts_at));
    groups.set(k, [...(groups.get(k) ?? []), a]);
  }
  const bookingUrl = site?.status === "published" && site.subdomain ? `/sitio/${site.subdomain}/agendar` : null;

  return (
    <div className="flex flex-col gap-8 pb-10">
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">Agenda</h1>
        <p className="max-w-2xl text-muted">
          {s.enabled
            ? "Tus clientes agendan solos en tu página, solo en los horarios libres."
            : "Activa las citas en línea abajo y tus clientes podrán agendar desde tu página."}
          {s.enabled && bookingUrl && (
            <>
              {" "}
              <a href={bookingUrl} target="_blank" className="font-semibold text-lime underline-offset-4 hover:underline">
                Ver mi página de citas →
              </a>
            </>
          )}
        </p>
      </div>

      <section className="flex flex-col gap-4" aria-labelledby="proximas">
        <h2 id="proximas" className="font-display text-2xl font-bold">
          Próximas citas
        </h2>
        {!groups.size && <p className="rounded-[24px] border border-dashed border-line p-8 text-center text-muted">No tienes citas próximas.</p>}
        {[...groups].map(([label, list]) => (
          <div key={label} className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted first-letter:uppercase">{label}</h3>
            <ul className="flex flex-col gap-2">
              {list.map((a) => {
                const digits = a.customer_phone?.replace(/\D/g, "");
                return (
                  <li key={a.id} className={`flex flex-wrap items-center justify-between gap-3 rounded-[20px] bg-panel p-4 ${a.status === "cancelled" ? "opacity-50" : ""}`}>
                    <div className="flex flex-col gap-0.5">
                      <span className="font-semibold">
                        {hour.format(new Date(a.starts_at))} · {a.title}
                      </span>
                      <span className="text-sm text-muted">
                        {a.customer_name ?? "Cliente"}
                        {digits && (
                          <>
                            {" · "}
                            <a href={`https://wa.me/${digits}`} target="_blank" rel="noopener" className="text-lime underline-offset-4 hover:underline">
                              WhatsApp {a.customer_phone}
                            </a>
                          </>
                        )}
                      </span>
                      {a.notes && <span className="text-sm text-muted">Nota: {a.notes}</span>}
                    </div>
                    <AppointmentStatus id={a.id} status={a.status} />
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </section>

      <details className={box}>
        <summary className="cursor-pointer text-lg font-semibold">+ Anotar una cita a mano</summary>
        <form action={addAppointment} className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm text-muted">
            Servicio
            <select name="service" className={field}>
              {(services ?? []).map((sv) => (
                <option key={sv.id} value={sv.id}>
                  {sv.name}
                </option>
              ))}
              <option value="">Otro</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm text-muted">
            Cliente
            <input name="name" required maxLength={120} className={field} />
          </label>
          <label className="flex flex-col gap-1 text-sm text-muted">
            Día
            <input name="date" type="date" required className={field} />
          </label>
          <label className="flex flex-col gap-1 text-sm text-muted">
            Hora
            <input name="time" type="time" required className={field} />
          </label>
          <label className="flex flex-col gap-1 text-sm text-muted">
            Teléfono (opcional)
            <input name="phone" type="tel" maxLength={40} className={field} />
          </label>
          <label className="flex flex-col gap-1 text-sm text-muted">
            Nota (opcional)
            <input name="notes" maxLength={1000} className={field} />
          </label>
          <SubmitButton pendingText="Guardando…" className="self-start">
            Guardar cita
          </SubmitButton>
        </form>
      </details>

      <form action={saveBooking} className={box}>
        <h2 className="font-display text-2xl font-bold">Horarios para citas</h2>
        <label className="flex items-center gap-3 text-lg font-semibold">
          <input type="checkbox" name="enabled" defaultChecked={s.enabled} className="size-5 accent-[var(--color-lime)]" />
          Recibir citas en línea en mi página
        </label>
        <div className="flex flex-col gap-2">
          {WEEKDAYS.map((name, d) => {
            const ranges = s.hours[String(d)] ?? [];
            return (
              <fieldset key={d} className="flex flex-wrap items-center gap-2 rounded-[16px] bg-panel-2 p-3">
                <legend className="sr-only">{name}</legend>
                <label className="flex w-32 items-center gap-2 font-semibold">
                  <input type="checkbox" name={`abre${d}`} defaultChecked={ranges.length > 0} className="size-5 accent-[var(--color-lime)]" />
                  {name}
                </label>
                {[0, 1].map((i) => (
                  <span key={i} className="flex items-center gap-1 text-sm text-muted">
                    {i === 1 && "y "}
                    <input type="time" name={`de${d}_${i}`} defaultValue={ranges[i]?.[0] ?? (i === 0 ? "09:00" : "")} aria-label={`${name}: desde`} className={field} />
                    a
                    <input type="time" name={`a${d}_${i}`} defaultValue={ranges[i]?.[1] ?? (i === 0 ? "17:00" : "")} aria-label={`${name}: hasta`} className={field} />
                  </span>
                ))}
              </fieldset>
            );
          })}
          <p className="text-sm text-muted">El segundo horario es opcional (por ejemplo, si cierras a mediodía).</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm text-muted">
            Cada cuánto empieza una cita
            <select name="slot" defaultValue={s.slot} className={field}>
              {[15, 20, 30, 45, 60, 90, 120].map((m) => (
                <option key={m} value={m}>
                  {m} minutos
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm text-muted">
            Citas al mismo tiempo (personas que atienden)
            <input name="capacity" type="number" min={1} max={20} defaultValue={s.capacity} className={field} />
          </label>
          <label className="flex flex-col gap-1 text-sm text-muted">
            Anticipación mínima (horas)
            <input name="noticeHours" type="number" min={0} max={168} defaultValue={s.noticeHours} className={field} />
          </label>
          <label className="flex flex-col gap-1 text-sm text-muted">
            Se puede agendar hasta (días adelante)
            <input name="advanceDays" type="number" min={1} max={180} defaultValue={s.advanceDays} className={field} />
          </label>
          <label className="flex flex-col gap-1 text-sm text-muted sm:col-span-2">
            Zona horaria
            <select name="tz" defaultValue={s.tz} className={field}>
              {[...new Set([s.tz, ...TIMEZONES])].map((tz) => (
                <option key={tz} value={tz}>
                  {tz.replace("America/", "").replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </label>
        </div>
        <p className="text-sm text-muted">Cada servicio dura lo que diga en «Lo que vendes» (si no dice, dura lo de arriba).</p>
        <SubmitButton pendingText="Guardando…" className="self-start">
          Guardar horarios
        </SubmitButton>
      </form>
    </div>
  );
}
