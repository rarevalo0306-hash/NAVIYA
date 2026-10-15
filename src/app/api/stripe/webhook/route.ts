import { markKitPurchased, syncSubscription } from "@/lib/billing";
import { stripe, validStripeSignature } from "@/lib/stripe";
import { adminEnabled } from "@/lib/supabase/admin";

// Avisos de Stripe: suscripciones (plan, prueba, pagos fallidos, cancelación) y el pago del kit de marca.
export const maxDuration = 60;

type Event = { type: string; data: { object: Record<string, unknown> } };

export async function POST(request: Request) {
  if (!adminEnabled()) return new Response("Sin configurar", { status: 503 });
  const payload = await request.text();
  if (!validStripeSignature(payload, request.headers.get("stripe-signature"))) return new Response("Firma inválida", { status: 400 });
  const event = JSON.parse(payload) as Event;
  const obj = event.data.object;
  try {
    if (event.type === "checkout.session.completed") {
      const meta = (obj.metadata ?? {}) as Record<string, string>;
      if (meta.kind === "brand_kit" && obj.payment_status === "paid" && meta.business_id) await markKitPurchased(meta.business_id, String(obj.id));
      if (obj.mode === "subscription" && typeof obj.subscription === "string") await syncSubscription(await stripe(`/subscriptions/${obj.subscription}`));
    } else if (event.type.startsWith("customer.subscription.")) {
      await syncSubscription(obj as never);
    }
  } catch (e) {
    console.error("Stripe webhook:", event.type, e);
    return new Response("Error", { status: 500 }); // Stripe reintenta
  }
  return Response.json({ received: true });
}
