"use server";

import { redirect } from "next/navigation";
import { refreshPublishedSite } from "@/lib/brand-store";
import { requireBusiness } from "@/lib/business";
import { checkoutSettings } from "@/lib/checkout";
import type { Json } from "@/lib/database.types";

// Guarda cómo entrega y cobra la tienda, y lo aplica a su página publicada.
export async function saveCheckout(formData: FormData) {
  const { supabase, business } = await requireBusiness();
  const text = (k: string) => String(formData.get(k) ?? "");
  const amount = (v: string) => (v.trim() === "" ? NaN : Number(v.replace(",", ".")));
  // Tarifas: cada renglón "desde" + "envío". Un renglón sin "desde" cuenta desde 0.
  const froms = formData.getAll("from").map(String);
  const fees = formData.getAll("fee").map(String);
  const rates = fees
    .map((fee, i) => ({ from: amount(froms[i] ?? "") || 0, fee: amount(fee) }))
    .filter((r) => Number.isFinite(r.fee) && r.fee >= 0 && r.from >= 0);
  const settings = checkoutSettings(
    {
      delivery: formData.get("delivery") === "on",
      deliveryNote: text("deliveryNote"),
      rates,
      pickup: formData.get("pickup") === "on",
      pickupNote: text("pickupNote"),
      paymentNote: text("paymentNote"),
    },
    business.offers_delivery,
  );
  const { data: updated, error } = await supabase
    .from("businesses")
    .update({ checkout: settings as unknown as Json, offers_delivery: settings.delivery })
    .eq("id", business.id)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  await refreshPublishedSite(supabase, updated);
  redirect("/panel/vender");
}
