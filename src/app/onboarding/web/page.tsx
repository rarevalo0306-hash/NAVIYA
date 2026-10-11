import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Scaled } from "@/components/scaled";
import { SiteView } from "@/components/site-view";
import { SubmitButton } from "@/components/submit-button";
import { Button, ButtonLink, Field, PageTitle } from "@/components/ui";
import { priceLabel } from "@/lib/interview";
import { siteContentFor } from "@/lib/brand-store";
import { SITE_TEMPLATES, templateById } from "@/lib/site-templates";
import { requireBusiness } from "@/lib/business";
import { slugify } from "@/lib/site";
import { addService, chooseTemplate, publishWebsite, removeService } from "./actions";
import { DevicePreview } from "./device-preview";

export default async function WebsitePage(props: PageProps<"/onboarding/web">) {
  const { supabase, business } = await requireBusiness();
  if (["interview", "brand"].includes(business.onboarding_step)) redirect("/onboarding/marca");
  const query = await props.searchParams;
  const host = (await headers()).get("host") ?? "";

  const [preview, { data: website }, { data: services }] = await Promise.all([
    siteContentFor(supabase, business),
    supabase.from("websites").select("*").eq("business_id", business.id).maybeSingle(),
    supabase.from("services").select("id, name, price").eq("business_id", business.id).order("sort"),
  ]);
  const products = business.business_type === "products";
  const published = website?.status === "published" && website.subdomain;
  const current = templateById(website?.template);
  const path = `/sitio/${website?.subdomain ?? slugify(business.name)}`;

  return (
    <>
      <PageTitle
        title="Tu página web"
        lead={
          website?.source === "keep_existing"
            ? "Conservas tu página actual. Esta es la página de respaldo en Orbusiness, con el formulario conectado a tu CRM. En la siguiente fase te damos el código para agregar el chat de Nuna a tu página."
            : "Nuna la diseñó con lo que le contaste. Revísala y publícala: queda en línea al momento."
        }
      />

      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-panel p-4">
        <span className="flex-1">
          Dirección: <strong>{host}{path}</strong>
          <span className="block text-sm text-muted">
            Dirección temporal de Orbusiness. Tu dominio propio (por ejemplo, {slugify(business.name).replace(/-/g, "")}.com) llega en la fase 3.
          </span>
        </span>
        {published ? (
          <>
            <span className="font-semibold text-lime">✓ En línea</span>
            <Link href={path} target="_blank" className="min-h-11 content-center underline underline-offset-4">
              Abrir mi página
            </Link>
          </>
        ) : null}
        <form action={publishWebsite}>
          <Button type="submit" variant={published ? "ghost" : "primary"}>
            {published ? "Volver a publicar con cambios" : "Publicar mi página"}
          </Button>
        </form>
      </div>
      {query.publicada && <p role="status" className="text-lime">Tu página quedó publicada.</p>}

      <section className="flex flex-col gap-4 rounded-2xl border border-line bg-panel p-5" aria-labelledby="productos-title">
        <div className="flex flex-col gap-1">
          <h2 id="productos-title" className="font-display text-2xl font-bold">
            {products ? "Lo que vendes" : "Lo que ofreces"}
          </h2>
          <p className="text-muted">
            {(services?.length ?? 0) < 4
              ? `Tu página se ve mejor con 4 a 8 ${products ? "productos o categorías (por ejemplo: herramientas, pintura, plomería)" : "servicios"}. El precio es opcional.`
              : "Esto sale en tu página. El precio es opcional."}
          </p>
          <Link href="/panel/vender" className="mt-1 inline-flex min-h-11 items-center self-start rounded-full bg-lime/15 px-4 text-sm font-semibold text-lime transition hover:bg-lime/25">
            Agregar fotos, descripciones y más con Nuna →
          </Link>
        </div>
        {services && services.length > 0 && (
          <ul className="flex flex-col divide-y divide-line">
            {services.map((s) => (
              <li key={s.id} className="flex items-center gap-3 py-2">
                <span className="flex-1 font-semibold">{s.name}</span>
                <span className="text-sm text-muted">{priceLabel(s.price === null ? null : Number(s.price), business.currency)}</span>
                <form action={removeService.bind(null, s.id)}>
                  <SubmitButton variant="ghost" pendingText="…" className="min-h-10 px-3 text-sm" aria-label={`Quitar ${s.name}`}>
                    Quitar
                  </SubmitButton>
                </form>
              </li>
            ))}
          </ul>
        )}
        <form action={addService} className="grid gap-3 sm:grid-cols-[1fr_12rem_auto] sm:items-end">
          <Field label={products ? "Producto o categoría" : "Servicio"} id="service-name" name="name" required maxLength={80} placeholder={products ? "Ej.: Pintura y brochas" : "Ej.: Corte de cabello"} />
          <Field label={`Precio desde (${business.currency}, opcional)`} id="service-price" name="price" inputMode="decimal" placeholder="Ej.: 250" />
          <SubmitButton pendingText="Agregando…">Agregar</SubmitButton>
        </form>
      </section>

      <section className="flex flex-col gap-4" aria-labelledby="diseno-title">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <h2 id="diseno-title" className="font-display text-2xl font-bold">
            Así se ve: {current.name}
          </h2>
          <p className="text-sm text-muted">Mírala en celular, tablet y computadora.</p>
        </div>
        <DevicePreview src={`/vista-previa?plantilla=${current.id}&v=${encodeURIComponent(business.updated_at)}`} />
      </section>

      <section className="flex flex-col gap-4" aria-labelledby="plantillas-title">
        <div className="flex flex-col gap-1">
          <h2 id="plantillas-title" className="font-display text-2xl font-bold">
            Elige el diseño de tu página
          </h2>
          <p className="text-muted">
            {SITE_TEMPLATES.length} diseños listos, todos se adaptan a celular, tablet y computadora y usan tus colores, tus letras y tu logo.
          </p>
        </div>
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {SITE_TEMPLATES.map((t) => {
            const selected = t.id === current.id;
            return (
              <li key={t.id} className={`flex flex-col gap-3 rounded-2xl border bg-panel p-3 ${selected ? "border-lime" : "border-line"}`}>
                <Scaled width={1280} height={820} className="rounded-xl">
                  <SiteView site={preview} template={t.id} preview />
                </Scaled>
                <div className="flex flex-col gap-0.5 px-1">
                  <span className="font-semibold">{t.name}</span>
                  <span className="text-sm text-muted">{t.description}</span>
                  <span className="text-xs text-muted">Ideal para: {t.goodFor}</span>
                </div>
                <form action={chooseTemplate.bind(null, t.id)} className="px-1 pb-1">
                  {selected ? (
                    <Button type="button" variant="ghost" disabled className="w-full">
                      ✓ Elegido
                    </Button>
                  ) : (
                    <SubmitButton variant="ghost" pendingText="Aplicando…" className="w-full">
                      Usar este diseño
                    </SubmitButton>
                  )}
                </form>
              </li>
            );
          })}
        </ul>
      </section>

      {published && (
        <ButtonLink href="/onboarding/crm" className="self-start">
          Seguir: CRM a tu medida →
        </ButtonLink>
      )}
    </>
  );
}
