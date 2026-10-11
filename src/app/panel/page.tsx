import { redirect } from "next/navigation";
import { Button, Card } from "@/components/ui";
import { STEP_ROUTES, requireBusiness } from "@/lib/business";
import { addContact, moveContact } from "./actions";

const SOURCE_LABEL: Record<string, string> = { web: "Página web", manual: "Agregado a mano" };

export default async function PanelPage() {
  const { supabase, business } = await requireBusiness();
  if (business.onboarding_step !== "done") redirect(STEP_ROUTES[business.onboarding_step] ?? "/onboarding");

  const [{ data: stages }, { data: contacts }] = await Promise.all([
    supabase.from("pipeline_stages").select("id, name, position").eq("business_id", business.id).order("position"),
    supabase
      .from("contacts")
      .select("id, name, phone, email, interest, stage_id, source_channel, created_at")
      .eq("business_id", business.id)
      .order("created_at", { ascending: false }),
  ]);
  const columns = stages ?? [];
  const byStage = (id: string) => (contacts ?? []).filter((c) => c.stage_id === id);

  return (
    <>
      <div className="flex flex-col gap-1">
        <p className="text-muted">Hola{business.owner_name ? `, ${business.owner_name}` : ""}</p>
        <h1 className="font-display text-3xl font-bold tracking-tight">{business.name}</h1>
        <p className="text-muted">
          {(contacts ?? []).length} cliente(s) en tu CRM. Los que llenan el formulario de tu página aparecen aquí solos.
        </p>
      </div>

      <Card>
        <form action={addContact} className="grid gap-3 sm:grid-cols-[repeat(4,minmax(0,1fr))_auto] sm:items-end">
          <h2 className="font-semibold sm:col-span-5">Agregar un cliente</h2>
          {[
            ["name", "Nombre", "text", true],
            ["phone", "Teléfono", "tel", false],
            ["email", "Correo", "email", false],
            ["interest", "¿Qué necesita?", "text", false],
          ].map(([name, label, type, required]) => (
            <label key={name as string} className="flex flex-col gap-1 text-sm font-semibold text-muted">
              {label}
              <input
                name={name as string}
                type={type as string}
                required={required as boolean}
                className="min-h-11 rounded-xl border border-line bg-ink px-3 font-normal text-bone"
              />
            </label>
          ))}
          <Button type="submit">Agregar</Button>
        </form>
      </Card>

      {columns.length === 0 ? (
        <p className="text-muted">Tu CRM todavía no tiene etapas.</p>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {columns.map((stage, i) => {
            const next = columns[i + 1];
            const items = byStage(stage.id);
            return (
              <section key={stage.id} className="flex w-72 shrink-0 flex-col gap-3 rounded-2xl border border-line bg-panel p-3">
                <h2 className="flex items-center justify-between px-1 font-semibold">
                  {stage.name}
                  <span className="rounded-full bg-panel-2 px-2.5 text-sm text-muted">{items.length}</span>
                </h2>
                {items.map((c) => (
                  <article key={c.id} className="flex flex-col gap-1.5 rounded-xl bg-panel-2 p-3">
                    <p className="font-semibold">{c.name}</p>
                    {c.interest && <p className="text-sm">{c.interest}</p>}
                    <p className="text-xs text-muted">
                      {[c.phone, c.email].filter(Boolean).join(" · ")}
                      {c.source_channel ? ` · ${SOURCE_LABEL[c.source_channel] ?? c.source_channel}` : ""}
                    </p>
                    {next && (
                      <form action={moveContact.bind(null, c.id, next.id)}>
                        <button className="mt-1 min-h-10 w-full rounded-lg border border-line text-sm hover:bg-panel">
                          Mover a: {next.name}
                        </button>
                      </form>
                    )}
                  </article>
                ))}
              </section>
            );
          })}
        </div>
      )}
    </>
  );
}
