"use server";

import { revalidatePath } from "next/cache";
import { publicAssetUrl, requireBusiness } from "@/lib/business";
import { startVideo, videoEnabled, videoMonthlyLimit, videoStatus, writeVideoPrompt, type Aspect } from "@/lib/video";

// Videos de un producto (Seedance): pedir uno nuevo y revisar los que se están haciendo.

const BUCKET = "brand-assets";
const MAX_GENERATING = 2;
const GIVE_UP_MS = 20 * 60 * 1000; // si en 20 minutos no terminó, se marca como fallido

export type VideoRow = { id: string; status: string; aspect: string; seconds: number; url: string | null; error: string | null; created_at: string };

export async function videosLeft() {
  const { supabase, business } = await requireBusiness();
  const since = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
  // Los videos fallidos no cuentan.
  const { count } = await supabase.from("videos").select("id", { count: "exact", head: true }).eq("business_id", business.id).neq("status", "failed").gte("created_at", since);
  return Math.max(0, videoMonthlyLimit(business.plan) - (count ?? 0));
}

export async function makeVideo(serviceId: string, opts: { aspect: string; seconds: number; idea: string }): Promise<{ ok: true } | { error: string }> {
  if (!videoEnabled()) return { error: "Los videos con IA todavía no están activados." };
  const aspect: Aspect = opts.aspect === "1:1" ? "1:1" : "9:16";
  const seconds = opts.seconds === 10 ? 10 : 5;
  const idea = String(opts.idea ?? "").trim().slice(0, 300);
  const { supabase, user, business } = await requireBusiness();
  const { data: item } = await supabase.from("services").select("id, name, description, image_path").eq("id", serviceId).eq("business_id", business.id).maybeSingle();
  if (!item?.image_path) return { error: "Primero ponle una foto al producto." };
  if ((await videosLeft()) <= 0) return { error: `Ya usaste tus ${videoMonthlyLimit(business.plan)} videos de este mes.${business.plan === "pro" ? "" : " Con el plan Pro tienes 10."}` };
  const { count: busy } = await supabase.from("videos").select("id", { count: "exact", head: true }).eq("business_id", business.id).eq("status", "generating");
  if ((busy ?? 0) >= MAX_GENERATING) return { error: "Ya hay videos haciéndose. Espera a que terminen." };

  const prompt = await writeVideoPrompt(business, item, { aspect, seconds, idea });
  let predictionId: string;
  try {
    predictionId = await startVideo({ prompt, imageUrl: publicAssetUrl(item.image_path), aspect, seconds });
  } catch (e) {
    console.error("Video:", e);
    return { error: "No se pudo empezar el video. Intenta de nuevo en un momento." };
  }
  await supabase.from("videos").insert({ business_id: business.id, service_id: item.id, prompt, aspect, seconds, prediction_id: predictionId });
  await supabase.from("audit_log").insert({ business_id: business.id, actor: "owner", actor_user_id: user.id, action: "video.generate", data: { aspect, seconds, service: item.id } });
  revalidatePath(`/panel/vender/${serviceId}`);
  return { ok: true };
}

// Revisa los videos que se están haciendo; los terminados se copian a nuestro almacenamiento (el enlace de Replicate vence).
export async function refreshVideos(serviceId: string): Promise<VideoRow[]> {
  const { supabase, business } = await requireBusiness();
  const { data: rows } = await supabase.from("videos").select("*").eq("business_id", business.id).eq("service_id", serviceId).order("created_at", { ascending: false }).limit(12);
  for (const v of rows ?? []) {
    if (v.status !== "generating" || !v.prediction_id) continue;
    try {
      const s = await videoStatus(v.prediction_id);
      if (s.status === "ready" && s.url) {
        const mp4 = Buffer.from(await (await fetch(s.url, { signal: AbortSignal.timeout(120_000) })).arrayBuffer());
        const path = `${business.id}/videos/${v.id}.mp4`;
        const { error } = await supabase.storage.from(BUCKET).upload(path, mp4, { contentType: "video/mp4", upsert: true });
        if (error) throw new Error(error.message);
        Object.assign(v, { status: "ready", video_path: path });
      } else if (s.status === "failed" || Date.now() - new Date(v.created_at).getTime() > GIVE_UP_MS) {
        Object.assign(v, { status: "failed", error: s.error ?? "Tardó demasiado" });
      } else continue;
      await supabase.from("videos").update({ status: v.status, video_path: v.video_path, error: v.error }).eq("id", v.id);
    } catch (e) {
      console.error("Video (revisar):", e);
    }
  }
  return (rows ?? []).map((v) => ({
    id: v.id,
    status: v.status,
    aspect: v.aspect,
    seconds: v.seconds,
    url: v.video_path ? publicAssetUrl(v.video_path) : null,
    error: v.status === "failed" ? "No se pudo hacer este video. No se descontó de tus videos del mes." : null,
    created_at: v.created_at,
  }));
}
