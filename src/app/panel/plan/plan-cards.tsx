import { SubmitButton } from "@/components/submit-button";
import { PLANS, TRIAL_DAYS, type Plan } from "@/lib/stripe";
import { startPlan } from "./actions";

// Los dos planes de Orbusiness, con el botón para pagar en Stripe.
export function PlanCards({ from, trial, current }: { from: "alta" | "panel"; trial: boolean; current?: string | null }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {(Object.keys(PLANS) as Plan[]).map((key) => {
        const p = PLANS[key];
        const isPro = key === "pro";
        return (
          <section key={key} className={`flex flex-col gap-4 rounded-[24px] border p-6 ${isPro ? "border-lime/60 bg-panel" : "border-white/[0.06] bg-panel"}`}>
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="font-display text-2xl font-bold">{p.name}</h2>
              {isPro && <span className="rounded-full bg-lime px-3 py-1 text-xs font-semibold text-lime-ink">Recomendado</span>}
            </div>
            <p>
              <span className="font-display text-4xl font-bold">${p.price}</span> <span className="text-muted">al mes</span>
            </p>
            <ul className="flex flex-col gap-2">
              {p.features.map((f) => (
                <li key={f} className="flex gap-2">
                  <span aria-hidden className="text-lime">
                    ✓
                  </span>
                  {f}
                </li>
              ))}
            </ul>
            {current === key ? (
              <p className="mt-auto font-semibold text-lime">Tu plan actual</p>
            ) : (
              <form action={startPlan.bind(null, key, from)} className="mt-auto">
                <SubmitButton pendingText="Abriendo el pago seguro…" className="w-full">
                  {trial ? `Empezar ${TRIAL_DAYS} días gratis` : `Elegir ${p.name}`}
                </SubmitButton>
              </form>
            )}
          </section>
        );
      })}
    </div>
  );
}
