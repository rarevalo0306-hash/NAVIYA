import "server-only";
import type { createClient } from "@/lib/supabase/server";

// Voz con IA de OpenAI: Nuna habla con voz natural (texto a voz) y entiende lo que dice el dueño
// (voz a texto). Sin OPENAI_API_KEY la entrevista usa la voz del navegador.
// Costo aproximado: US$0.015 por minuto de voz de Nuna y US$0.0045 por minuto transcrito.

type Supabase = Awaited<ReturnType<typeof createClient>>;

const BASE = () => process.env.OPENAI_BASE_URL?.trim() || "https://api.openai.com/v1";
const KEY = () => process.env.OPENAI_API_KEY?.trim() || "";
export const aiVoiceEnabled = () => Boolean(KEY());

const TTS_MODEL = () => process.env.OPENAI_TTS_MODEL?.trim() || "gpt-4o-mini-tts";
const TTS_VOICE = () => process.env.OPENAI_TTS_VOICE?.trim() || "marin";
const STT_MODEL = () => process.env.OPENAI_STT_MODEL?.trim() || "gpt-transcribe";

// Límites diarios por negocio, para que nadie use la voz sin control (cada uso queda en audit_log).
export const DAILY_LIMIT = { "voice.tts": 400, "voice.stt": 300, "voice.realtime": 30 } as const;

export async function underDailyLimit(supabase: Supabase, businessId: string, action: keyof typeof DAILY_LIMIT) {
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const { count } = await supabase
    .from("audit_log")
    .select("id", { count: "exact", head: true })
    .eq("business_id", businessId)
    .eq("action", action)
    .gte("created_at", since);
  return (count ?? 0) < DAILY_LIMIT[action];
}

// Cómo debe sonar Nuna.
function voiceInstructions(country: string | null) {
  return (
    `Habla en español latinoamericano neutro${country ? `, cercano al de ${country}` : " (como una presentadora mexicana)"}; ` +
    "nunca con acento de España ni acento estadounidense (solo los nombres propios en inglés se dicen en inglés). " +
    "Eres Nuna, una asesora de negocios: voz joven, cálida y con energía, como una mujer de unos 30 años que sonríe al hablar. " +
    "Ritmo ágil y conversacional, entonación expresiva. Nada de tono de locutora, de robot ni de lectura lenta."
  );
}

