"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { kitPalette, marksFor, sanitizeKit, storedKit, storedOptions, type BrandKit } from "@/lib/brand";
import { proposeKits, writeBase } from "@/lib/brand-ai";
import { drawSymbols, recraftEnabled } from "@/lib/brand-recraft";
import { brandKitPrice, saveKit } from "@/lib/brand-store";
import { APP_URL } from "@/lib/app-url";
import { requireBusiness } from "@/lib/business";
import { stripe, stripeEnabled } from "@/lib/stripe";
import type { Json } from "@/lib/database.types";

const KINDS = ["logo", "photo"] as const;

// El navegador ya subió el archivo a la carpeta del negocio; aquí se registra.
export async function registerAsset(kind: string, storagePath: string) {
  const { supabase, user, business } = await requireBusiness();
  if (!KINDS.includes(kind as (typeof KINDS)[number])) throw new Error("Tipo de archivo no válido");
  if (!storagePath.startsWith(`${business.id}/`)) throw new Error("Ruta no válida");

  if (kind === "logo") {
    await supabase.from("brand_assets").delete().eq("business_id", business.id).eq("kind", "logo");
  }
  const { error } = await supabase
    .from("brand_assets")
    .insert({ business_id: business.id, kind, storage_path: storagePath });
  if (error) throw new Error(error.message);
  await supabase.from("audit_log").insert({
    business_id: business.id,
    actor: "owner",
    actor_user_id: user.id,
    action: "brand.asset_uploaded",
    data: { kind, storagePath },
  });
  revalidatePath("/onboarding/marca");
}

export async function removeAsset(id: string) {
  const { supabase, business } = await requireBusiness();
  const { data } = await supabase
    .from("brand_assets")
    .delete()
    .eq("id", id)
    .eq("business_id", business.id)
    .select("storage_path")
    .maybeSingle();
  if (data) await supabase.storage.from("brand-assets").remove([data.storage_path]);
  revalidatePath("/onboarding/marca");
}

const SOURCES = ["new", "keep_existing", "rebuild"] as const;

export async function saveBrand(formData: FormData) {
  const { supabase, user, business } = await requireBusiness();
  const source = String(formData.get("source") ?? "new");
  if (!SOURCES.includes(source as (typeof SOURCES)[number])) throw new Error("Opción no válida");
  const url = String(formData.get("existing_url") ?? "").trim().slice(0, 300) || null;

  const { error } = await supabase
    .from("websites")
    .upsert({ business_id: business.id, source, existing_url: source === "new" ? null : url });
  if (error) throw new Error(error.message);

  if (business.onboarding_step === "brand") {
    await supabase.from("businesses").update({ onboarding_step: "website" }).eq("id", business.id);
  }
  await supabase.from("audit_log").insert({
    business_id: business.id,
    actor: "owner",
    actor_user_id: user.id,
    action: "brand.website_choice",
    data: { source, url },
  });
  revalidatePath("/onboarding", "layout");
  redirect("/onboarding/web");
}

// ---------- Kit de marca ----------

// ---------- Símbolos dibujados por la IA (Recraft) ----------

const DAILY_DRAWINGS = 24; // tope de pedidos al día por negocio (cuida el costo)
const SYMBOLS_PER_PROPOSAL = 2;

type Supabase = Awaited<ReturnType<typeof requireBusiness>>["supabase"];

async function drawingsLeft(supabase: Supabase, businessId: string) {
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const { count } = await supabase
    .from("audit_log")
    .select("id", { count: "exact", head: true })
    .eq("business_id", businessId)
    .eq("action", "brand.ai_symbols")
    .gte("created_at", since);
  return DAILY_DRAWINGS - (count ?? 0);
}

// Si Nuna no escribió el encargo, se arma uno con el concepto de la propuesta.
const ideaFor = (kit: BrandKit, industry: string | null) =>
  kit.symbolIdea?.trim() ||
  `a clever, simple emblem for a ${industry || "local business"} (${marksFor(industry)[0]?.label ?? "geometric"} theme), ${
    ["using negative space", "built from bold geometric shapes", "with a hidden double meaning"][Math.abs(kit.name.length) % 3]
  }`;

