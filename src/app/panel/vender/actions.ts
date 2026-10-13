"use server";

import { revalidatePath } from "next/cache";
import { refreshPublishedSite } from "@/lib/brand-store";
import { publicAssetUrl, requireBusiness } from "@/lib/business";
import { MAX_ITEMS, describeItem, fixPhoto, parseVariants, recraftEnabled, removeBackground, type Kind, type ListItem, type PriceMode } from "@/lib/catalog";
import { underDailyLimit } from "@/lib/voice-ai";

// "Lo que vendes" en el panel: productos y servicios con foto, descripción y variantes.
// Todo cambio actualiza solo la página web publicada.

type Ctx = Awaited<ReturnType<typeof requireBusiness>>;
const BUCKET = "brand-assets";

async function done(ctx: Ctx) {
  await refreshPublishedSite(ctx.supabase, ctx.business);
  revalidatePath("/panel/vender");
  revalidatePath("/onboarding/web");
}

// Solo archivos de la carpeta del propio negocio.
const ownPath = (ctx: Ctx, path: unknown): path is string =>
  typeof path === "string" && path.startsWith(`${ctx.business.id}/`) && !path.includes("..");

async function download(ctx: Ctx, path: string) {
  const { data, error } = await ctx.supabase.storage.from(BUCKET).download(path);
  if (error || !data) throw new Error("No se encontró la foto");
  return Buffer.from(await data.arrayBuffer());
}

async function upload(ctx: Ctx, data: Buffer) {
  const path = `${ctx.business.id}/productos/${crypto.randomUUID()}.jpg`;
  const { error } = await ctx.supabase.storage.from(BUCKET).upload(path, data, { contentType: "image/jpeg" });
  if (error) throw new Error(error.message);
  return path;
}

async function aiAllowed(ctx: Ctx, what: string) {
  if (!(await underDailyLimit(ctx.supabase, ctx.business.id, "catalog.ai"))) return false;
  await ctx.supabase.from("audit_log").insert({ business_id: ctx.business.id, actor: "owner", actor_user_id: ctx.user.id, action: "catalog.ai", data: { what } });
  return true;
}

type Photo = { path: string; url: string } | { error: string };

// El navegador ya subió la foto original; aquí se arregla (recorte cuadrado, luz, nitidez).
export async function preparePhoto(originalPath: string): Promise<Photo> {
  const ctx = await requireBusiness();
  if (!ownPath(ctx, originalPath)) return { error: "Foto no válida" };
  try {
    const path = await upload(ctx, await fixPhoto(await download(ctx, originalPath)));
    return { path, url: publicAssetUrl(path) };
  } catch {
    return { error: "No pude arreglar la foto. Intenta con otra." };
  }
}

// Quita el fondo (a partir de la original, que tiene más calidad) y deja el producto sobre blanco.
export async function cleanBackground(originalPath: string): Promise<Photo> {
  const ctx = await requireBusiness();
  if (!recraftEnabled() || !ownPath(ctx, originalPath)) return { error: "Quitar el fondo no está disponible" };
  if (!(await aiAllowed(ctx, "background"))) return { error: "Llegaste al límite de ayudas de Nuna de hoy." };
  try {
    const path = await upload(ctx, await removeBackground(await download(ctx, originalPath)));
    return { path, url: publicAssetUrl(path) };
  } catch (e) {
    console.error("Catálogo: no se pudo quitar el fondo", e);
    return { error: "No pude quitar el fondo de esta foto. Intenta con otra donde el producto se vea completo." };
  }
}

// Nuna escribe la descripción con lo que dijo el dueño (y mira la foto, si hay).
export async function writeDescription(input: { kind: Kind; name: string; notes: string; photoPath?: string | null }) {
  const ctx = await requireBusiness();
  if (!(await aiAllowed(ctx, "description"))) return { error: "Llegaste al límite de ayudas de Nuna de hoy." };
  const photo = ownPath(ctx, input.photoPath) ? await download(ctx, input.photoPath).catch(() => null) : null;
  const out = await describeItem(ctx.business, {
    kind: input.kind === "product" ? "product" : "service",
    name: String(input.name ?? "").slice(0, 80),
    notes: String(input.notes ?? "").slice(0, 1500),
    photo,
  }).catch((e: unknown) => {
    console.error("Catálogo: no se pudo escribir la descripción", e);
    return null;
  });
  return out ?? { error: "No pude escribir la descripción ahora. Intenta de nuevo." };
}

export type ItemInput = {
  id?: string | null;
  kind: Kind;
  name: string;
  priceMode: PriceMode;
  price: string;
  description: string;
  category: string;
  variants: string;
  duration: string; // minutos de la cita (solo servicios)
  active: boolean;
  imagePath: string | null;
  originalPath: string | null;
  discard?: string[]; // fotos que se subieron en el formulario y no se usaron
};

const money = (raw: string) => {
  const n = Number(String(raw ?? "").replace(/[^\d.,]/g, "").replace(/,/g, ""));
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null;
};

