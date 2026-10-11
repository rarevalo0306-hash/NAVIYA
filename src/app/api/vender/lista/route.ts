import { readPriceList } from "@/lib/catalog";
import type { BusinessRow } from "@/lib/interview";
import { createClient } from "@/lib/supabase/server";
import { underDailyLimit } from "@/lib/voice-ai";

// "Subir mi lista de precios": Nuna lee la foto o el PDF y devuelve los productos y servicios para revisar.
export const maxDuration = 120;

const MAX_BYTES = 4 * 1024 * 1024; // Vercel no recibe más de 4.5 MB (las fotos se achican en el navegador)
const TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];

export async function POST(request: Request) {
  if (!process.env.OPENAI_API_KEY) return Response.json({ error: "Leer listas no está disponible" }, { status: 404 });
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Inicia sesión" }, { status: 401 });
  const { data: b } = await supabase.from("businesses").select("*").order("created_at").limit(1).maybeSingle();
  if (!b) return Response.json({ error: "Sin negocio" }, { status: 404 });

  const file = (await request.formData().catch(() => null))?.get("archivo");
  if (!(file instanceof File)) return Response.json({ error: "No llegó el archivo" }, { status: 400 });
  if (!TYPES.includes(file.type)) return Response.json({ error: "Sube una foto (JPG, PNG) o un PDF." }, { status: 415 });
  if (file.size > MAX_BYTES) return Response.json({ error: "El archivo es muy grande (máximo 4 MB)." }, { status: 413 });
  if (!(await underDailyLimit(supabase, b.id, "catalog.ai"))) return Response.json({ error: "Llegaste al límite de ayudas de Nuna de hoy." }, { status: 429 });
  await supabase.from("audit_log").insert({ business_id: b.id, actor: "owner", actor_user_id: user.id, action: "catalog.ai", data: { what: "price_list" } });

  const items = await readPriceList(b as BusinessRow, { data: Buffer.from(await file.arrayBuffer()), mime: file.type, name: file.name.slice(0, 120) }).catch((e: unknown) => {
    console.error("Catálogo: no se pudo leer la lista", e);
    return null;
  });
  if (!items) return Response.json({ error: "No pude leer la lista. Intenta con una foto más clara." }, { status: 502 });
  return Response.json({ items });
}