async function draw(supabase: Supabase, userId: string, b: { id: string; industry: string | null }, kit: BrandKit, n: number) {
  if (!recraftEnabled() || (await drawingsLeft(supabase, b.id)) <= 0) return [];
  const p = kitPalette(kit);
  const symbols = await drawSymbols({ idea: ideaFor(kit, b.industry), industry: b.industry, colors: [p.primary, p.accent, p.dark], n });
  await supabase.from("audit_log").insert({
    business_id: b.id,
    actor: "nuna",
    actor_user_id: userId,
    action: "brand.ai_symbols",
    data: { requested: n, received: symbols.length, model: process.env.RECRAFT_MODEL || "recraftv4_1_vector" },
  });
  return symbols;
}

// Nuna propone 3 identidades de marca (gratis, para que el dueño las vea). Si está conectada la IA
// de dibujo, cada propuesta trae un símbolo único dibujado para este negocio.
export async function generateKits() {
  const { supabase, user, business } = await requireBusiness();
  const { data: services } = await supabase.from("services").select("name").eq("business_id", business.id).order("sort");
  // Los símbolos de las 3 propuestas se piden a la vez (si Recraft pide esperar, se reintenta con pausas).
  // 2 símbolos por propuesta en un solo pedido: el primero va en la propuesta, el otro queda como opción.
  const kits = await Promise.all(
    (await proposeKits(business, services ?? [])).map(async (kit): Promise<BrandKit> => {
      const symbols = await draw(supabase, user.id, business, kit, SYMBOLS_PER_PROPOSAL);
      return symbols.length ? { ...kit, mark: "ia", aiMark: symbols[0], aiChoices: symbols } : kit;
    }),
  );
  const { error } = await supabase
    .from("businesses")
    .update({ brand_options: kits as unknown as Json })
    .eq("id", business.id);
  if (error) throw new Error(error.message);
  await supabase.from("audit_log").insert({
    business_id: business.id,
    actor: "nuna",
    actor_user_id: user.id,
    action: "brand.kits_proposed",
    data: { kits: kits.map((k) => k.name) },
  });
  revalidatePath("/onboarding/marca");
}

// El dueño elige una propuesta: Nuna le escribe la base de marca completa (historia, misión,
// valores, voz y textos listos para usar).
export async function chooseKit(index: number) {
  const { supabase, user, business } = await requireBusiness();
  const option = storedOptions(business.brand_options, business)[index];
  if (!option) throw new Error("Propuesta no encontrada");
  const { data: services } = await supabase.from("services").select("name").eq("business_id", business.id).order("sort");
  const kit = { ...option, base: await writeBase(business, services ?? [], option, await ownerWords(supabase, business.id)) };
  await saveKit(supabase, business, kit, business.brand_status === "purchased" ? {} : { brand_status: "chosen" });
  await supabase.from("audit_log").insert({
    business_id: business.id,
    actor: "owner",
    actor_user_id: user.id,
    action: "brand.kit_chosen",
    data: { name: kit.name },
  });
  revalidatePath("/onboarding/marca");
}

// Dibujar más opciones de símbolo para la marca elegida.
export async function drawMoreSymbols() {
  const { supabase, user, business } = await requireBusiness();
  const current = storedKit(business.brand_kit, business);
  if (!current) throw new Error("Primero elige una propuesta");
  const symbols = await draw(supabase, user.id, business, current, 4);
  if (!symbols.length) throw new Error("No se pudieron dibujar símbolos ahora. Intenta más tarde.");
  await saveKit(supabase, business, { ...current, aiChoices: [...symbols, ...(current.aiChoices ?? [])].slice(0, 8) });
  revalidatePath("/onboarding/marca");
}

// Lo que el dueño contó en la entrevista, con sus palabras (lo más reciente si es muy largo).
async function ownerWords(supabase: Awaited<ReturnType<typeof requireBusiness>>["supabase"], businessId: string) {
  const { data } = await supabase.from("interview_messages").select("content").eq("business_id", businessId).eq("role", "owner").order("created_at");
  return (data ?? []).map((m) => `- ${m.content}`).join("\n").slice(-5000);
}

