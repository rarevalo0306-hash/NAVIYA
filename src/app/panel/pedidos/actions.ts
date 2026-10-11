"use server";

import { revalidatePath } from "next/cache";
import { requireBusiness } from "@/lib/business";

const STATUSES = ["new", "confirmed", "paid", "delivered", "cancelled"] as const;

export async function setOrderStatus(id: string, status: string) {
  if (!STATUSES.includes(status as (typeof STATUSES)[number])) return;
  const { supabase, business } = await requireBusiness();
  await supabase.from("orders").update({ status, updated_at: new Date().toISOString() }).eq("id", id).eq("business_id", business.id);
  revalidatePath("/panel/pedidos");
}
