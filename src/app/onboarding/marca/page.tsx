import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { SubmitButton } from "@/components/submit-button";
import { Button, PageTitle } from "@/components/ui";
import {
  FONT_PAIRS,
  googleFontsHref,
  iconsFor,
  palettesFor,
  storedKit,
  storedOptions,
} from "@/lib/brand";
import { FORMAT_LABEL, ITEMS, ZIP_NAME, type Group } from "@/lib/brand-files";
import { recraftEnabled } from "@/lib/brand-recraft";
import { brandKitPrice } from "@/lib/brand-store";
import { publicAssetUrl, requireBusiness } from "@/lib/business";
import { slugify } from "@/lib/site";
import { generateKits, purchaseKit, rewriteBase, saveBrand } from "./actions";
import { KitEditor } from "./kit-editor";
import { Proposal } from "./proposal-card";
import { ZipDownload } from "./zip-download";
import { Uploader } from "./uploader";

// Elegir una propuesta hace que Nuna escriba la base de marca (puede tardar).
export const maxDuration = 300;

const OPTIONS = [
  { value: "new", label: "No tengo página / hazme una nueva", note: "Nuna diseña una página nueva para tu negocio." },
  {
    value: "keep_existing",
    label: "Sí tengo, quiero usar la mía",
    note: "Conservas tu página y le agregamos el chat de Nuna y el formulario de cotización.",
  },
  {
    value: "rebuild",
    label: "Sí tengo, pero quiero una nueva",
    note: "Nuna toma ideas de tu página actual y diseña una nueva.",
  },
];

const INCLUDES = [
  "Tablero de marca para presentar tu identidad, como lo hacen las agencias",
  "Logo en todas sus versiones + símbolo y sello, en SVG, PNG, JPG, PDF para Illustrator y PSD para Photoshop",
  "Base de marca: historia, misión, visión, valores, cliente ideal, promesa y forma de hablar",
  "Textos listos en Word para copiar y pegar: bio para redes, descripción para Google y WhatsApp, mensaje de bienvenida, hashtags e ideas de publicaciones",
  "Firma de correo con tu logo, lista para Gmail u Outlook",
  "Redes sociales: foto de perfil, portada, publicación e historia (también en PSD por capas)",
  "Papelería para imprenta: tarjeta de presentación, hoja membretada (PDF y Word), cotización y volante",
  "Cómo se ve tu marca: letrero del local, camiseta, bolsa, vehículo y chat de WhatsApp",
  "Paleta de colores para Adobe, fondos de marca y manual de marca completo",
];

const GROUPS: Group[] = ["Presentación", "Logo", "Redes sociales", "Papelería", "Mockups", "Colores y patrón"];
const GROUP_LABEL: Record<Group, string> = {
  Presentación: "Presentación",
  Logo: "Logo",
  "Redes sociales": "Redes sociales",
  Papelería: "Papelería",
  Mockups: "Tu marca en la vida real",
  "Colores y patrón": "Colores y fondos",
};

function BaseItem({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <h4 className="text-sm font-semibold uppercase tracking-wider text-muted">{title}</h4>
      <div>{children}</div>
    </div>
  );
}

