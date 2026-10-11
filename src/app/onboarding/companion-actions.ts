"use server";

import { requireBusiness } from "@/lib/business";
import { companionReply, companionVoiceInstructions, isCompanionStep } from "@/lib/companion";
import { realtimeAgentSecret, realtimeEnabled, underDailyLimit } from "@/lib/voice-ai";

// Nuna acompañante: contestar por escrito y abrir la voz en cada paso del alta.

export async function askNuna(step: string, history: unknown, question: string): Promise<{ reply: string } | { error: string }> {
  const { supabase, user, business } = await requireBusiness();
  const q = String(question ?? "").trim().slice(0, 1000);
  if (!isCompanionStep(step) || !q) return { error: "No entendí la pregunta." };
  if (!(await underDailyLimit(supabase, business.id, "companion.ask"))) return { error: "Llegaste al límite de preguntas de hoy." };
  const past = (Array.isArray(history) ? history : [])
    .filter((m): m is { role: "owner" | "nuna"; text: string } => (m?.role === "owner" || m?.role === "nuna") && typeof m?.text === "string")
    .slice(-12)
    .map((m) => ({ role: m.role, text: m.text.slice(0, 1000) }));
  const reply = await companionReply(business, step, past, q).catch(() => null);
  if (!reply) return { error: "No pude contestar ahora. Intenta de nuevo." };
  await supabase.from("audit_log").insert({ business_id: business.id, actor: "owner", actor_user_id: user.id, action: "companion.ask", data: { step } });
  return { reply };
}

export async function startCompanionVoice(step: string): Promise<{ key: string } | { error: string }> {
  const { supabase, user, business } = await requireBusiness();
  if (!isCompanionStep(step) || !realtimeEnabled()) return { error: "Voz no disponible" };
  if (!(await underDailyLimit(supabase, business.id, "voice.realtime"))) return { error: "Límite de voz de hoy alcanzado" };
  const key = await realtimeAgentSecret({ instructions: companionVoiceInstructions(business, step), tools: [], prompt: "" }).catch(() => null);
  if (!key) return { error: "No se pudo iniciar la voz" };
  await supabase.from("audit_log").insert({ business_id: business.id, actor: "owner", actor_user_id: user.id, action: "voice.realtime", data: { engine: "openai", companion: step } });
  return { key };
}
