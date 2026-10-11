"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { refreshPublishedSite, siteContentFor } from "@/lib/brand-store";
import { SITE_TEMPLATES } from "@/lib/site-templates";
import { requireBusiness } from "@/lib/business";
import { slugify } from "@/lib/site";

export async function publishWebsite() {
  const { supabase, user, business } = await requireBusiness();

  const [content, { data: website }] = await Promise.all([
    siteContentFor(supabase, business),
    supabase.from("websites").select("subdomain").eq("business_id", business.id).maybeSingle(),
  ]);

  // Dirección temporal: orbusiness.site/sitio/<nombre>. Si ya existe, se le agrega un número.
  const base = website?.subdomain ?? slugify(business.name);
  let subdomain = base;
  for (let attempt = 1; attempt <= 20; attempt++) {
    const { error } = await supabase.from("websites").upsert({
      business_id: business.id,
      subdomain,
      content,
      status: "published",
      published_at: new Date().toISOString(),
    });
    if (!error) break;
    if (error.code !== "23505") throw new Error(error.message); // 23505 = dirección ocupada
    subdomain = `${base}-${attempt + 1}`;
  }

  await supabase
    .from("businesses")
    .update({ slug: subdomain, ...(business.onboarding_step === "website" ? { onboarding_step: "crm" } : {}) })
    .eq("id", business.id);
  await supabase.from("audit_log").insert({
    business_id: business.id,
    actor: "owner",
    actor_user_id: user.id,
    action: "website.published",
    data: { subdomain },
  });
  revalidatePath("/onboarding", "layout");
  revalidatePath(`/sitio/${subdomain}`);
  // La primera vez sigue solo al siguiente paso (CRM); si ya iba más adelante, se queda aquí.
  redirect(business.onboarding_step === "website" ? "/onboarding/crm?publicada=1" : "/onboarding/web?publicada=1");
}

// El dueño elige el diseño de su página. Si ya está publicada, se actualiza al momento.
export async function chooseTemplate(template: string) {
  const { supabase, business } = await requireBusiness();
  if (!SITE_TEMPLATES.some((t) => t.id === template)) throw new Error("Diseño no válido");
  const { error } = await supabase.from("websites").upsert({ business_id: business.id, template });
  if (error) throw new Error(error.message);
  await refreshPublishedSite(supabase, business);
  revalidatePath("/onboarding/web");
}

// Productos o servicios que salen en la página (la entrevista guarda los primeros; aquí se completan).
export async function addService(formData: FormData) {
  const { supabase, business } = await requireBusiness();
  const name = String(formData.get("name") ?? "").trim().replace(/\s+/g, " ").slice(0, 80);
  const rawPrice = String(formData.get("price") ?? "").replace(/[^\d.,]/g, "").replace(/,/g, "");
  const price = rawPrice && Number.isFinite(Number(rawPrice)) && Number(rawPrice) > 0 ? Math.round(Number(rawPrice) * 100) / 100 : null;
  if (!name) return;
  const { data: current } = await supabase.from("services").select("sort").eq("business_id", business.id);
  if ((current?.length ?? 0) >= 40) return;
  const sort = Math.max(-1, ...(current ?? []).map((s) => s.sort ?? 0)) + 1;
  const { error } = await supabase.from("services").insert({ business_id: business.id, name, price, sort });
  if (error) throw new Error(error.message);
  await refreshPublishedSite(supabase, business);
  revalidatePath("/onboarding/web");
}

export async function removeService(id: string) {
  const { supabase, business } = await requireBusiness();
  const { error } = await supabase.from("services").delete().eq("id", id).eq("business_id", business.id);
  if (error) throw new Error(error.message);
  await refreshPublishedSite(supabase, business);
  revalidatePath("/onboarding/web");
}
