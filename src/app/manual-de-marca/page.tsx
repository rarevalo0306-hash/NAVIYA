import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { storedKit } from "@/lib/brand";
import { bookPages } from "@/lib/brand-book";
import { brandCtx, kitLogoUrl } from "@/lib/brand-store";
import { requireBusiness } from "@/lib/business";
import { BrandManual } from "./manual-view";

export const metadata: Metadata = { title: "Manual de marca" };

export default async function BrandManualPage() {
  const { supabase, business: b } = await requireBusiness();
  const kit = storedKit(b.brand_kit, b);
  if (!kit || b.brand_status !== "purchased") redirect("/onboarding/marca#kit");
  const c = await brandCtx(supabase, b, kit, (await headers()).get("host") ?? "naviya.app");
  const pages = (await bookPages(c)).length;
  // La versión (fecha de cambio) evita que el navegador muestre páginas viejas después de ajustar la marca.
  const v = encodeURIComponent(b.updated_at);
  return (
    <BrandManual
      name={b.name}
      owner={b.owner_name}
      phone={b.phone}
      address={b.address}
      kit={kit}
      siteUrl={c.siteUrl}
      logoPngUrl={kitLogoUrl(b)}
      pages={pages}
      img={(n) => `/api/marca/manual-${n}.png?v=${v}`}
      pdfUrl="/api/marca/manual.pdf"
    />
  );
}
