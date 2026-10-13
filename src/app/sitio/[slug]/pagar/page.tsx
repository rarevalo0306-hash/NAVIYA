import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SiteView } from "@/components/site-view";
import { checkoutSettings } from "@/lib/checkout";
import type { SiteContent } from "@/lib/site";
import { createClient } from "@/lib/supabase/server";
import { Checkout } from "./checkout";

// Checkout de la tienda: datos del cliente, entrega o recoger, y pago. Con el diseño de la página del negocio.
export const metadata: Metadata = { title: "Tu pedido", robots: { index: false } };

export default async function CheckoutPage(props: { params: Promise<{ slug: string }> }) {
  const { slug } = await props.params;
  const supabase = await createClient();
  const { data } = await supabase.from("websites").select("content").eq("subdomain", slug).eq("status", "published").maybeSingle();
  if (!data) notFound();
  const site = data.content as unknown as SiteContent;
  return (
    <SiteView
      site={site}
      home={`/sitio/${slug}`}
      main={
        <Checkout
          slug={slug}
          currency={site.currency}
          settings={site.checkout ?? checkoutSettings(null, site.highlights?.some((h) => h.icon === "entrega") ?? false)}
          paymentMethods={site.paymentMethods ?? []}
          thanks={site.copy?.thanks}
        />
      }
    />
  );
}
