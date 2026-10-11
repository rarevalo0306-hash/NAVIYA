// Contenido de la página web de un negocio. Se guarda como copia (snapshot) en websites.content
// al publicar, para que el sitio público no necesite leer otras tablas.
// Los textos se adaptan al país y al trato que eligió el dueño (tú / usted / vos).

import type { BrandKit } from "@/lib/brand";
import { publicAssetUrl } from "@/lib/business";
import type { Tables } from "@/lib/database.types";
import { norm } from "@/lib/interview";
import { marketFor, say } from "@/lib/markets";

export type SiteCopy = {
  cta: string;
  leadIntro: string;
  nameLabel: string;
  needLabel: string;
  thanks: string;
  whatsapp: string;
  payments: string;
};

// Un producto o servicio en la página. Los campos opcionales no existen en páginas publicadas antes de la tienda.
export type SiteItem = {
  name: string;
  price: number | null;
  id?: string;
  kind?: "product" | "service";
  priceMode?: "fixed" | "from" | "quote";
  description?: string | null;
  image?: string | null;
  variants?: { name: string; options: string[] }[];
};

export type SiteContent = {
  name: string;
  tagline: string;
  intro: string;
  industry: string;
  zone: string;
  hours: string;
  services: SiteItem[];
  currency: string;
  secondaryCurrency?: string | null;
  phone?: string | null;
  whatsappFirst?: boolean;
  address?: string | null;
  paymentMethods?: string[];
  logoUrl: string | null;
  photos: string[];
  kind?: string | null; // products | services | both
  highlights?: { icon: "entrega" | "credito" | "horario" | "chat" | "visita" | "fijo"; title: string; text: string }[];
  ctaLabel: string; // se mantiene por las páginas publicadas antes
  copy?: SiteCopy;
  brand?: BrandKit | null; // kit de marca elegido: colores, letras y logo de la página
  template?: string; // plantilla de diseño (lib/site-templates.ts)
};

type Phrase = { tu: string; usted: string; vos: string };
const same = (s: string): Phrase => ({ tu: s, usted: s, vos: s });

const TAGLINES: [string, Phrase][] = [
  ["ferret", { tu: "Todo para tu casa y tu obra, con buenos precios", usted: "Todo para su casa y su obra, con buenos precios", vos: "Todo para tu casa y tu obra, con buenos precios" }],
  ["pulper", same("Lo de todos los días, cerca de tu casa")],
  ["abarrot", same("Lo de todos los días, cerca de tu casa")],
  ["tienda", { tu: "Lo que necesitas, cerca de ti y con buen trato", usted: "Lo que necesita, cerca de usted y con buen trato", vos: "Lo que necesitás, cerca tuyo y con buen trato" }],
  ["farmac", { tu: "Tu salud, con atención cercana", usted: "Su salud, con atención cercana", vos: "Tu salud, con atención cercana" }],
  ["ropa", same("Ropa para todos, a buen precio")],
  ["jardin", { tu: "Tu jardín impecable, sin que tengas que pensarlo", usted: "Su jardín impecable, sin que tenga que pensarlo", vos: "Tu jardín impecable, sin que tengás que pensarlo" }],
  ["limpi", { tu: "Tu casa limpia y en orden, cuando la necesitas", usted: "Su casa limpia y en orden, cuando la necesita", vos: "Tu casa limpia y en orden, cuando la necesitás" }],
  ["salon", { tu: "Luce increíble, con cita cuando te queda", usted: "Luzca increíble, con cita cuando le quede", vos: "Lucí increíble, con cita cuando te quede" }],
  ["belleza", { tu: "Luce increíble, con cita cuando te queda", usted: "Luzca increíble, con cita cuando le quede", vos: "Lucí increíble, con cita cuando te quede" }],
  ["taller", { tu: "Tu auto en buenas manos, con precio claro", usted: "Su auto en buenas manos, con precio claro", vos: "Tu auto en buenas manos, con precio claro" }],
  ["mecan", { tu: "Tu auto en buenas manos, con precio claro", usted: "Su auto en buenas manos, con precio claro", vos: "Tu auto en buenas manos, con precio claro" }],
  ["plom", same("Arreglamos la fuga hoy, con precio claro")],
  ["pint", same("Paredes como nuevas, sin complicaciones")],
];

export function slugify(name: string) {
  return (
    norm(name)
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "mi-negocio"
  );
}