// Volver a escribir la base de marca (por ejemplo, después de cambiar el eslogan), con lo que el dueño pide cambiar.
export async function rewriteBase(formData?: FormData) {
  const { supabase, business } = await requireBusiness();
  const current = storedKit(business.brand_kit, business);
  if (!current) throw new Error("Primero elige una propuesta");
  const note = String(formData?.get("nota") ?? "").trim().slice(0, 600);
  const { data: services } = await supabase.from("services").select("name").eq("business_id", business.id).order("sort");
  await saveKit(supabase, business, { ...current, base: await writeBase(business, services ?? [], current, await ownerWords(supabase, business.id), note) });
  revalidatePath("/onboarding/marca");
  revalidatePath("/manual-de-marca");
}

// El dueño corrige a mano su base de marca (es una propuesta de Nuna, no un hecho).
export async function saveBaseEdits(formData: FormData) {
  const { supabase, business } = await requireBusiness();
  const current = storedKit(business.brand_kit, business);
  if (!current?.base) throw new Error("Primero elige una propuesta");
  const text = (k: string) => String(formData.get(k) ?? "").trim();
  // Valores: uno por renglón, «Nombre: qué significa».
  const values = text("values")
    .split("\n")
    .map((line) => line.split(":"))
    .filter(([name]) => name?.trim())
    .map(([name, ...rest]) => ({ name: name.trim(), text: rest.join(":").trim() }));
  const base = { ...current.base, story: text("story"), promise: text("promise"), mission: text("mission"), vision: text("vision"), audience: text("audience"), values };
  await saveKit(supabase, business, sanitizeKit({ ...current, base }, current));
  revalidatePath("/onboarding/marca");
  revalidatePath("/manual-de-marca");
}

// Ajustes del dueño (colores, letra, símbolo, forma, eslogan). Solo valores de las colecciones curadas.
export async function customizeKit(changes: Partial<BrandKit>) {
  const { supabase, business } = await requireBusiness();
  const current = storedKit(business.brand_kit, business);
  if (!current) throw new Error("Primero elige una propuesta");
  await saveKit(supabase, business, sanitizeKit({ ...current, ...changes }, current));
  revalidatePath("/onboarding/marca");
  revalidatePath("/manual-de-marca");
}

// Compra del kit completo. MODO PRUEBA: no se cobra nada hasta conectar Stripe (fase 3).
export async function purchaseKit() {
  const { supabase, user, business } = await requireBusiness();
  const kit = storedKit(business.brand_kit, business);
  if (!kit) throw new Error("Primero elige una propuesta");
  // Con Stripe activado se paga de verdad; el webhook marca la compra (lib/billing.ts).
  if (business.brand_status !== "purchased" && stripeEnabled()) {
    const session = await stripe<{ url: string }>("/checkout/sessions", {
      mode: "payment",
      line_items: [{ quantity: 1, price_data: { currency: "usd", unit_amount: Math.round(Number(brandKitPrice().replace(/[^\d.]/g, "")) * 100), product_data: { name: `Kit de marca · ${business.name}` } } }],
      customer_email: user.email ?? undefined,
      client_reference_id: business.id,
      metadata: { business_id: business.id, kind: "brand_kit" },
      success_url: `${APP_URL}/onboarding/marca?comprado=1#kit`,
      cancel_url: `${APP_URL}/onboarding/marca#kit`,
    });
    redirect(session.url);
  }
  if (business.brand_status !== "purchased") {
    const { error } = await supabase.rpc("purchase_brand_kit_test", { p_business: business.id });
    if (error) throw new Error(error.message);
    const { data: updated } = await supabase.from("businesses").select("*").eq("id", business.id).single();
    // Con la compra: logo PNG público (firma de email) y la marca aplicada a la página publicada.
    if (updated) await saveKit(supabase, updated, kit);
    await supabase.from("audit_log").insert({
      business_id: business.id,
      actor: "owner",
      actor_user_id: user.id,
      action: "brand.kit_purchased",
      data: { price: brandKitPrice(), test_mode: true, kit: kit.name },
    });
  }
  revalidatePath("/onboarding", "layout");
  redirect("/onboarding/marca?comprado=1#kit");
}
