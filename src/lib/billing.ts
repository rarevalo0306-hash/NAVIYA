import "server-only";
import { storedKit } from "@/lib/brand";
import { brandKitPrice, saveKit } from "@/lib/brand-store";
import { createAdminClient } from "@/lib/supabase/admin";
import { PLANS, isPlan, type Plan } from "@/lib/stripe";

// Lo que llega de Stripe se guarda aquí (con la llave secreta: el dueño no puede cambiar su plan desde el navegador).

type Sub = {
  id: string;
  customer: string;
  status: string;
  metadata?: Record<string, string>;
  trial_end?: number | null;
  current_period_end?: number | null;
  items?: { data?: { current_period_end?: number; price?: { lookup_key?: string | null } }[] };
};

const planFromLookup = (key: string | null | undefined): Plan | null => (Object.entries(PLANS).find(([, p]) => p.lookup === key)?.[0] as Plan) ?? null;

export async function syncSubscription(sub: Sub) {
  const db = createAdminClient();
  let businessId = sub.metadata?.business_id ?? null;
  if (!businessId) {
    const { data } = await db.from("businesses").select("id").or(`stripe_subscription_id.eq.${sub.id},stripe_customer_id.eq.${sub.customer}`).limit(1).maybeSingle();
    businessId = data?.id ?? null;
  }
  if (!businessId) return console.error("Stripe: suscripción sin negocio", sub.id);
  const item = sub.items?.data?.[0];
  const ends = item?.current_period_end ?? sub.current_period_end ?? sub.trial_end ?? null;
  const plan = planFromLookup(item?.price?.lookup_key);
  const { error } = await db
    .from("businesses")
    .update({
      ...(isPlan(plan) ? { plan } : {}),
      subscription_status: sub.status,
      stripe_customer_id: sub.customer,
      stripe_subscription_id: sub.id,
      plan_renews_at: ends ? new Date(ends * 1000).toISOString() : null,
    })
    .eq("id", businessId);
  if (error) throw new Error(error.message);
  await db.from("audit_log").insert({ business_id: businessId, actor: "system", action: "billing.subscription_synced", data: { status: sub.status, plan } });
}

// Pagaron el kit de marca: se marca comprado y se genera el logo PNG público (firma de correo) y la página con la marca.
export async function markKitPurchased(businessId: string, sessionId: string) {
  const db = createAdminClient();
  const { data: b } = await db.from("businesses").select("*").eq("id", businessId).single();
  if (!b || b.brand_status === "purchased") return;
  const { data: updated, error } = await db
    .from("businesses")
    .update({ brand_status: "purchased", brand_purchased_at: new Date().toISOString() })
    .eq("id", businessId)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  const kit = storedKit(updated.brand_kit, updated);
  if (kit) await saveKit(db as never, updated, kit);
  await db.from("audit_log").insert({ business_id: businessId, actor: "system", action: "brand.kit_purchased", data: { price: brandKitPrice(), stripe_session: sessionId } });
}
