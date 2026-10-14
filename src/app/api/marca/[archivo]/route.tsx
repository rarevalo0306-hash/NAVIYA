import { storedKit } from "@/lib/brand";
import { bookPage, brandFile, brandZip, parseFile } from "@/lib/brand-files";
import { brandCtx } from "@/lib/brand-store";
import { publicAssetUrl } from "@/lib/business";
import { slugify } from "@/lib/site";
import { createClient } from "@/lib/supabase/server";

// Descargas del kit de marca. Solo para el dueño, y solo si ya compró el kit.
export const maxDuration = 120;

// Vercel no deja responder más de 4.5 MB: los archivos grandes (el .zip, algunos PSD) se suben
// a la carpeta del negocio y se redirige a ellos.
const DIRECT_LIMIT = 4 * 1024 * 1024;

export async function GET(request: Request, ctx: RouteContext<"/api/marca/[archivo]">) {
  const { archivo } = await ctx.params;
  const parsed = parseFile(archivo);
  if (!parsed) return new Response("No encontrado", { status: 404 });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("Inicia sesión", { status: 401 });
  const { data: b } = await supabase.from("businesses").select("*").order("created_at").limit(1).maybeSingle();
  const kit = b ? storedKit(b.brand_kit, b) : null;
  if (!b || !kit) return new Response("Todavía no eliges tu kit de marca", { status: 404 });
  if (b.brand_status !== "purchased") return new Response("Compra tu kit de marca para descargarlo", { status: 402 });

  const host = request.headers.get("host") ?? "naviya.app";
  const c = await brandCtx(supabase, b, kit, host);
  if (typeof parsed === "object" && "page" in parsed) {
    const page = await bookPage(c, parsed.page);
    if (!page) return new Response("No encontrado", { status: 404 });
    return new Response(new Uint8Array(page.data), { headers: { "Content-Type": page.type, "Cache-Control": "private, max-age=300" } });
  }
  const file = parsed === "zip" ? await brandZip(c) : await brandFile(c, parsed.item, parsed.format);
  const filename = `${slugify(b.name)}-${archivo}`;
  const inline = new URL(request.url).searchParams.has("ver");

  if (file.data.length > DIRECT_LIMIT) {
    // Se borra la descarga grande anterior y se sube la nueva.
    const { data: old } = await supabase.storage.from("brand-assets").list(b.id, { search: "descarga-" });
    if (old?.length) await supabase.storage.from("brand-assets").remove(old.map((o) => `${b.id}/${o.name}`));
    const path = `${b.id}/descarga-${crypto.randomUUID()}-${filename}`;
    const { error } = await supabase.storage.from("brand-assets").upload(path, file.data, { contentType: file.type });
    if (error) return new Response("No se pudo preparar la descarga. Intenta de nuevo.", { status: 500 });
    return Response.redirect(`${publicAssetUrl(path)}?download=${encodeURIComponent(filename)}`, 303);
  }

  return new Response(new Uint8Array(file.data), {
    headers: {
      "Content-Type": file.type,
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