// Devuelve la respuesta de OpenAI tal cual, para que el audio empiece a sonar mientras llega.
export async function synthesize(text: string, country: string | null): Promise<Response> {
  return fetch(`${BASE()}/audio/speech`, {
    method: "POST",
    headers: { Authorization: `Bearer ${KEY()}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: TTS_MODEL(),
      voice: TTS_VOICE(),
      input: text,
      instructions: voiceInstructions(country),
      response_format: "mp3",
    }),
    signal: AbortSignal.timeout(60_000),
  });
}

// Texto de lo que dijo el dueño. `prompt` da contexto (nombre del negocio, la pregunta) para que
// escriba bien nombres y palabras locales.
export async function transcribe(audio: Blob, filename: string, prompt: string): Promise<string | null> {
  const model = STT_MODEL();
  const form = new FormData();
  form.append("file", audio, filename);
  form.append("model", model);
  if (model === "gpt-transcribe") ["es", "en"].forEach((l) => form.append("languages[]", l));
  else form.append("language", "es");
  if (prompt && !model.includes("diarize")) form.append("prompt", prompt.slice(0, 800));
  form.append("response_format", "json");
  const res = await fetch(`${BASE()}/audio/transcriptions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${KEY()}` },
    body: form,
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) {
    console.error("OpenAI transcripción respondió", res.status, (await res.text()).slice(0, 300));
    return null;
  }
  const json = (await res.json()) as { text?: string };
  return json.text?.trim() ?? null;
}

// ---------- Voz en tiempo real (OpenAI Realtime) ----------
// El navegador habla directo con OpenAI por WebRTC usando una llave temporal que crea el servidor.
// La IA de tiempo real es solo la VOZ de Nuna: lee exactamente lo que escribe Nuna (DeepSeek) y
// transcribe lo que dice el dueño; nunca responde por su cuenta. Así la entrevista sigue igual.

const REALTIME_MODEL = () => process.env.OPENAI_REALTIME_MODEL?.trim() || "gpt-realtime-2.1";
const REALTIME_VOICE = () => process.env.OPENAI_REALTIME_VOICE?.trim() || TTS_VOICE();
const REALTIME_TRANSCRIBE = () => process.env.OPENAI_REALTIME_TRANSCRIBE?.trim() || "gpt-4o-transcribe";
export const realtimeEnabled = () => aiVoiceEnabled() && process.env.OPENAI_REALTIME !== "off";

function realtimeInstructions(country: string | null) {
  return (
    "Eres SOLO la voz de Nuna, una asesora de negocios. Nunca respondas ni converses por tu cuenta. " +
    "Cuando te pidan leer un texto, léelo en voz alta EXACTAMENTE como está, palabra por palabra, sin agregar, quitar ni cambiar nada, en el idioma del texto. " +
    `En español, usa SIEMPRE acento latinoamericano neutro${country ? `, cercano al de ${country}` : " (como una presentadora mexicana)"}, ` +
    "nunca de España ni estadounidense: " +
    "voz joven, cálida y con energía, como una mujer de unos 30 años que sonríe al hablar; ritmo ágil y conversacional, " +
    "entonación expresiva y humana. Nada de tono de locutora, de robot ni de lectura lenta."
  );
}

// Llave temporal para que el navegador se conecte (vence en pocos minutos si no se usa).
async function clientSecret(session: Record<string, unknown>) {
  const res = await fetch(`${BASE()}/realtime/client_secrets`, {
    method: "POST",
    headers: { Authorization: `Bearer ${KEY()}`, "Content-Type": "application/json" },
    body: JSON.stringify({ session: { type: "realtime", model: REALTIME_MODEL(), output_modalities: ["audio"], ...session } }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) {
    console.error("OpenAI realtime respondió", res.status, (await res.text()).slice(0, 400));
    return null;
  }
  const json = (await res.json()) as { value?: string };
  return json.value ?? null;
}

const transcription = (prompt: string) => ({ model: REALTIME_TRANSCRIBE(), ...(prompt ? { prompt: prompt.slice(0, 800) } : {}) });

// Solo voz: lee lo que escribe Nuna (DeepSeek) y transcribe al dueño.
export function realtimeClientSecret(opts: { country: string | null; prompt: string }) {
  return clientSecret({
    instructions: realtimeInstructions(opts.country),
    audio: {
      input: {
        // Sin idioma fijo: casi siempre español, pero el dueño puede pedir inglés.
        transcription: transcription(opts.prompt),
        // Detecta cuándo el dueño terminó de hablar, pero la IA no contesta sola (lo hace Nuna) ni se
        // calla sola: la interrupción la decide el navegador, para que un ruido corto no la corte.
        turn_detection: { type: "semantic_vad", create_response: false, interrupt_response: false, eagerness: "medium" },
        noise_reduction: { type: "near_field" },
      },
      output: { voice: REALTIME_VOICE(), speed: 1.05 },
    },
  });
}

// Todo en uno: OpenAI escucha, piensa y habla (lleva la entrevista con las reglas de Nuna) y anota
// con las herramientas. Instrucciones y herramientas quedan fijas en la llave.
export function realtimeAgentSecret(opts: { instructions: string; tools: { name: string; description: string; parameters: unknown }[]; prompt: string }) {
  return clientSecret({
    instructions: opts.instructions,
    tools: opts.tools.map((t) => ({ type: "function", ...t })),
    tool_choice: "auto",
    audio: {
      input: {
        transcription: transcription(opts.prompt),
        turn_detection: { type: "semantic_vad", create_response: true, interrupt_response: true, eagerness: "medium" },
        noise_reduction: { type: "near_field" },
      },
      output: { voice: REALTIME_VOICE() },
    },
  });
}
