"use server";

import { redirect } from "next/navigation";
import { APP_URL } from "@/lib/app-url";
import { requireBusiness } from "@/lib/business";
import { TRIAL_DAYS, isPlan, planPrice, stripe, stripeEnabled } from "@/lib/stripe";

// Elegir plan (pago en la página segura de Stripe, 14 días de prueba con tarjeta) y administrarlo (portal de Stripe).

export async function startPlan(plan: string, from: "alta" | "panel" = "panel") {
  if (!isPlan(plan) || !stripeEnabled()) throw new Error("Los pagos todavía no están activados.");
  const { user, business } = await requireBusiness();
  const back = from === "alta" ? `${APP_URL}/onboarding/activar` : `${APP_URL}/panel/plan`;
  const session = await stripe<{ url: string }>("/checkout/sessions", {
    mode: "subscription",
    line_items: [{ price: await planPrice(plan), quantity: 1 }],
    ...(business.stripe_customer_id ? { customer: business.stripe_customer_id } : { customer_email: user.email ?? undefined }),
    client_reference_id: business.id,
    payment_method_collection: "always",
    allow_promotion_codes: true,
    subscription_data: {
      metadata: { business_id: business.id },
      // La prueba gratis es solo la primera vez.
      ...(business.stripe_subscription_id ? {} : { trial_period_days: TRIAL_DAYS }),
    },
    metadata: { business_id: business.id, kind: "plan" },
    success_url: `${back}?pago=ok`,
    cancel_url: back,
  });
  redirect(session.url);
}

export async function managePlan() {
  const { business } = await requireBusiness();
  if (!business.stripe_customer_id || !stripeEnabled()) redirect("/panel/plan");
  const portal = await stripe<{ url: string }>("/billing_portal/sessions", { customer: business.stripe_customer_id, return_url: `${APP_URL}/panel/plan` });
  redirect(portal.url);
}
