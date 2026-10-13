"use server";

import { revalidatePath } from "next/cache";
import { refreshPublishedSite } from "@/lib/brand-store";
import { requireBusiness } from "@/lib/business";
import { COMPANION_TOOLS, companionReply, companionVoiceInstructions, isCompanionStep } from "@/lib/companion";
import { QUESTIONS, describeAnswer, type BusinessRow } from "@/lib/interview";
import { FactsSchema } from "@/lib/nuna";
import { realtimeAgentSecret, realtimeEnabled, underDailyLimit } from "@/lib/voice-ai";
import { voiceSave } from "./entrevista/actions";

// Nuna acompañante: contestar por escrito, platicar por voz y corregir los datos del negocio en cualquier paso del alta.

type Ctx = Awaited<ReturnType<typeof requireBusiness>>;

// Lo que Nuna sabe hoy del negocio (lo mismo que se ve en la entrevista).
async function knownFacts({ supabase, business }: Ctx) {
  const { data: services } = await supabase.from("services").select("name, price").eq("business_id", business.id).eq("active", true).order("sort");
  const list = (services ?? []).map((s) => ({ name: s.name, price: s.price === null ? null : Number(s.price) }));
  return QUESTIONS.map((q) => [q.label, describeAnswer(q.key, business, list, true)] as const)
    .filter(([, v]) => v)
    .map(([l, v]) => `${l}: ${v}`);
}

// Guarda lo que el dueño corrigió (sin tocar productos ni servicios) y actualiza su página si ya está publicada.
async function saveCorrections(ctx: Ctx, raw: unknown) {
  const parsed = FactsSchema.safeParse(raw);
  if (!parsed.success) return [];
  const facts = { ...parsed.data, services: null };
  if (!Object.values(facts).some((v) => v !== null)) return [];
  const { filled } = await voiceSave(facts, []);
  if (filled.length) {
    const { data: updated } = await ctx.supabase.from("businesses").select("*").eq("id", ctx.business.id).single();
    await refreshPublishedSite(ctx.supabase, (updated ?? ctx.business) as BusinessRow);
    revalidatePath("/onboarding", "layout");
  }
  return filled;
}

export async function askNuna(step: string, history: unknown, question: string): Promise<{ reply: string } | { error: string }> {
  const ctx = await requireBusiness();
  const { supabase, user, business } = ctx;
  const q = String(question ?? "").trim().slice(0, 1000);
  if (!isCompanionStep(step) || !q) return { error: "No entendí la pregunta." };
  if (!(await underDailyLimit(supabase, business.id, "companion.ask"))) return { error: "Llegaste al límite de preguntas de hoy." };
  const past = (Array.isArray(history) ? history : [])
    .filter((m): m is { role: "owner" | "nuna"; text: string } => (m?.role === "owner" || m?.role === "nuna") && typeof m?.text === "string")
    .slice(-12)
    .map((m) => ({ role: m.role, text: m.text.slice(0, 1000) }));
  const out = await companionReply(business, step, await knownFacts(ctx), past, q).catch(() => null);
  if (!out?.reply.trim()) return { error: "No pude contestar ahora. Intenta de nuevo." };
  await saveCorrections(ctx, out.facts);
  await supabase.from("audit_log").insert({ business_id: business.id, actor: "owner", actor_user_id: user.id, action: "companion.ask", data: { step } });
  return { reply: out.reply.trim() };
}

export async function startCompanionVoice(step: string): Promise<{ key: string } | { error: string }> {
  const ctx = await requireBusiness();
  const { supabase, user, business } = ctx;
  if (!isCompanionStep(step) || !realtimeEnabled()) return { error: "Voz no disponible" };
  if (!(await underDailyLimit(supabase, business.id, "voice.realtime"))) return { error: "Límite de voz de hoy alcanzado" };
  const instructions = companionVoiceInstructions(business, step, await knownFacts(ctx));
  const key = await realtimeAgentSecret({ instructions, tools: COMPANION_TOOLS, prompt: "" }).catch(() => null);
  if (!key) return { error: "No se pudo iniciar la voz" };
  await supabase.from("audit_log").insert({ business_id: business.id, actor: "owner", actor_user_id: user.id, action: "voice.realtime", data: { engine: "openai", companion: step } });
  return { key };
}

// Al pasar a otro paso con la voz abierta: instrucciones nuevas para la misma plática (no se corta).
export async function companionInstructions(step: string): Promise<string | null> {
  const ctx = await requireBusiness();
  return isCompanionStep(step) ? companionVoiceInstructions(ctx.business, step, await knownFacts(ctx)) : null;
}

// Herramienta «anotar» de la voz.
export async function companionSave(args: unknown): Promise<Record<string, unknown>> {
  const filled = await saveCorrections(await requireBusiness(), args);
  return filled.length ? { ok: true, guardado: filled } : { ok: false, nota: "No cambió nada: confirma con el dueño qué dato quiere cambiar." };
}