export function buildSiteContent(
  b: Tables<"businesses">,
  services: Tables<"services">[],
  logoUrl: string | null,
  photos: string[],
  brand: BrandKit | null = null,
  template = "clasica",
): SiteContent {
  const market = marketFor(b.country_code);
  const form = b.address_form ?? market?.addressForm ?? "tu";
  const t = (p: Phrase) => say(form, p);
  const industry = b.industry ?? "Servicios";
  const key = norm(industry);
  const tagline = t(TAGLINES.find(([k]) => key.includes(k))?.[1] ?? same(`${industry} con atención personal y precios claros`));

  const cta =
    b.business_type === "products"
      ? t({ tu: "Pide precio o cotización", usted: "Pida precio o cotización", vos: "Pedí precio o cotización" })
      : b.visit_before_quote
        ? t({ tu: "Agenda una visita gratis", usted: "Agende una visita gratis", vos: "Agendá una visita gratis" })
        : t({ tu: "Pide tu cotización", usted: "Pida su cotización", vos: "Pedí tu cotización" });

  const intro = [
    `Somos ${b.name}${b.zone ? `, en ${b.zone}` : ""}.`,
    b.business_type === "products"
      ? t({
          tu: "Pregunta por precio y disponibilidad: te respondemos en minutos.",
          usted: "Pregunte por precio y disponibilidad: le respondemos en minutos.",
          vos: "Preguntá por precio y disponibilidad: te respondemos en minutos.",
        })
      : b.visit_before_quote
        ? t({
            tu: "Pasamos a ver tu trabajo sin costo y te damos un precio claro.",
            usted: "Pasamos a ver su trabajo sin costo y le damos un precio claro.",
            vos: "Pasamos a ver tu trabajo sin costo y te damos un precio claro.",
          })
        : t({
            tu: "Pide tu cotización y te respondemos en minutos.",
            usted: "Pida su cotización y le respondemos en minutos.",
            vos: "Pedí tu cotización y te respondemos en minutos.",
          }),
    b.offers_delivery ? "Hacemos entregas a domicilio." : "",
    b.has_recurring_clients && b.business_type !== "products" ? "También tenemos servicio fijo cada semana o cada mes." : "",
  ]
    .filter(Boolean)
    .join(" ");

  const credit = (b.payment_methods ?? []).find((m) => /fiado|cr[eé]dito/i.test(m));
  const highlights: NonNullable<SiteContent["highlights"]> = [
    b.offers_delivery && {
      icon: "entrega" as const,
      title: "Entrega a domicilio",
      text: t({ tu: "Te llevamos tu pedido hasta la puerta.", usted: "Le llevamos su pedido hasta la puerta.", vos: "Te llevamos tu pedido hasta la puerta." }),
    },
    b.visit_before_quote && {
      icon: "visita" as const,
      title: "Visita sin costo",
      text: t({ tu: "Vemos tu trabajo y te damos un precio claro.", usted: "Vemos su trabajo y le damos un precio claro.", vos: "Vemos tu trabajo y te damos un precio claro." }),
    },
    credit && {
      icon: "credito" as const,
      title: "Crédito de confianza",
      text: t({ tu: "Clientes de siempre pueden llevar fiado.", usted: "Clientes de siempre pueden llevar fiado.", vos: "Clientes de siempre pueden llevar fiado." }),
    },
    b.has_recurring_clients && b.business_type !== "products" && {
      icon: "fijo" as const,
      title: "Servicio fijo",
      text: "Cada semana o cada mes, sin tener que acordarse.",
    },
    b.hours && { icon: "horario" as const, title: "Horario", text: b.hours },
    {
      icon: "chat" as const,
      title: "Respuesta rápida",
      text: t({ tu: "Escríbenos y te contestamos en minutos.", usted: "Escríbanos y le contestamos en minutos.", vos: "Escribinos y te contestamos en minutos." }),
    },
  ]
    .filter((x): x is NonNullable<SiteContent["highlights"]>[number] => Boolean(x))
    .slice(0, 4);

  return {
    name: b.name,
    tagline,
    intro,
    industry,
    zone: b.zone ?? "",
    hours: b.hours ?? "",
    services: services
      .filter((s) => s.active)
      .map((s) => ({
        id: s.id,
        name: s.name,
        price: s.price === null ? null : Number(s.price),
        kind: s.kind === "product" ? ("product" as const) : ("service" as const),
        priceMode: (["fixed", "from", "quote"].includes(s.price_mode) ? s.price_mode : "fixed") as SiteItem["priceMode"],
        description: s.description,
        image: s.image_path ? publicAssetUrl(s.image_path) : null,
        variants: Array.isArray(s.variants) ? (s.variants as SiteItem["variants"]) : [],
      })),
    currency: b.currency,
    secondaryCurrency: b.secondary_currency,
    phone: b.phone,
    whatsappFirst: (market?.channels[0] ?? "WhatsApp") === "WhatsApp",
    address: b.address,
    paymentMethods: b.payment_methods,
    logoUrl,
    photos,
    kind: b.business_type,
    highlights,
    ctaLabel: cta,
    brand,
    template,
    copy: {
      cta,
      leadIntro: t({
        tu: "Déjanos tus datos y te contestamos hoy mismo.",
        usted: "Déjenos sus datos y le contestamos hoy mismo.",
        vos: "Dejanos tus datos y te contestamos hoy mismo.",
      }),
      nameLabel: t({ tu: "Tu nombre", usted: "Su nombre", vos: "Tu nombre" }),
      needLabel: t({ tu: "¿Qué necesitas?", usted: "¿Qué necesita?", vos: "¿Qué necesitás?" }),
      thanks: t({
        tu: "¡Gracias! Recibimos tus datos y te contactamos muy pronto.",
        usted: "¡Gracias! Recibimos sus datos y lo contactamos muy pronto.",
        vos: "¡Gracias! Recibimos tus datos y te contactamos muy pronto.",
      }),
      whatsapp: t({ tu: "Escríbenos por WhatsApp", usted: "Escríbanos por WhatsApp", vos: "Escribinos por WhatsApp" }),
      payments: "Aceptamos",
    },
  };
}
