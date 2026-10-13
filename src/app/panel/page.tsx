import Link from "next/link";
import { redirect } from "next/navigation";
import { Button, Card } from "@/components/ui";
import { bookingSettings, zonedToUtc } from "@/lib/booking";
import { STEP_ROUTES, requireBusiness } from "@/lib/business";
import { addContact, updateContact } from "./actions";
import { StageSelect } from "./stage-select";

const SOURCE_LABEL: Record<string, string> = { web: "Página web", manual: "Agregado a mano", whatsapp: "WhatsApp" };

// Clientes: lo de hoy arriba (quién te necesita, pedidos, citas, seguimientos) y el camino de tus clientes por etapas.
// Simple a propósito: buscar, cambiar de etapa, escribirles, una nota y la fecha del próximo seguimiento.
export default async function PanelPage(props: { searchParams: Promise<{ q?: string }> }) {
  const { q = "" } = await props.searchParams;
  const { supabase, business } = await requireBusiness();
  if (business.onboarding_step !== "done") redirect(STEP_ROUTES[business.onboarding_step] ?? "/onboarding");

  const tz = bookingSettings(business.booking, business.country_code).tz;
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(new Date());
  const term = q.trim().replace(/[%,()]/g, " ").slice(0, 60);
  let contactsQuery = supabase
    .from("contacts")
    .select("id, name, phone, email, interest, stage_id, source_channel, notes, follow_up_on, created_at")
    .eq("business_id", business.id)
    .order("created_at", { ascending: false })
    .limit(300);
  if (term) contactsQuery = contactsQuery.or(`name.ilike.%${term}%,phone.ilike.%${term}%,email.ilike.%${term}%`);

  const [{ data: stages }, { data: contacts }, needs, newOrders, todayAppts, followUps] = await Promise.all([
    supabase.from("pipeline_stages").select("id, name, position").eq("business_id", business.id).order("position"),
    contactsQuery,
    supabase.from("conversations").select("id", { count: "exact", head: true }).eq("business_id", business.id).eq("status", "needs_owner"),
    supabase.from("orders").select("id", { count: "exact", head: true }).eq("business_id", business.id).eq("status", "new"),
    supabase
      .from("appointments")
      .select("id", { count: "exact", head: true })
      .eq("business_id", business.id)
      .eq("status", "scheduled")
      .gte("starts_at", zonedToUtc(today, "00:00", tz))
      .lt("starts_at", new Date(new Date(zonedToUtc(today, "00:00", tz)).getTime() + 86_400_000).toISOString()),
    supabase.from("contacts").select("id", { count: "exact", head: true }).eq("business_id", business.id).lte("follow_up_on", today),
  ]);
  const columns = stages ?? [];
  const byStage = (id: string) => (contacts ?? []).filter((c) => c.stage_id === id);
  const day = new Intl.DateTimeFormat("es", { day: "numeric", month: "short", timeZone: "UTC" });

  const todayCards = [
    { label: "Te necesitan en mensajes", n: needs.count ?? 0, href: "/panel/mensajes" },
    { label: "Pedidos nuevos", n: newOrders.count ?? 0, href: "/panel/pedidos" },
    { label: "Citas de hoy", n: todayAppts.count ?? 0, href: "/panel/agenda" },
    { label: "Seguimientos para hoy", n: followUps.count ?? 0, href: "#etapas" },
  ];

  return (
    <>
      <div className="flex flex-col gap-1">
        <p className="text-muted">Hola{business.owner_name ? `, ${business.owner_name}` : ""}</p>
        <h1 className="font-display text-3xl font-bold tracking-tight">{business.name}</h1>
      </div>

      <section aria-label="Hoy" className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {todayCards.map((c) => (
          <Link key={c.label} href={c.href} className={`flex flex-col gap-1 rounded-[20px] p-4 transition hover:bg-panel-2 ${c.n ? "bg-panel ring-1 ring-lime/40" : "bg-panel"}`}>
            <span className={`font-display text-3xl font-bold ${c.n ? "text-lime" : "text-muted"}`}>{c.n}</span>
            <span className="text-sm text-muted">{c.label}</span>
          </Link>
        ))}
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <form className="flex min-w-0 flex-1 gap-2" role="search">
          <label htmlFor="buscar" className="sr-only">
            Buscar cliente
          </label>
          <input
            id="buscar"
            name="q"
            defaultValue={q}
            placeholder="Buscar por nombre, teléfono o correo"
            className="min-h-11 min-w-0 flex-1 rounded-xl border border-line bg-ink px-3 text-bone"
          />
          <Button type="submit">Buscar</Button>
        </form>
        {q && (
          <Link href="/panel" className="min-h-11 content-center text-sm text-muted underline underline-offset-4">
            Ver todos
          </Link>
        )}
      </div>

      <details className="group">
        <summary className="min-h-11 cursor-pointer content-center font-semibold text-lime">+ Agregar un cliente</summary>
        <Card className="mt-3">
          <form action={addContact} className="grid gap-3 sm:grid-cols-[repeat(4,minmax(0,1fr))_auto] sm:items-end">
            {[
              ["name", "Nombre", "text", true],
              ["phone", "Teléfono", "tel", false],
              ["email", "Correo", "email", false],
              ["interest", "¿Qué necesita?", "text", false],
            ].map(([name, label, type, required]) => (
              <label key={name as string} className="flex flex-col gap-1 text-sm font-semibold text-muted">
                {label}
                <input name={name as string} type={type as string} required={required as boolean} className="min-h-11 rounded-xl border border-line bg-ink px-3 font-normal text-bone" />
              </label>
            ))}
            <Button type="submit">Agregar</Button>
          </form>
        </Card>
      </details>

      {columns.length === 0 ? (
        <p className="text-muted">Tu CRM todavía no tiene etapas.</p>
      ) : (
        <div id="etapas" className="flex scroll-mt-6 gap-4 overflow-x-auto pb-4">
          {columns.map((stage) => {
            const items = byStage(stage.id);
            return (
              <section key={stage.id} className="flex w-72 shrink-0 flex-col gap-3 rounded-2xl border border-line bg-panel p-3">
                <h2 className="flex items-center justify-between px-1 font-semibold">
                  {stage.name}
                  <span className="rounded-full bg-panel-2 px-2.5 text-sm text-muted">{items.length}</span>
                </h2>
                {items.map((c) => {
                  const digits = c.phone?.replace(/\D/g, "");
                  const due = c.follow_up_on && c.follow_up_on <= today;
                  return (
                    <article key={c.id} className={`flex flex-col gap-2 rounded-xl bg-panel-2 p-3 ${due ? "ring-1 ring-lime/60" : ""}`}>
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-semibold">{c.name}</p>
                        {digits && (
                          <a href={`https://wa.me/${digits}`} target="_blank" rel="noopener" aria-label={`WhatsApp a ${c.name}`} className="shrink-0 text-sm font-semibold text-lime">
                            WhatsApp
                          </a>
                        )}
                      </div>
                      {c.interest && <p className="text-sm">{c.interest}</p>}
                      <p className="text-xs text-muted">
                        {[c.phone, c.email].filter(Boolean).join(" · ")}
                        {c.source_channel ? ` · ${SOURCE_LABEL[c.source_channel] ?? c.source_channel}` : ""}
                      </p>
                      {c.follow_up_on && <p className={`text-xs font-semibold ${due ? "text-lime" : "text-muted"}`}>Seguimiento: {day.format(new Date(`${c.follow_up_on}T12:00:00Z`))}</p>}
                      <StageSelect contactId={c.id} stageId={stage.id} stages={columns} />
                      <details>
                        <summary className="cursor-pointer text-sm text-muted">{c.notes ? "Nota y seguimiento" : "+ Nota o seguimiento"}</summary>
                        <form action={updateContact.bind(null, c.id)} className="mt-2 flex flex-col gap-2">
                          <textarea
                            name="notes"
                            defaultValue={c.notes ?? ""}
                            rows={3}
                            maxLength={2000}
                            aria-label={`Nota de ${c.name}`}
                            className="rounded-lg border border-line bg-ink px-2 py-1.5 text-sm text-bone"
                          />
                          <label className="flex items-center justify-between gap-2 text-xs text-muted">
                            Próximo seguimiento
                            <input type="date" name="follow_up_on" defaultValue={c.follow_up_on ?? ""} className="min-h-9 rounded-lg border border-line bg-ink px-2 text-bone" />
                          </label>
                          <button className="min-h-10 rounded-lg border border-line text-sm hover:bg-panel">Guardar</button>
                        </form>
                      </details>
                    </article>
                  );
                })}
              </section>
            );
          })}
        </div>
      )}
    </>
  );
}
