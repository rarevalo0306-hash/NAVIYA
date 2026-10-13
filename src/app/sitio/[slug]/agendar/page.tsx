import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SiteView, sitePrice } from "@/components/site-view";
import type { SiteContent } from "@/lib/site";
import { createClient } from "@/lib/supabase/server";
import { Booking } from "./booking";

// Agendar una cita en línea: servicio, día, hora y datos. Con el diseño de la página del negocio.
export const metadata: Metadata = { title: "Agenda tu cita", robots: { index: false } };

export default async function BookingPage(props: { params: Promise<{ slug: string }>; searchParams: Promise<{ servicio?: string }> }) {
  const [{ slug }, { servicio }] = await Promise.all([props.params, props.searchParams]);
  const supabase = await createClient();
  const { data } = await supabase.from("websites").select("content").eq("subdomain", slug).eq("status", "published").maybeSingle();
  if (!data) notFound();
  const site = data.content as unknown as SiteContent;
  const services = site.services.filter((s) => s.id && s.kind === "service").map((s) => ({ ...s, priceText: sitePrice(s, site.currency) }));
  if (!site.booking?.enabled || !services.length) notFound();
  return (
    <SiteView
      site={site}
      home={`/sitio/${slug}`}
      main={<Booking slug={slug} tz={site.booking.tz} services={services} initial={services.some((s) => s.id === servicio) ? servicio! : services[0].id!} />}
    />
  );
}