export async function saveItem(input: ItemInput): Promise<{ id: string } | { error: string }> {
  const ctx = await requireBusiness();
  const name = String(input.name ?? "").trim().replace(/\s+/g, " ").slice(0, 80);
  if (!name) return { error: "Ponle un nombre." };
  const priceMode: PriceMode = (["fixed", "from", "quote"] as const).includes(input.priceMode) ? input.priceMode : "fixed";
  const price = priceMode === "quote" ? null : money(input.price);
  if (priceMode !== "quote" && price === null) return { error: "Ponle el precio, o elige «A cotizar»." };
  const row = {
    kind: input.kind === "product" ? ("product" as const) : ("service" as const),
    name,
    price,
    price_mode: priceMode,
    description: String(input.description ?? "").trim().slice(0, 1500) || null,
    category: String(input.category ?? "").trim().slice(0, 60) || null,
    variants: parseVariants(String(input.variants ?? "")),
    duration_minutes: input.kind === "service" && Number(input.duration) >= 5 ? Math.min(600, Math.round(Number(input.duration))) : null,
    active: Boolean(input.active),
    image_path: ownPath(ctx, input.imagePath) ? input.imagePath : null,
    image_original_path: ownPath(ctx, input.originalPath) ? input.originalPath : null,
    updated_at: new Date().toISOString(),
  };

  let id = input.id ?? null;
  if (id) {
    const { data: old } = await ctx.supabase.from("services").select("image_path, image_original_path").eq("id", id).eq("business_id", ctx.business.id).maybeSingle();
    if (!old) return { error: "No se encontró." };
    const { error } = await ctx.supabase.from("services").update(row).eq("id", id).eq("business_id", ctx.business.id);
    if (error) return { error: "No se pudo guardar." };
    // Las fotos que ya no se usan se borran.
    const unused = [old.image_path, old.image_original_path].filter((p): p is string => Boolean(p) && p !== row.image_path && p !== row.image_original_path);
    if (unused.length) await ctx.supabase.storage.from(BUCKET).remove(unused);
  } else {
    const { data: current } = await ctx.supabase.from("services").select("sort").eq("business_id", ctx.business.id);
    if ((current?.length ?? 0) >= MAX_ITEMS) return { error: `Puedes tener hasta ${MAX_ITEMS} productos y servicios.` };
    const sort = Math.max(-1, ...(current ?? []).map((s) => s.sort ?? 0)) + 1;
    const { data, error } = await ctx.supabase.from("services").insert({ business_id: ctx.business.id, sort, ...row }).select("id").single();
    if (error || !data) return { error: "No se pudo guardar." };
    id = data.id;
  }
  const discard = (Array.isArray(input.discard) ? input.discard : []).filter((p) => ownPath(ctx, p) && p !== row.image_path && p !== row.image_original_path).slice(0, 10);
  if (discard.length) await ctx.supabase.storage.from(BUCKET).remove(discard);
  await done(ctx);
  return { id };
}

export async function deleteItem(id: string) {
  const ctx = await requireBusiness();
  const { data } = await ctx.supabase.from("services").delete().eq("id", id).eq("business_id", ctx.business.id).select("image_path, image_original_path").maybeSingle();
  const files = [data?.image_path, data?.image_original_path].filter((p): p is string => Boolean(p));
  if (files.length) await ctx.supabase.storage.from(BUCKET).remove(files);
  await done(ctx);
}

export async function setItemActive(id: string, active: boolean) {
  const ctx = await requireBusiness();
  await ctx.supabase.from("services").update({ active, updated_at: new Date().toISOString() }).eq("id", id).eq("business_id", ctx.business.id);
  await done(ctx);
}

// Productos y servicios que Nuna leyó de la lista de precios y el dueño confirmó.
export async function addItems(items: ListItem[]): Promise<{ added: number } | { error: string }> {
  const ctx = await requireBusiness();
  const { data: current } = await ctx.supabase.from("services").select("sort").eq("business_id", ctx.business.id);
  const room = MAX_ITEMS - (current?.length ?? 0);
  let sort = Math.max(-1, ...(current ?? []).map((s) => s.sort ?? 0)) + 1;
  const rows = (Array.isArray(items) ? items : [])
    .map((i) => {
      const price = typeof i?.price === "number" && i.price > 0 ? Math.round(i.price * 100) / 100 : null;
      // Sin precio, va «a cotizar»; con precio, «desde» si la lista lo decía, si no precio fijo.
      const priceMode: PriceMode = price === null ? "quote" : i?.price_mode === "from" ? "from" : "fixed";
      return {
        business_id: ctx.business.id,
        kind: i?.kind === "service" ? ("service" as const) : ("product" as const),
        name: String(i?.name ?? "").trim().slice(0, 80),
        price,
        price_mode: priceMode,
        description: String(i?.description ?? "").trim().slice(0, 1500) || null,
        category: String(i?.category ?? "").trim().slice(0, 60) || null,
      };
    })
    .filter((r) => r.name)
    .slice(0, Math.max(0, room))
    .map((r) => ({ ...r, sort: sort++ }));
  if (!rows.length) return { error: room > 0 ? "No hay nada que agregar." : `Ya tienes el máximo de ${MAX_ITEMS}.` };
  const { error } = await ctx.supabase.from("services").insert(rows);
  if (error) return { error: "No se pudieron agregar." };
  await done(ctx);
  return { added: rows.length };
}
