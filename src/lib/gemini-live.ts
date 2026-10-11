import "server-only";
import { Behavior, GoogleGenAI, Modality, StartSensitivity, type FunctionDeclaration } from "@google/genai";
import { INTERVIEW_TOOLS } from "@/lib/interview-tools";

// Entrevista por voz con Gemini Live: Gemini escucha, piensa y habla en tiempo real (una sola IA).
// El navegador se conecta directo a Google con una llave temporal que crea el servidor; las
// instrucciones y herramientas quedan fijas en esa llave (el navegador no las puede cambiar).
// Lo que el dueño cuenta se guarda con la herramienta "anotar" (mismas validaciones de siempre).

const KEY = () => process.env.GEMINI_API_KEY?.trim() || "";
export const MODEL = () => process.env.GEMINI_LIVE_MODEL?.trim() || "gemini-3.8-live";
const VOICE = () => process.env.GEMINI_LIVE_VOICE?.trim() || "Aoede";
export const geminiLiveEnabled = () => Boolean(KEY()) && process.env.VOICE_ENGINE !== "openai";

const TOOLS: FunctionDeclaration[] = INTERVIEW_TOOLS.map((t) => ({
  name: t.name,
  description: t.description,
  behavior: Behavior.NON_BLOCKING,
  parametersJsonSchema: t.parameters,
}));

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
