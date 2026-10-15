import { redirect } from "next/navigation";
import { Button, Card, PageTitle } from "@/components/ui";
import { requireBusiness } from "@/lib/business";
import { TRIAL_DAYS, stripeEnabled } from "@/lib/stripe";
import { PlanCards } from "../../panel/plan/plan-cards";
import { activate } from "./actions";

const READY = [
  ["Página web con tienda y citas", "Tus clientes compran, piden cotización o agendan solos, y te llega todo a tu panel."],
  ["CRM", "Cada cliente queda guardado con su etapa, notas y próximo seguimiento."],
  ["Nuna", "Conoce tu negocio y atiende a tus clientes por mensajes."],
  ["Avisos", "Te avisamos por correo de cada pedido, cita o cliente que te necesita."],
];

export default async function ActivatePage(props: { searchParams: Promise<{ pago?: string }> }) {
  const { pago } = await props.searchParams;
  const { business } = await requireBusiness();
  if (["interview", "brand", "website", "crm"].includes(business.onboarding_step)) redirect("/onboarding/crm");
  const paid = business.subscription_status === "trialing" || business.subscription_status === "active";
  const needsPlan = stripeEnabled() && !paid;

  return (
    <>
      <PageTitle
        title="Tu negocio está listo"
        lead={needsPlan ? `Elige tu plan y empieza. Los primeros ${TRIAL_DAYS} días son gratis: hoy no se cobra nada.` : "Todo esto ya funciona. Entra a tu panel cuando quieras."}
      />
      <Card className="flex flex-col gap-3">
        <h2 className="font-semibold text-lime">Listo ✓</h2>
        {READY.map(([title, text]) => (
          <div key={title}>
            <p className="font-semibold">{title}</p>
            <p className="text-muted">{text}</p>
          </div>
        ))}
      </Card>
      {needsPlan ? (
        <>
          {pago === "ok" && <p className="text-lime">Confirmando tu pago… recarga la página en unos segundos.</p>}
          <PlanCards from="alta" trial={!business.stripe_subscription_id} />
        </>
      ) : (
        <form action={activate}>
          <Button type="submit">Ir a mi panel</Button>
        </form>
      )}
    </>
  );
}
