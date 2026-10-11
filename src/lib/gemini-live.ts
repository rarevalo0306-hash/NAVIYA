import "server-only";
import { Behavior, GoogleGenAI, Modality, StartSensitivity, Type, type FunctionDeclaration } from "@google/genai";

// Entrevista por voz con Gemini Live: Gemini escucha, piensa y habla en tiempo real (una sola IA).
// El navegador se conecta directo a Google con una llave temporal que crea el servidor; las
// instrucciones y herramientas quedan fijas en esa llave (el navegador no las puede cambiar).
// Lo que el dueño cuenta se guarda con la herramienta "anotar" (mismas validaciones de siempre).

const KEY = () => process.env.GEMINI_API_KEY?.trim() || "";
export const MODEL = () => process.env.GEMINI_LIVE_MODEL?.trim() || "gemini-3.8-live";
const VOICE = () => process.env.GEMINI_LIVE_VOICE?.trim() || "Aoede";
export const geminiLiveEnabled = () => Boolean(KEY()) && process.env.VOICE_ENGINE !== "openai";

const str = { type: Type.STRING };
const bool = { type: Type.BOOLEAN };
const TOOLS: FunctionDeclaration[] = [
  {
    name: "anotar",
    description:
      "Guarda los datos del negocio que el dueño acaba de decir o corregir. Llámala cada vez que diga algo nuevo; " +
      "manda solo lo nuevo. Devuelve qué datos faltan todavía.",
    behavior: Behavior.NON_BLOCKING,
    parameters: {
      type: Type.OBJECT,
      properties: {
        owner_name: { ...str, description: "Nombre de pila del dueño" },
        business_name: { ...str, description: "Nombre del negocio tal cual (puede estar en inglés)" },
        country: str,
        city: str,
        business_type: { type: Type.STRING, enum: ["products", "services", "both"] },
        industry: { ...str, description: "A qué se dedica" },
        services: {
          type: Type.ARRAY,
          description: "Lista completa de productos o servicios (precio solo si lo dijo)",
          items: { type: Type.OBJECT, properties: { name: str, price: { type: Type.NUMBER, nullable: true } }, required: ["name"] },
        },
        currency_choice: { type: Type.STRING, enum: ["local", "other", "both"] },
        hours: str,
        phone: str,
        address: str,
        lead_sources: { ...str, description: "Cómo le llegan los clientes" },
        visit_before_quote: bool,
        payment_timing: { type: Type.STRING, enum: ["before", "deposit", "after", "at_sale", "credit"] },
        payment_methods: { type: Type.ARRAY, items: str },
        offers_delivery: bool,
        has_recurring_clients: bool,
        address_form: { type: Type.STRING, enum: ["tu", "usted", "vos"] },
        quote_requires_approval: bool,
      },
    },
  },
  {
    name: "terminar_entrevista",
    description:
      "Termina la entrevista. Úsala solo cuando ya no falte ningún dato, ya le preguntaste si quiere agregar algo más y te dijo que no " +
      "(o ya lo anotaste), y ya te despediste.",
    behavior: Behavior.NON_BLOCKING,
  },
];

// Llave temporal (un solo uso, 1 minuto para conectarse, 30 para platicar) con todo fijo.
export async function geminiInterviewToken(instructions: string): Promise<{ token: string; model: string } | null> {
  const ai = new GoogleGenAI({ apiKey: KEY(), httpOptions: { apiVersion: "v1alpha" } });
  const now = Date.now();
  const token = await ai.authTokens.create({
    config: {
      uses: 1,
      expireTime: new Date(now + 30 * 60_000).toISOString(),
      newSessionExpireTime: new Date(now + 60_000).toISOString(),
      liveConnectConstraints: {
        model: MODEL(),
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: VOICE() } } },
          systemInstruction: instructions,
          tools: [{ functionDeclarations: TOOLS }],
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          // Ruido de fondo: cuesta más que lo tome como voz, y Gemini ignora lo que no le hablan a ella.
          realtimeInputConfig: {
            automaticActivityDetection: { startOfSpeechSensitivity: StartSensitivity.START_SENSITIVITY_LOW, silenceDurationMs: 700 },
          },
          proactivity: { proactiveAudio: true },
        },
      },
      httpOptions: { apiVersion: "v1alpha" },
    },
  });
  return token.name ? { token: token.name, model: MODEL() } : null;
}