export default async function BrandPage(props: PageProps<"/onboarding/marca">) {
  const { supabase, business } = await requireBusiness();
  if (business.onboarding_step === "interview") redirect("/onboarding/entrevista");
  const query = await props.searchParams;

  const [{ data: assets }, { data: website }] = await Promise.all([
    supabase.from("brand_assets").select("id, kind, storage_path").eq("business_id", business.id).order("created_at"),
    supabase.from("websites").select("source, existing_url").eq("business_id", business.id).maybeSingle(),
  ]);
  const withUrls = (assets ?? []).map((a) => ({ id: a.id, kind: a.kind, url: publicAssetUrl(a.storage_path) }));
  const source = website?.source ?? "new";

  const options = storedOptions(business.brand_options, business);
  // Propuestas hechas antes del diseño moderno (no traen símbolo moderno): se ofrece rehacerlas.
  const outdated =
    Array.isArray(business.brand_options) &&
    business.brand_options.some((o) => !o || typeof o !== "object" || Array.isArray(o) || !("mark" in o));
  const kit = storedKit(business.brand_kit, business);
  const base = kit?.base;
  const purchased = business.brand_status === "purchased";
  const price = brandKitPrice();
  const customColors = options
    .map((o, i) => (o.colors ? { label: `Propuesta ${i + 1}: ${o.name}`.slice(0, 40), colors: o.colors } : null))
    .filter((c): c is NonNullable<typeof c> => c !== null);

  return (
    <>
      <link rel="stylesheet" href={googleFontsHref(FONT_PAIRS)} precedence="default" />
      <PageTitle
        title="Tu marca, tus fotos y tu página actual"
        lead="Nuna te propone una identidad de marca completa para tu negocio: logo, colores, letras, eslogan, historia y todo lo que necesitas para tus redes, tu papelería y tu local. Ver las propuestas es gratis."
      />

      <section id="kit" className="flex scroll-mt-4 flex-col gap-5" aria-labelledby="kit-title">
        <h2 id="kit-title" className="font-display text-2xl font-bold">
          Identidad de marca
        </h2>
        {query.comprado && purchased && (
          <p role="status" className="rounded-2xl border border-lime/40 bg-lime/10 p-4 text-lime">
            ¡Listo! Tu kit de marca es tuyo. Ya puedes descargarlo todo.
          </p>
        )}

        {outdated && (
          <div className="flex flex-col gap-4 rounded-2xl border border-lime/60 bg-lime/10 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col gap-1">
              <strong className="text-lime">Nuna tiene un estilo de diseño nuevo, más moderno.</strong>
              <span className="text-sm text-muted">Tus propuestas son del diseño anterior. Pídele 3 nuevas para ver el estilo actual.</span>
            </div>
            <form action={generateKits}>
              <SubmitButton pendingText="Nuna está diseñando… (unos segundos)">Hacer 3 propuestas nuevas</SubmitButton>
            </form>
          </div>
        )}

        {options.length === 0 ? (
          <div className="flex flex-col gap-4 rounded-2xl border border-line bg-panel p-5">
            <p className="max-w-2xl text-muted">
              Con lo que le contaste en la entrevista, Nuna diseña 3 propuestas distintas para {business.name}, cada una con su
              propia idea. Tú eliges la que más te guste y la ajustas a tu gusto.
            </p>
            <form action={generateKits}>
              <SubmitButton pendingText="Nuna está diseñando tus propuestas… (unos segundos)">Ver mis 3 propuestas de marca</SubmitButton>
            </form>
          </div>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-3">
              {options.map((o, i) => (
                <Proposal key={i} kit={o} name={business.name} index={i} selected={kit?.name === o.name} />
              ))}
            </div>
            <form action={generateKits}>
              <SubmitButton variant="ghost" pendingText="Nuna está diseñando otras propuestas…">
                Ver otras 3 propuestas
              </SubmitButton>
            </form>
          </>
        )}

        {kit && (
          <div className="flex flex-col gap-4 rounded-2xl border border-line bg-panel p-5">
            <h3 className="font-display text-xl font-bold">Ajusta tu marca</h3>
            <KitEditor
              key={`${kit.name}-${kit.aiChoices?.length ?? 0}`}
              kit={kit}
              name={business.name}
              palettes={palettesFor(business.industry)}
              customColors={customColors}
              icons={iconsFor(business.industry)}
              industry={business.industry}
              aiEnabled={recraftEnabled()}
            />
          </div>
        )}

        {kit && base && (
          <div className="flex flex-col gap-5 rounded-2xl border border-line bg-panel p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="font-display text-xl font-bold">Tu base de marca</h3>
              <form action={rewriteBase}>
                <SubmitButton variant="ghost" pendingText="Nuna está escribiendo…">
                  Escribir otra versión
                </SubmitButton>
              </form>
            </div>
            <div className="grid gap-5 md:grid-cols-2">
              <BaseItem title="Historia">{base.story}</BaseItem>
              <BaseItem title="Promesa">{base.promise}</BaseItem>
              <BaseItem title="Misión">{base.mission}</BaseItem>
              <BaseItem title="Visión">{base.vision}</BaseItem>
              <BaseItem title="Valores">
                <ul className="flex flex-col gap-1">
                  {base.values.map((v) => (
                    <li key={v.name}>
                      <strong>{v.name}:</strong> {v.text}
                    </li>
                  ))}
                </ul>
              </BaseItem>
              <BaseItem title="Cliente ideal">{base.audience}</BaseItem>
              {purchased ? (
                <>
                  <BaseItem title="Bio para redes">{base.bio}</BaseItem>
                  <BaseItem title="Bienvenida de WhatsApp">{base.whatsappWelcome}</BaseItem>
                </>
              ) : (
                <p className="text-sm text-muted md:col-span-2">
                  Con el kit completo también recibes la forma de hablar de tu marca, la bio para redes, la descripción para Google
                  y WhatsApp, el mensaje de bienvenida, hashtags e ideas de publicaciones.
                </p>
              )}
            </div>
          </div>
        )}

        {kit && !purchased && (
          <div className="flex flex-col gap-4 rounded-2xl border border-lime/50 bg-panel p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="font-display text-xl font-bold">Kit de marca completo</h3>
              <span className="font-display text-2xl font-bold text-lime">
                {price} <span className="text-sm font-normal text-muted">pago único</span>
              </span>
            </div>
            <ul className="flex flex-col gap-2">
              {INCLUDES.map((item) => (
                <li key={item} className="flex gap-2">
                  <span aria-hidden className="text-lime">
                    ✓
                  </span>
                  {item}
                </li>
              ))}
            </ul>
            <form action={purchaseKit} className="flex flex-col gap-2">
              <SubmitButton pendingText="Preparando tu kit…" className="self-start">
                Comprar mi kit de marca · {price}
              </SubmitButton>
              <p className="text-sm text-muted">Modo prueba: no se cobra nada todavía. El cobro real se activa cuando conectemos los pagos.</p>
            </form>
          </div>
        )}

        {kit && purchased && (
          <div className="flex flex-col gap-5 rounded-2xl border border-line bg-panel p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="font-display text-xl font-bold">Tu kit de marca ✓</h3>
              <div className="flex flex-wrap gap-2">
                <ZipDownload href={`/api/marca/${ZIP_NAME}`} filename={`${slugify(business.name)}-${ZIP_NAME}`} />
                <Link href="/manual-de-marca" target="_blank" className="inline-flex min-h-12 items-center rounded-full border border-line px-6 font-semibold hover:bg-panel-2">
                  Manual de marca
                </Link>
              </div>
            </div>
            <p className="text-sm text-muted">
              Si cambias algo arriba, tus descargas, tu manual y tu página web se actualizan solos. El PDF se abre y se edita en
              Illustrator; el PSD trae capas para Photoshop.
            </p>
            {GROUPS.map((g) => (
              <div key={g} className="flex flex-col gap-2">
                <h4 className="font-semibold">{GROUP_LABEL[g]}</h4>
                <ul className="flex flex-col divide-y divide-line rounded-xl border border-line">
                  {ITEMS.filter((i) => i.group === g).map((item) => (
                    <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2">
                      <span>{item.label}</span>
                      <span className="flex flex-wrap gap-1.5">
                        {item.formats.map((fmt) => (
                          <a
                            key={fmt}
                            href={`/api/marca/${item.id}.${fmt}`}
                            download
                            className="inline-flex min-h-10 items-center rounded-full border border-line px-3 text-sm hover:bg-panel-2"
                          >
                            {FORMAT_LABEL[fmt]}
                          </a>
                        ))}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-4" aria-labelledby="assets-title">
        <h2 id="assets-title" className="font-display text-2xl font-bold">
          ¿Ya tienes logo o fotos?
        </h2>
        <p className="max-w-2xl text-muted">Todo es opcional. Si subes tu propio logo, tu página lo usa en lugar del de Nuna.</p>
        <div className="grid gap-4 md:grid-cols-2">
          <Uploader
            businessId={business.id}
            kind="logo"
            label="Logo"
            emptyNote={kit ? "Sin logo propio: tu página usa el logo de tu kit de marca." : "Sin logo: Nuna usa las iniciales del negocio."}
            multiple={false}
            assets={withUrls.filter((a) => a.kind === "logo")}
          />
          <Uploader
            businessId={business.id}
            kind="photo"
            label="Fotos de tus trabajos o productos"
            emptyNote="Sin fotos: la página muestra espacios para agregarlas después."
            multiple
            assets={withUrls.filter((a) => a.kind === "photo")}
          />
        </div>
      </section>

      <form action={saveBrand} className="flex flex-col gap-4">
        <fieldset className="flex flex-col gap-3 rounded-2xl border border-line bg-panel p-5">
          <legend className="px-1 font-semibold">¿Ya tienes página web?</legend>
          {OPTIONS.map((o) => (
            <label key={o.value} className="flex min-h-11 cursor-pointer items-start gap-3">
              <input type="radio" name="source" value={o.value} defaultChecked={source === o.value} className="mt-1.5 size-4 accent-lime" />
              <span className="flex flex-col">
                <span className="font-semibold">{o.label}</span>
                <span className="text-sm text-muted">{o.note}</span>
              </span>
            </label>
          ))}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="existing_url" className="text-sm font-semibold text-muted">
              Si tienes página, ¿cuál es la dirección?
            </label>
            <input
              id="existing_url"
              name="existing_url"
              defaultValue={website?.existing_url ?? ""}
              placeholder="www.minegocio.com"
              className="min-h-12 rounded-xl border border-line bg-ink px-4 placeholder:text-muted/70"
            />
          </div>
        </fieldset>
        <Button type="submit" className="self-start">
          Listo → diseñar mi página
        </Button>
      </form>
    </>
  );
}
