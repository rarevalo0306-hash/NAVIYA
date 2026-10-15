import { SubmitButton } from "@/components/submit-button";
import { requireBusiness } from "@/lib/business";
import { PLANS, TRIAL_DAYS, isPlan, stripeEnabled } from "@/lib/stripe";
import { managePlan } from "./actions";
import { PlanCards } from "./plan-cards";

const STATUS: Record<string, string> = {
  trialing: "Prueba gratis",
  active: "Activo",
  past_due: "Pago pendiente",
  unpaid: "Sin pagar",
  canceled: "Cancelado",
  incomplete: "Pago incompleto",
  incomplete_expired: "Pago vencido",
  paused: "En pausa",
};

// Mi plan: cuál tiene, cuándo se cobra, y el portal de Stripe para cambiar de plan, tarjeta o cancelar.
export default async function PlanPage(props: { searchParams: Promise<{ pago?: string }> }) {
  const { pago } = await props.searchParams;
  const { business } = await requireBusiness();
  const day = new Intl.DateTimeFormat("es", { day: "numeric", month: "long", year: "numeric" });
  const live = business.subscription_status === "trialing" || business.subscription_status === "active";

  return (
    <div className="flex flex-col gap-6 pb-10">
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">Mi plan</h1>
        {pago === "ok" && !business.subscription_status && <p className="text-lime">Confirmando tu pago… recarga en unos segundos.</p>}
      </div>

      {business.subscription_status && isPlan(business.plan) ? (
        <section className="flex flex-col gap-3 rounded-[24px] border border-white/[0.06] bg-panel p-6">
          <p className="text-muted">Tu plan</p>
          <p className="font-display text-3xl font-bold">
            {PLANS[business.plan].name} · ${PLANS[business.plan].price}/mes
          </p>
          <span className={`self-start rounded-full px-3 py-1 text-sm font-semibold ${live ? "bg-lime text-lime-ink" : "bg-[#ff8a8a] text-ink"}`}>
            {STATUS[business.subscription_status] ?? business.subscription_status}
          </span>
          {business.plan_renews_at && (
            <p className="text-muted">
              {business.subscription_status === "trialing" ? "Tu prueba termina y se hace el primer cobro el" : live ? "Próximo cobro:" : "Hasta:"}{" "}
              {day.format(new Date(business.plan_renews_at))}
            </p>
          )}
          {!live && <p>Actualiza tu forma de pago para que Nuna siga atendiendo a tus clientes.</p>}
          <form action={managePlan}>
            <SubmitButton pendingText="Abriendo…">Cambiar de plan, tarjeta o cancelar</SubmitButton>
          </form>
        </section>
      ) : stripeEnabled() ? (
        <>
          <p className="max-w-2xl text-muted">Elige tu plan. Pruébalo {TRIAL_DAYS} días gratis: hoy no se cobra nada y puedes cancelar cuando quieras antes del primer cobro.</p>
          <PlanCards from="panel" trial={!business.stripe_subscription_id} />
        </>
      ) : (
        <p className="text-muted">Los pagos se activan muy pronto. Mientras tanto, usas Orbusiness gratis.</p>
      )}
    </div>
  );
}
