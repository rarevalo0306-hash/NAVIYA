import Link from "next/link";
import { notFound } from "next/navigation";
import { publicAssetUrl, requireBusiness } from "@/lib/business";
import { recraftEnabled, variantsText } from "@/lib/catalog";
import { videoEnabled } from "@/lib/video";
import { aiVoiceEnabled } from "@/lib/voice-ai";
import { ItemForm } from "../item-form";
import { refreshVideos, videosLeft } from "../video-actions";
import { VideoPanel } from "./video-panel";

// Agregar ("nuevo") o editar un producto o servicio.
export default async function ItemPage(props: { params: Promise<{ id: string }>; searchParams: Promise<{ tipo?: string }> }) {
  const [{ id }, { tipo }] = await Promise.all([props.params, props.searchParams]);
  const { supabase, business } = await requireBusiness();
  const { data: rows } = await supabase.from("services").select("*").eq("business_id", business.id);
  const item = id === "nuevo" ? null : (rows ?? []).find((r) => r.id === id);
  if (id !== "nuevo" && !item) notFound();
  const kind = item?.kind ?? (tipo === "servicio" || business.business_type === "services" ? "service" : "product");
  const categories = [...new Set((rows ?? []).map((r) => r.category).filter((c): c is string => Boolean(c)))];

  return (
    <div className="flex flex-col gap-6 pb-10">
      <Link href="/panel/vender" className="min-h-11 content-center self-start text-sm text-muted underline underline-offset-4 hover:text-bone">
        ← Lo que vendes
      </Link>
      <h1 className="font-display text-3xl font-bold tracking-tight">
        {item ? item.name : kind === "product" ? "Nuevo producto" : "Nuevo servicio"}
      </h1>
      <ItemForm
        businessId={business.id}
        currency={business.currency}
        both={business.business_type === "both"}
        canRemoveBackground={recraftEnabled()}
        voice={aiVoiceEnabled()}
        categories={categories}
        item={{
          id: item?.id ?? null,
          kind,
          name: item?.name ?? "",
          priceMode: item ? (item.price === null ? "quote" : item.price_mode) : kind === "service" ? "from" : "fixed",
          price: item?.price === null || item?.price === undefined ? "" : String(item.price),
          description: item?.description ?? "",
          category: item?.category ?? "",
          variants: variantsText(item?.variants),
          duration: item?.duration_minutes ? String(item.duration_minutes) : "",
          active: item?.active ?? true,
          imagePath: item?.image_path ?? null,
          originalPath: item?.image_original_path ?? null,
          imageUrl: item?.image_path ? publicAssetUrl(item.image_path) : null,
          originalUrl: item?.image_original_path ? publicAssetUrl(item.image_original_path) : null,
        }}
      />
      {item && videoEnabled() && <VideoPanel serviceId={item.id} hasPhoto={Boolean(item.image_path)} left={await videosLeft()} initial={await refreshVideos(item.id)} />}
    </div>
  );
}
