import { after } from "next/server";
import { adminEnabled } from "@/lib/supabase/admin";
import { validTwilioSignature, whatsappEnabled } from "@/lib/whatsapp";
import { handleIncoming } from "@/lib/whatsapp-inbox";

// Twilio avisa aquí cada mensaje de WhatsApp que llega a un número de Orbusiness.
// Se contesta a Twilio al instante y Nuna trabaja después (Twilio espera máximo 15 s).
export const maxDuration = 60;

export async function POST(request: Request) {
  if (!whatsappEnabled() || !adminEnabled()) return new Response("WhatsApp no está configurado", { status: 503 });
  const form = await request.formData();
  const params = Object.fromEntries([...form.entries()].map(([k, v]) => [k, String(v)]));
  // La firma se calcula con la URL pública exacta que tiene Twilio.
  const url = process.env.TWILIO_WEBHOOK_URL?.trim() || request.url;
  if (!validTwilioSignature(url, params, request.headers.get("x-twilio-signature"))) {
    console.error("WhatsApp: firma de Twilio inválida para", url);
    return new Response("Firma inválida", { status: 403 });
  }
  after(() => handleIncoming(params).catch((e) => console.error("WhatsApp entrante:", e)));
  return new Response("<Response/>", { headers: { "Content-Type": "text/xml" } });
}
