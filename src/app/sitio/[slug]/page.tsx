import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SiteView } from "@/components/site-view";
import type { SiteContent } from "@/lib/site";
import { createClient } from "@/lib/supabase/server";
import { LeadForm } from "./lead-form";
import { AddToOrder, OrderBar } from "./order";

async function loadSite(slug: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("websites")
    .select("content")
    .eq("subdomain", slug)
    .eq("status", "published")
    .maybeSingle();
  return data ? (data.content as unknown as SiteContent) : null;
}

export async function generateMetadata(props: PageProps<"/sitio/[slug]">): Promise<Metadata> {
  const { slug } = await props.params;
  const site = await loadSite(slug);
  return site ? { title: site.name, description: site.tagline } : { title: "Página no encontrada" };
}

export default async function PublicSitePage(props: PageProps<"/sitio/[slug]">) {
  const { slug } = await props.params;
  const site = await loadSite(slug);
  if (!site) notFound();
  return (
    <SiteView
      site={site}
      leadForm={<LeadForm slug={slug} cta={site.copy?.cta ?? site.ctaLabel} copy={site.copy} />}
      orderButton={(s) => <AddToOrder item={s} slug={slug} />}
      cart={<OrderBar slug={slug} currency={site.currency} />}
    />
  );
}
