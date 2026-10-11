import { realtimeClientSecret, realtimeEnabled, underDailyLimit } from "@/lib/voice-ai";
import { createClient } from "@/lib/supabase/server";

// Llave temporal para conversar por voz en tiempo real con OpenAI (solo para el dueño con sesión).
export async function POST() {
  if (!realtimeEnabled()) return Response.json({ error: "Voz en tiempo real no configurada" }, { status: 404 });
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Inicia sesión" }, { status: 401 });
  const { data: b } = await supabase.from("businesses").select("id, name, industry, zone, owner_name, country").order("created_at").limit(1).maybeSingle();
  if (!b) return Response.json({ error: "Sin negocio" }, { status: 404 });
  if (!(await underDailyLimit(supabase, b.id, "voice.realtime"))) return Response.json({ error: "Límite de voz de hoy alcanzado" }, { status: 429 });

  // Solo palabras clave: con frases completas, cuando solo hay ruido el transcriptor "escucha" el
  // propio prompt (pasó: llegó "Entrevista en español..." y "Florida Flooring Solutions" como respuestas).
  const prompt = [b.owner_name, b.name !== "Mi negocio" && b.name, b.industry, b.zone].filter(Boolean).join(", ");
  const key = await realtimeClientSecret({ country: b.country, prompt }).catch(() => null);
  if (!key) return Response.json({ error: "No se pudo iniciar la voz" }, { status: 502 });
  await supabase.from("audit_log").insert({ business_id: b.id, actor: "owner", actor_user_id: user.id, action: "voice.realtime", data: {} });
  return Response.json({ key }, { headers: { "Cache-Control": "no-store" } });
}
