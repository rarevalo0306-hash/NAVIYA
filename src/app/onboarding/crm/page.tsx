import { redirect } from "next/navigation";
import { Button, Card, PageTitle } from "@/components/ui";
import { requireBusiness } from "@/lib/business";
import { fieldsFor, stagesFor } from "@/lib/crm";
import { createCrm } from "./actions";

export default async function CrmSetupPage(props: PageProps<"/onboarding/crm">) {
  const { supabase, business } = await requireBusiness();
  const query = await props.searchParams;
  if (["interview", "brand", "website"].includes(business.onboarding_step)) redirect("/onboarding/web");

  const stages = stagesFor(business);
  const { count } = await supabase
    .from("pipeline_stages")
    .select("id", { count: "exact", head: true })
    .eq("business_id", business.id);
  const created = (count ?? 0) > 0;

  return (
    <>
      <PageTitle
        title={`Un CRM a la medida de cómo trabajas${business.owner_name ? `, ${business.owner_name}` : ""}`}
        lead="Nuna convirtió lo que le contaste en etapas y tareas. Si algo no cuadra, corrige tu respuesta en la entrevista y vuelve aquí."
      />

      {query.publicada && (
        <p role="status" className="text-lime">
          ¡Tu página quedó publicada! Ahora armamos tu CRM.
        </p>
      )}

      <Card className="flex flex-col gap-4">
        <h2 className="font-semibold">El camino de tus clientes</h2>
        <ol className="flex flex-wrap items-center gap-2">
          {stages.map((s, i) => (
            <li key={s.key} className="flex items-center gap-2">
              <span className={`rounded-full px-4 py-2 text-sm font-semibold ${i === 0 ? "bg-lime text-lime-ink" : "bg-panel-2"}`}>
                {s.name}
              </span>
              {i < stages.length - 1 && <span aria-hidden="true" className="text-muted">→</span>}
            </li>
          ))}
        </ol>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="flex flex-col gap-3">
          <h2 className="font-semibold">Datos de cada cliente</h2>
          <ul className="flex list-disc flex-col gap-1.5 pl-5 text-muted">
            {fieldsFor(business).map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
        </Card>
        <Card className="flex flex-col gap-3">
          <h2 className="font-semibold">Lo que Nuna hará en cada etapa</h2>
          <ul className="flex flex-col gap-2.5">
            {stages.map((s) => (
              <li key={s.key}>
                <span className="font-semibold">{s.name}:</span>{" "}
                <span className="text-muted">{s.automations.join(". ")}.</span>
              </li>
            ))}
          </ul>
          <p className="text-sm text-muted">
            Las respuestas automáticas por SMS, email y WhatsApp se encienden en la fase 2. Por ahora el CRM ya recibe los
            clientes que llenan el formulario de tu página.
          </p>
        </Card>
      </div>

      <form action={createCrm}>
        <Button type="submit">{created ? "Actualizar mi CRM" : "Aprobar y crear mi CRM"}</Button>
      </form>
    </>
  );
}
