"use server";

import { revalidatePath } from "next/cache";
import { requireBusiness } from "@/lib/business";

export type DomainState = { error?: string; ok?: boolean };

// El dueño escribe su dominio (o lo borra). Queda pendiente hasta que Orbusiness lo conecta.
export async function saveDomain(_prev: DomainState, formData: FormData): Promise<DomainState> {
  const { supabase, business } = await requireBusiness();
  const { error } = await supabase.rpc("request_custom_domain", { p_business: business.id, p_domain: String(formData.get("domain") ?? "") });
  if (error) {
    if (error.message.includes("taken")) return { error: "Ese dominio ya lo tiene otro negocio en Orbusiness. Si es tuyo, escríbenos." };
    if (error.message.includes("invalid")) return { error: "Escribe solo el dominio, por ejemplo: minegocio.com" };
    return { error: "No se pudo guardar. Intenta de nuevo." };
  }
  revalidatePath("/panel/conexiones");
  return { ok: true };
}

// "No tengo dominio": queda la solicitud para que Orbusiness se lo compre y conecte.
export async function requestDomainPurchase(formData: FormData) {
  const { supabase, user, business } = await requireBusiness();
  const wanted = String(formData.get("wanted") ?? "").trim().slice(0, 100);
  await supabase.from("audit_log").insert({ business_id: business.id, actor: "owner", actor_user_id: user.id, action: "domain.purchase_requested", data: { wanted } });
  revalidatePath("/panel/conexiones");
}
