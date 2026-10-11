"use server";

import { revalidatePath } from "next/cache";
import { requireBusiness } from "@/lib/business";
import { WINDOW_MS, sendWhatsApp, whatsappEnabled } from "@/lib/whatsapp";

// Interruptor general: Nuna contesta sola los WhatsApp nuevos.
export async function setNunaReplies(on: boolean) {
  const { supabase, business } = await requireBusiness();
  await supabase.from("businesses").update({ nuna_replies: on }).eq("id", business.id);
  revalidatePath("/panel/mensajes");
}

// En una plática: que la atienda Nuna, o el dueño (Nuna se calla).
export async function setConversationStatus(id: string, status: "nuna" | "owner" | "closed") {
  if (!["nuna", "owner", "closed"].includes(status)) return;
  const { supabase, business } = await requireBusiness();
  await supabase.from("conversations").update({ status }).eq("id", id).eq("business_id", business.id);
  revalidatePath("/panel/mensajes");
  revalidatePath(`/panel/mensajes/${id}`);
}

export type ReplyState = { error?: string; ok?: boolean };

// El dueño contesta desde el panel: sale por el WhatsApp del negocio y Nuna deja de contestar esa plática.
export async function sendOwnerReply(id: string, _prev: ReplyState, formData: FormData): Promise<ReplyState> {
  const text = String(formData.get("text") ?? "").trim().slice(0, 1600);
  if (!text) return { error: "Escribe tu respuesta." };
  const { supabase, business } = await requireBusiness();
  const { data: conv } = await supabase.from("conversations").select("id, channel, contacts(phone)").eq("id", id).eq("business_id", business.id).maybeSingle();
  if (!conv) return { error: "No encontramos esta plática." };
  const phone = (conv.contacts as unknown as { phone: string | null } | null)?.phone;
  if (conv.channel !== "whatsapp" || !phone) return { error: "Esta plática no es de WhatsApp: contesta por teléfono o correo." };
  const [{ data: line }, { data: last }] = await Promise.all([
    supabase.from("whatsapp_lines").select("number").eq("business_id", business.id).maybeSingle(),
    supabase.from("messages").select("created_at").eq("conversation_id", id).eq("author", "customer").order("created_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  if (!line || !whatsappEnabled()) return { error: "Tu WhatsApp todavía no está conectado." };
  if (!last || Date.now() - new Date(last.created_at).getTime() > WINDOW_MS) {
    return { error: "Pasaron más de 24 horas desde el último mensaje del cliente: WhatsApp no deja escribirle primero. Llámale o espera a que te escriba." };
  }
  let sid: string;
  try {
    sid = await sendWhatsApp(line.number, phone, text);
  } catch (e) {
    console.error("WhatsApp del dueño:", e);
    return { error: "No se pudo mandar. Intenta de nuevo." };
  }
  await supabase.from("messages").insert({ business_id: business.id, conversation_id: id, direction: "out", author: "owner", channel: "whatsapp", body: text, external_id: sid });
  await supabase.from("conversations").update({ status: "owner", last_message_at: new Date().toISOString() }).eq("id", id);
  revalidatePath(`/panel/mensajes/${id}`);
  return { ok: true };
}
