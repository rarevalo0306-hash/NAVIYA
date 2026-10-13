import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

// WhatsApp por Twilio (subcuenta Orbusiness): firmar/validar webhooks, mandar mensajes y bajar notas de voz.

const SID = () => process.env.TWILIO_ACCOUNT_SID?.trim() || "";
const TOKEN = () => process.env.TWILIO_AUTH_TOKEN?.trim() || "";
const auth = () => `Basic ${Buffer.from(`${SID()}:${TOKEN()}`).toString("base64")}`;
export const whatsappEnabled = () => Boolean(SID() && TOKEN());

// Twilio firma cada webhook: HMAC-SHA1 (con el Auth Token) de la URL + cada parámetro (nombre y valor) en orden alfabético.
export function twilioSignature(url: string, params: Record<string, string>) {
  const data = url + Object.keys(params).sort().map((k) => k + params[k]).join("");
  return createHmac("sha1", TOKEN()).update(data, "utf8").digest("base64");
}

export function validTwilioSignature(url: string, params: Record<string, string>, signature: string | null) {
  if (!signature) return false;
  const [a, b] = [Buffer.from(twilioSignature(url, params)), Buffer.from(signature)];
  return a.length === b.length && timingSafeEqual(a, b);
}

// WhatsApp solo deja escribir libremente hasta 24 h después del último mensaje del cliente; después, solo plantillas aprobadas.
// (Twilio acepta el envío y falla después, así que hay que revisarlo antes de mandar.)
export const WINDOW_MS = 24 * 3600 * 1000;

export async function sendWhatsApp(from: string, to: string, body: string, mediaUrl?: string) {
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${SID()}/Messages.json`, {
    method: "POST",
    headers: { Authorization: auth(), "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ From: `whatsapp:${from}`, To: `whatsapp:${to}`, Body: body.slice(0, 1600), ...(mediaUrl ? { MediaUrl: mediaUrl } : {}) }),
    signal: AbortSignal.timeout(15_000),
  });
  const json = (await res.json().catch(() => ({}))) as { sid?: string; code?: number; message?: string };
  if (!res.ok || !json.sid) throw new Error(`Twilio ${res.status} (${json.code ?? "?"}): ${json.message ?? ""}`);
  return json.sid;
}

// Archivos que manda el cliente (nota de voz, foto): Twilio pide la misma autorización para bajarlos.
export async function twilioMedia(url: string) {
  const res = await fetch(url, { headers: { Authorization: auth() }, signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new Error(`Twilio media ${res.status}`);
  return new Blob([await res.arrayBuffer()], { type: res.headers.get("content-type") ?? "application/octet-stream" });
}
