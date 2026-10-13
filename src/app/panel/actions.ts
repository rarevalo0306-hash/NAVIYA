"use server";

import { revalidatePath } from "next/cache";
import { requireBusiness } from "@/lib/business";
import { marketFor, normalizePhone } from "@/lib/markets";

export async function addContact(formData: FormData) {
  const { supabase, user, business } = await requireBusiness();
  const value = (k: string, max: number) => String(formData.get(k) ?? "").trim().slice(0, max) || null;
  const name = value("name", 120);
  if (!name) return;

  const { data: first } = await supabase
    .from("pipeline_stages")
    .select("id")
    .eq("business_id", business.id)
    .order("position")
    .limit(1)
    .maybeSingle();
  const { data: contact, error } = await supabase
    .from("contacts")
    .insert({
      business_id: business.id,
      name,
      phone: (() => {
        const raw = value("phone", 40);
        return raw ? (normalizePhone(raw, marketFor(business.country_code)) ?? raw) : null;
      })(),
      email: value("email", 200)?.toLowerCase() ?? null,
      interest: value("interest", 200),
      source_channel: "manual",
      stage_id: first?.id ?? null,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  await supabase.from("audit_log").insert({
    business_id: business.id,
    actor: "owner",
    actor_user_id: user.id,
    action: "contact.created",
    entity: "contacts",
    entity_id: contact.id,
  });
  revalidatePath("/panel");
}

export async function moveContact(contactId: string, stageId: string) {
  const { supabase, user, business } = await requireBusiness();
  const { data: stage } = await supabase
    .from("pipeline_stages")
    .select("id, name")
    .eq("id", stageId)
    .eq("business_id", business.id)
    .maybeSingle();
  if (!stage) throw new Error("Etapa no válida");

  const { error } = await supabase
    .from("contacts")
    .update({ stage_id: stage.id })
    .eq("id", contactId)
    .eq("business_id", business.id);
  if (error) throw new Error(error.message);
  await supabase.from("audit_log").insert({
    business_id: business.id,
    actor: "owner",
    actor_user_id: user.id,
    action: "contact.stage_changed",
    entity: "contacts",
    entity_id: contactId,
    data: { stage: stage.name },
  });
  revalidatePath("/panel");
}

// Nota y próximo seguimiento de un cliente.
export async function updateContact(contactId: string, formData: FormData) {
  const { supabase, business } = await requireBusiness();
  const notes = String(formData.get("notes") ?? "").trim().slice(0, 2000) || null;
  const date = String(formData.get("follow_up_on") ?? "");
  await supabase
    .from("contacts")
    .update({ notes, follow_up_on: /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null })
    .eq("id", contactId)
    .eq("business_id", business.id);
  revalidatePath("/panel");
}
