import { readAttachment } from "@/lib/nuna";
import { createClient } from "@/lib/supabase/server";
import { underDailyLimit } from "@/lib/voice-ai";

// Archivo que el dueño adjunta en la entrevista: se lee y se devuelve un resumen para la plática.
export const maxDuration = 60;

const MAX_BYTES = 4 * 1024 * 1024; // Vercel no recibe más de 4.5 MB (las fotos se achican en el navegador)
const TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];

export async function POST(request: Request) {
  if (!process.env.OPENAI_API_KEY) return Response.json({ error: "Leer archivos no está disponible" }, { status: 404 });
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Inicia sesión" }, { status: 401 });
  const { data: b } = await supabase.from("businesses").select("id").order("created_at").limit(1).maybeSingle();
  if (!b) return Response.json({ error: "Sin negocio" }, { status: 404 });

  const file = (await request.formData().catch(() => null))?.get("archivo");
  if (!(file instanceof File)) return Response.json({ error: "No llegó el archivo" }, { status: 400 });
  if (!TYPES.includes(file.type)) return Response.json({ error: "Sube una foto (JPG, PNG) o un PDF." }, { status: 415 });
  if (file.size > MAX_BYTES) return Response.json({ error: "El archivo es muy grande (máximo 4 MB)." }, { status: 413 });
  if (!(await underDailyLimit(supabase, b.id, "interview.attachment"))) return Response.json({ error: "Llegaste al límite de archivos de hoy." }, { status: 429 });

  const summary = await readAttachment({ data: Buffer.from(await file.arrayBuffer()), mime: file.type, name: file.name.slice(0, 120) }).catch((e: unknown) => {
    console.error("Entrevista: no se pudo leer el archivo", e);
    return null;
  });
  if (!summary) return Response.json({ error: "No pude leer el archivo. Intenta con una foto más clara." }, { status: 502 });
  await supabase.from("audit_log").insert({
    business_id: b.id,
    actor: "owner",
    actor_user_id: user.id,
    action: "interview.attachment",
    data: { name: file.name.slice(0, 120), type: file.type, size: file.size },
  });
  return Response.json({ summary: summary.slice(0, 2000) });
}
