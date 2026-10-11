import "server-only";
import { backdropSvg, dynamicVariants, fontsById, kitPalette, mixHex, onColor, type BrandKit } from "@/lib/brand";
import { capRatio, logoArt, measure, paragraphSvg, place, textSvg, type Art, type KitFonts, type Layer } from "@/lib/brand-render";
import { priceLabel } from "@/lib/interview";
import { say, type AddressForm } from "@/lib/markets";

// Piezas del kit de marca con diseño moderno: mucho espacio, letra grande con interletrado
// ajustado, fondos suaves (aurora, formas grandes, líneas), esquinas redondeadas y sombras suaves.
// Cada pieza tiene capas con nombre, para entregarla también como PSD de Photoshop.

export type BrandCtx = {
  kit: BrandKit;
  fonts: KitFonts;
  name: string;
  owner: string | null;
  phone: string | null;
  address: string | null;
  zone: string | null;
  industry: string | null;
  form: AddressForm;
  paymentMethods: string[];
  services: { name: string; price: number | null }[];
  currency: string;
  siteUrl: string | null;
  logoUrl?: string | null; // logo PNG público (para la firma de correo)
};

const TITLE = -0.025; // interletrado de títulos grandes
const site = (c: BrandCtx) => c.siteUrl?.replace(/^https?:\/\//, "") ?? null;
const t3 = (c: BrandCtx, p: { tu: string; usted: string; vos: string }) => say(c.form, p);
const caption = (c: BrandCtx) => (c.kit.caption || [c.industry, c.zone].filter(Boolean).join(" · ")).toLocaleUpperCase("es");
const cut = (t: string, n: number) => (t.length > n ? `${t.slice(0, n - 1)}…` : t);
const logo = (c: BrandCtx, variant: Parameters<typeof logoArt>[2], theme: Parameters<typeof logoArt>[3]) => logoArt(c.kit, c.name, variant, theme, c.fonts);

let uid = 0;
const nextId = (p: string) => `${p}${++uid}`;

const rect = (x: number, y: number, w: number, h: number, fill: string, rx = 0, extra = "") =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${fill}"${extra}/>`;

// Sombra suave (degradado radial, funciona en PNG, PDF y PSD).
function shadow(cx: number, cy: number, rx: number, ry: number, opacity = 0.22) {
  const id = nextId("sh");
  return `<defs><radialGradient id="${id}" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#000" stop-opacity="${opacity}"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient></defs><ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="url(#${id})"/>`;
}

// Etiqueta en forma de píldora.
function pill(font: KitFonts["body"], text: string, x: number, y: number, size: number, fg: string, opts: { fill?: string; stroke?: string; anchor?: "start" | "end" } = {}) {
  const w = measure(font, text, size, 0.12) + size * 2;
  const h = size * 2.3;
  const left = opts.anchor === "end" ? x - w : x;
  const bg = opts.fill ? rect(left, y, w, h, opts.fill, h / 2) : `<rect x="${left}" y="${y}" width="${w}" height="${h}" rx="${h / 2}" fill="none" stroke="${opts.stroke ?? fg}" stroke-opacity="0.45" stroke-width="${size * 0.09}"/>`;
  return bg + textSvg(font, text, left + size, y + h / 2 + (capRatio(font) * size) / 2, size, fg, { tracking: 0.12 });
}

// Botón redondo con flecha.
function arrow(cx: number, cy: number, r: number, bg: string, fg: string) {
  const a = r * 0.36;
  return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${bg}"/><path d="M${cx - a} ${cy}H${cx + a}M${cx + a * 0.15} ${cy - a * 0.75}L${cx + a} ${cy}L${cx + a * 0.15} ${cy + a * 0.75}" fill="none" stroke="${fg}" stroke-width="${r * 0.13}" stroke-linecap="round" stroke-linejoin="round"/>`;
}

// ---------- Redes sociales ----------

export async function perfilArt(c: BrandCtx): Promise<Art> {
  const S = 1000;
  return {
    width: S,
    height: S,
    layers: [
      { name: "Fondo", svg: backdropSvg(c.kit, S, S, "oscuro") },
      { name: "Símbolo", svg: place(await logo(c, "isotipo", "blanco"), 290, 290, 420, 420).svg },
    ],
  };
}

export async function portadaArt(c: BrandCtx): Promise<Art> {
  const W = 1640;
  const H = 624;
  const head = paragraphSvg(c.fonts.heading, c.kit.slogan, 930, 0, 600, 64, "#FFFFFF", { maxLines: 3, lineHeight: 1.05, tracking: TITLE });
  const top = (H - head.height) / 2 + 30;
  return {
    width: W,
    height: H,
    layers: [
      { name: "Fondo", svg: backdropSvg(c.kit, W, H, "oscuro") },
      { name: "Logo", svg: place(await logo(c, "principal", "blanco"), 110, 182, 640, 260, "start").svg },
      {
        name: "Eslogan",
        svg:
          pill(c.fonts.body, cut(caption(c), 34), 930, top - 74, 18, "#FFFFFF") +
          paragraphSvg(c.fonts.heading, c.kit.slogan, 930, top, 600, 64, "#FFFFFF", { maxLines: 3, lineHeight: 1.05, tracking: TITLE }).svg,
      },
    ],
  };
}

// Portada para cualquier red (LinkedIn, X, YouTube, Google...): el logo y, si cabe, el eslogan,
// dentro de la zona segura (YouTube recorta los lados según la pantalla; en LinkedIn la foto de
// perfil tapa la esquina izquierda, así que ahí la zona empieza más a la derecha: safeX).
export async function bannerArt(c: BrandCtx, W: number, H: number, safeW = W, safeH = H, safeX = (W - safeW) / 2): Promise<Art> {
  const sx = safeX;
  const sy = (H - safeH) / 2;
  const wide = safeW / safeH >= 2.2; // en portadas angostas solo va el logo
  const logoH = safeH * (wide ? 0.5 : 0.42);
  const logoSvg = place(await logo(c, "principal", "blanco"), sx + safeW * (wide ? 0.06 : 0.15), sy + (safeH - logoH) / 2, safeW * (wide ? 0.4 : 0.7), logoH, wide ? "start" : "center").svg;
  const size = Math.min(64, safeH * 0.13);
  const sloganX = sx + safeW * 0.52;
  const head = paragraphSvg(c.fonts.heading, c.kit.slogan, sloganX, 0, safeW * 0.42, size, "#FFFFFF", { maxLines: 3, lineHeight: 1.05, tracking: TITLE });
  const top = sy + (safeH - head.height) / 2 + size * 0.45;
  return {
    width: W,
    height: H,
    layers: [
      { name: "Fondo", svg: backdropSvg(c.kit, W, H, "oscuro") },
      { name: "Logo", svg: logoSvg },
      ...(wide ? [{ name: "Eslogan", svg: paragraphSvg(c.fonts.heading, c.kit.slogan, sloganX, top, safeW * 0.42, size, "#FFFFFF", { maxLines: 3, lineHeight: 1.05, tracking: TITLE }).svg }] : []),
    ],
  };
}

export async function publicacionArt(c: BrandCtx): Promise<Art> {
  const p = kitPalette(c.kit);
  const S = 1080;
  const cta = t3(c, { tu: "Escríbenos", usted: "Escríbanos", vos: "Escribinos" });
  return {
    width: S,
    height: S,
    layers: [
      { name: "Fondo", svg: backdropSvg(c.kit, S, S, "claro") },
      { name: "Logo", svg: place(await logo(c, "principal", "color"), 90, 84, 440, 120, "start").svg },
      { name: "Etiqueta", svg: pill(c.fonts.body, cut(caption(c), 26), 990, 112, 18, p.dark, { anchor: "end" }) },
      {
        name: "Eslogan",
        svg:
          paragraphSvg(c.fonts.heading, c.kit.slogan, 90, 340, 880, 116, p.dark, { maxLines: 4, lineHeight: 1.0, tracking: TITLE }).svg +
          paragraphSvg(c.fonts.body, c.kit.proposition, 90, 760, 760, 34, mixHex(p.dark, p.light, 0.3), { maxLines: 2, lineHeight: 1.3 }).svg,
      },
      {
        name: "Contacto",
        svg:
          rect(90, 900, 900, 100, "#FFFFFF", 50, ` fill-opacity="0.9"`) +
          textSvg(c.fonts.body, c.phone ? `${cta}  ·  ${c.phone}` : cta, 140, 950 + (capRatio(c.fonts.body) * 32) / 2, 32, p.dark) +
          arrow(940, 950, 38, p.primary, onColor(p.primary, p.dark)),
      },
    ],
  };
}

export async function historiaArt(c: BrandCtx): Promise<Art> {
  const p = kitPalette(c.kit);
  const W = 1080;
  const H = 1920;
  const cta = t3(c, { tu: "Escríbenos por WhatsApp", usted: "Escríbanos por WhatsApp", vos: "Escribinos por WhatsApp" });
  return {
    width: W,
    height: H,
    layers: [
      { name: "Fondo", svg: backdropSvg(c.kit, W, H, "oscuro") },
      { name: "Logo", svg: place(await logo(c, "principal", "blanco"), 90, 150, 560, 170, "start").svg },
      {
        name: "Eslogan",
        svg:
          pill(c.fonts.body, cut(caption(c), 30), 90, 640, 22, "#FFFFFF") +
          paragraphSvg(c.fonts.heading, c.kit.slogan, 90, 760, 900, 132, "#FFFFFF", { maxLines: 4, lineHeight: 1.0, tracking: TITLE }).svg +
          paragraphSvg(c.fonts.body, c.kit.proposition, 90, 1290, 860, 40, "#FFFFFF", { maxLines: 3, lineHeight: 1.3, opacity: 0.85 }).svg,
      },
      {
        name: "Botón",
        svg:
          rect(90, 1560, 900, 140, "#FFFFFF", 70) +
          textSvg(c.fonts.heading, cta, 150, 1630 + (capRatio(c.fonts.heading) * 40) / 2, 40, p.dark, { tracking: -0.01 }) +
          arrow(920, 1630, 46, p.primary, onColor(p.primary, p.dark)) +
          (c.phone ? textSvg(c.fonts.body, c.phone, W / 2, 1780, 36, "#FFFFFF", { anchor: "middle", opacity: 0.85 }) : ""),
      },
    ],
  };
}

export async function iconoAppArt(c: BrandCtx): Promise<Art> {
  const S = 1024;
  const id = nextId("ic");
  return {
    width: S,
    height: S,
    layers: [
      {
        name: "Fondo",
        svg: `<defs><clipPath id="${id}"><rect width="${S}" height="${S}" rx="230"/></clipPath></defs><g clip-path="url(#${id})">${backdropSvg(c.kit, S, S, "oscuro")}</g>`,
      },
      { name: "Símbolo", svg: place(await logo(c, "isotipo", "blanco"), 262, 262, 500, 500).svg },
    ],
  };
}

// ---------- Papelería (puntos tipográficos: 72 por pulgada) ----------

const MM = 72 / 25.4;

// Tarjeta de presentación 90 × 50 mm con 3 mm de sangrado por lado (para la imprenta).
export async function tarjetaArts(c: BrandCtx): Promise<Art[]> {
  const p = kitPalette(c.kit);
  const W = 96 * MM;
  const H = 56 * MM;
  const bleed = 3 * MM;
  const x = bleed + 15;
  const grey = mixHex(p.dark, "#FFFFFF", 0.35);
  const lines = [c.phone, c.address && cut(c.address, 48), site(c)].filter((v): v is string => Boolean(v));
  const bottom = H - bleed - 15;
  const contact = lines.map((l, i) => textSvg(c.fonts.body, l, x, bottom - (lines.length - 1 - i) * 10.5, 7, grey)).join("");
  const nameY = bottom - (lines.length - 1) * 10.5 - 24;
  return [
    {
      width: W,
      height: H,
      layers: [
        { name: "Fondo", svg: backdropSvg(c.kit, W, H, "oscuro") },
        { name: "Logo", svg: place(await logo(c, "principal", "blanco"), 46, 40, W - 92, H - 80).svg },
      ],
    },
    {
      width: W,
      height: H,
      layers: [
        { name: "Fondo", svg: rect(0, 0, W, H, "#FFFFFF") + `<circle cx="${W - bleed}" cy="${bleed}" r="38" fill="${p.secondary}"/>` },
        { name: "Logo", svg: place(await logo(c, "principal", "color"), x, bleed + 14, 120, 30, "start").svg },
        {
          name: "Datos",
          svg:
            textSvg(c.fonts.heading, c.owner || c.name, x, nameY, 11.5, p.dark, { tracking: -0.01 }) +
            textSvg(c.fonts.body, cut(caption(c), 40), x, nameY + 10, 5.6, p.primary, { tracking: 0.14 }) +
            contact,
        },
      ],
    },
  ];
}

async function letterhead(c: BrandCtx): Promise<Layer[]> {
  const p = kitPalette(c.kit);
  const W = 612;
  const grey = mixHex(p.dark, "#FFFFFF", 0.4);
  const lines = [c.phone, c.address && cut(c.address, 60), site(c)].filter((v): v is string => Boolean(v));
  return [
    { name: "Fondo", svg: rect(0, 0, W, 792, "#FFFFFF") + `<circle cx="${W}" cy="0" r="70" fill="${p.secondary}" fill-opacity="0.6"/>` },
    {
      name: "Encabezado",
      svg:
        place(await logo(c, "principal", "color"), 54, 46, 190, 50, "start").svg +
        lines.map((l, i) => textSvg(c.fonts.body, l, 520, 60 + i * 11, 7.5, grey, { anchor: "end" })).join("") +
        `<line x1="54" y1="118" x2="558" y2="118" stroke="#E5E7EB" stroke-width="0.8"/>`,
    },
    {
      name: "Pie",
      svg:
        rect(54, 748, 28, 3, p.primary, 1.5) +
        textSvg(c.fonts.body, cut([c.kit.slogan, site(c)].filter(Boolean).join("   ·   "), 110), 54, 766, 7.5, grey),
    },
  ];
}

export async function membreteArt(c: BrandCtx): Promise<Art> {
  return { width: 612, height: 792, layers: await letterhead(c) };
}

export async function cotizacionArt(c: BrandCtx): Promise<Art> {
  const p = kitPalette(c.kit);
  const grey = mixHex(p.dark, "#FFFFFF", 0.4);
  const tint = mixHex(p.light, p.primary, 0.06);
  const b = (t: string, x: number, y: number, size = 8.5, fill = p.dark, anchor: "start" | "end" | "middle" = "start", tracking = 0) =>
    textSvg(c.fonts.body, t, x, y, size, fill, { anchor, tracking });
  const line = (x1: number, y: number, x2: number) => `<line x1="${x1}" y1="${y}" x2="${x2}" y2="${y}" stroke="#E5E7EB" stroke-width="0.8"/>`;
  let table = rect(54, 250, 504, 26, tint, 8) + b("DESCRIPCIÓN", 66, 266, 7, grey, "start", 0.12) + b("CANT.", 370, 266, 7, grey, "end", 0.12) + b("PRECIO", 460, 266, 7, grey, "end", 0.12) + b("TOTAL", 546, 266, 7, grey, "end", 0.12);
  for (let i = 1; i <= 11; i++) table += line(54, 276 + i * 24, 558);
  const on = onColor(p.primary, p.dark);
  const totals = b("Subtotal", 460, 570, 8.5, grey, "end") + line(470, 574, 558) + b("Descuento", 460, 592, 8.5, grey, "end") + line(470, 596, 558) + rect(380, 608, 178, 32, p.primary, 16) + b("Total", 400, 628, 9.5, on) ;
  const pay = c.paymentMethods.length ? `Formas de pago: ${c.paymentMethods.join(", ")}.` : "";
  return {
    width: 612,
    height: 792,
    layers: [
      ...(await letterhead(c)),
      {
        name: "Cotización",
        svg:
          textSvg(c.fonts.heading, "Cotización", 54, 172, 26, p.dark, { tracking: TITLE }) +
          b("No.", 420, 150, 8, grey) + line(440, 153, 558) + b("Fecha", 420, 170, 8, grey) + line(448, 173, 558) +
          b("Cliente", 54, 212, 8, grey) + line(90, 215, 558) + b("Teléfono", 54, 232, 8, grey) + line(96, 235, 300) + b("Correo", 310, 232, 8, grey) + line(342, 235, 558) +
          table + totals +
          b(`Precios en ${c.currency}.`, 54, 672, 7.5, grey) +
          (pay ? b(cut(pay, 110), 54, 684, 7.5, grey) : "") +
          b("Cotización válida por 15 días.", 54, 696, 7.5, grey),
      },
    ],
  };
}

export async function volanteArt(c: BrandCtx): Promise<Art> {
  const p = kitPalette(c.kit);
  const W = 612;
  const H = 792;
  const grey = mixHex(p.dark, "#FFFFFF", 0.4);
  const list = c.services.slice(0, 8);
  const id = nextId("vt");
  const rows = list
    .map((s, i) => {
      const y = 468 + i * 30;
      return (
        textSvg(c.fonts.body, cut(s.name, 48), 54, y, 11, p.dark) +
        (s.price != null ? textSvg(c.fonts.heading, priceLabel(s.price, c.currency), 558, y, 11, p.primary, { anchor: "end" }) : "") +
        `<line x1="54" y1="${y + 11}" x2="558" y2="${y + 11}" stroke="#E5E7EB" stroke-width="0.7"/>`
      );
    })
    .join("");
  const cta = t3(c, { tu: "Escríbenos por WhatsApp", usted: "Escríbanos por WhatsApp", vos: "Escribinos por WhatsApp" });
  const on = onColor(p.dark, p.primary);
  return {
    width: W,
    height: H,
    layers: [
      {
        name: "Fondo",
        svg:
          rect(0, 0, W, H, "#FFFFFF") +
          `<defs><clipPath id="${id}"><path d="M0 0H${W}V360Q${W} 400 ${W - 40} 400H40Q0 400 0 360Z"/></clipPath></defs><g clip-path="url(#${id})">${backdropSvg(c.kit, W, 400, "oscuro")}</g>`,
      },
      { name: "Logo", svg: place(await logo(c, "principal", "blanco"), 54, 44, 260, 70, "start").svg },
      {
        name: "Eslogan",
        svg:
          pill(c.fonts.body, cut(caption(c), 32), 54, 190, 8, "#FFFFFF") +
          paragraphSvg(c.fonts.heading, c.kit.slogan, 54, 228, 480, 44, "#FFFFFF", { maxLines: 3, lineHeight: 1.02, tracking: TITLE }).svg,
      },
      {
        name: "Lo que ofrecemos",
        svg: list.length
          ? textSvg(c.fonts.body, "LO QUE OFRECEMOS", 54, 438, 8, grey, { tracking: 0.14 }) + rows
          : paragraphSvg(c.fonts.body, c.kit.proposition, 54, 440, 500, 14, p.dark, { maxLines: 3 }).svg,
      },
      {
        name: "Contacto",
        svg:
          rect(40, 712, W - 80, 52, p.dark, 26) +
          textSvg(c.fonts.heading, cut(c.phone ? `${cta}  ·  ${c.phone}` : cta, 60), 64, 742, 11, on) +
          arrow(W - 66, 738, 16, p.primary, onColor(p.primary, p.dark)) +
          (c.address ? textSvg(c.fonts.body, cut(c.address, 90), W / 2, 782, 7.5, grey, { anchor: "middle" }) : ""),
      },
    ],
  };
}

// ---------- Mockups (cómo se ve la marca en la vida real) ----------

export async function letreroArt(c: BrandCtx): Promise<Art> {
  const p = kitPalette(c.kit);
  const W = 1600;
  const H = 1000;
  const glassId = nextId("gl");
  const glass = `<defs><linearGradient id="${glassId}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#46505C"/><stop offset="1" stop-color="#2B323B"/></linearGradient></defs>`;
  const pane = (x: number, w: number) =>
    rect(x, 420, w, 440, `url(#${glassId})`) + `<path d="M${x + 40} 860 L${x + w * 0.55} 420 H${x + w * 0.7} L${x + 110} 860 Z" fill="#FFFFFF" fill-opacity="0.06"/>`;
  return {
    width: W,
    height: H,
    layers: [
      { name: "Fondo", svg: rect(0, 0, W, H, "#ECE9E4") + rect(0, 860, W, 140, "#DAD5CD") + shadow(800, 870, 760, 40, 0.18) + rect(180, 90, 1240, 770, "#F8F6F2", 6) },
      { name: "Letrero", svg: rect(230, 150, 1140, 210, p.primary, 28) + place(await logo(c, "principal", "blanco"), 300, 180, 1000, 150).svg },
      {
        name: "Fachada",
        svg:
          glass +
          rect(230, 400, 1140, 460, "#1E2329") +
          pane(250, 400) +
          rect(670, 420, 260, 440, "#262C33") +
          rect(690, 440, 220, 420, `url(#${glassId})`) +
          `<rect x="880" y="610" width="8" height="90" rx="4" fill="#C9CED6"/>` +
          pane(950, 400) +
          place(await logo(c, "isotipo", "blanco"), 290, 460, 90, 90, "start").svg +
          paragraphSvg(c.fonts.body, c.kit.slogan, 990, 760, 330, 26, "#FFFFFF", { maxLines: 2, opacity: 0.9 }).svg,
      },
      {
        name: "Letrero de pared",
        svg: `<rect x="1420" y="250" width="70" height="10" rx="5" fill="#9AA1A9"/><circle cx="1490" cy="330" r="74" fill="${p.primary}"/>` + place(await logo(c, "isotipo", "blanco"), 1440, 280, 100, 100).svg,
      },
    ],
  };
}

export async function camisetaArt(c: BrandCtx): Promise<Art> {
  const p = kitPalette(c.kit);
  const shirt = p.primary;
  const shade = mixHex(shirt, "#000000", 0.28);
  const g = nextId("ts");
  const body = "M420 170 L250 240 L120 420 L250 520 L330 450 L330 1050 L870 1050 L870 450 L950 520 L1080 420 L950 240 L780 170 C740 250 670 290 600 290 C530 290 460 250 420 170 Z";
  return {
    width: 1200,
    height: 1200,
    layers: [
      { name: "Fondo", svg: backdropSvg({ ...c.kit, pattern: "aurora" }, 1200, 1200, "claro") + shadow(600, 1065, 330, 30, 0.2) },
      {
        name: "Camiseta",
        svg:
          `<defs><linearGradient id="${g}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFFFFF" stop-opacity="0.10"/><stop offset="0.6" stop-color="#000000" stop-opacity="0"/><stop offset="1" stop-color="#000000" stop-opacity="0.18"/></linearGradient></defs>` +
          `<path d="${body}" fill="${shirt}"/><path d="${body}" fill="url(#${g})"/>` +
          `<path d="M420 170 C460 250 530 290 600 290 C670 290 740 250 780 170 L748 160 C708 228 656 254 600 254 C544 254 492 228 452 160 Z" fill="${shade}"/>`,
      },
      { name: "Logo", svg: place(await logo(c, "principal", "blanco"), 640, 380, 170, 90, "start").svg },
    ],
  };
}

export async function bolsaArt(c: BrandCtx): Promise<Art> {
  const p = kitPalette(c.kit);
  const canvas = "#F1E9DB";
  const strap = mixHex(canvas, p.dark, 0.22);
  return {
    width: 1200,
    height: 1200,
    layers: [
      { name: "Fondo", svg: backdropSvg({ ...c.kit, pattern: "aurora" }, 1200, 1200, "claro") + shadow(600, 1075, 320, 32, 0.22) },
      {
        name: "Bolsa",
        svg:
          `<path d="M430 440 C430 230 540 230 540 440 M660 440 C660 230 770 230 770 440" fill="none" stroke="${strap}" stroke-width="26" stroke-linecap="round"/>` +
          rect(320, 420, 560, 640, canvas, 22) +
          `<line x1="320" y1="476" x2="880" y2="476" stroke="${strap}" stroke-opacity="0.35" stroke-width="3" stroke-dasharray="10 9"/>`,
      },
      { name: "Logo", svg: place(await logo(c, c.kit.layout === "palabra" ? "principal" : "vertical", "color"), 380, 560, 440, 360).svg },
    ],
  };
}

export async function vehiculoArt(c: BrandCtx): Promise<Art> {
  const clip = nextId("vh");
  const body = "M180 640V330Q180 250 260 250H1080Q1150 250 1190 300L1330 470Q1400 480 1420 540V640Q1420 690 1370 690H230Q180 690 180 640Z";
  const wheel = (x: number) => `<circle cx="${x}" cy="690" r="80" fill="#1E2228"/><circle cx="${x}" cy="690" r="34" fill="#A7AEB6"/>`;
  return {
    width: 1600,
    height: 900,
    layers: [
      { name: "Fondo", svg: rect(0, 0, 1600, 900, "#EEF0F2") + shadow(800, 770, 720, 40, 0.22) },
      {
        name: "Vehículo",
        svg:
          `<defs><clipPath id="${clip}"><path d="${body}"/></clipPath></defs>` +
          `<path d="${body}" fill="#FFFFFF"/>` +
          `<g clip-path="url(#${clip})"><g transform="translate(180 250)">${backdropSvg(c.kit, 900, 440, "oscuro")}</g></g>` +
          `<path d="${body}" fill="none" stroke="#D5D9DE" stroke-width="3"/>` +
          `<path d="M1095 290H1170Q1190 290 1205 310L1300 445H1095Z" fill="#2F3742"/>` +
          `<line x1="1080" y1="300" x2="1080" y2="680" stroke="#D5D9DE" stroke-width="3"/>` +
          (c.phone ? textSvg(c.fonts.body, c.phone, 600, 586, 30, "#FFFFFF", { opacity: 0.9 }) : "") +
          wheel(400) +
          wheel(1180),
      },
      { name: "Logo", svg: place(await logo(c, "principal", "blanco"), 240, 320, 760, 200, "start").svg },
    ],
  };
}

export async function chatArt(c: BrandCtx, welcome: string): Promise<Art> {
  const p = kitPalette(c.kit);
  const on = onColor(p.primary, p.dark);
  const screen = nextId("ch");
  const msg = paragraphSvg(c.fonts.body, welcome, 262, 600, 440, 26, p.dark, { maxLines: 8, lineHeight: 1.35 });
  const hello = t3(c, { tu: "Hola, ¿tienen disponible?", usted: "Buenas, ¿tienen disponible?", vos: "Hola, ¿tienen disponible?" });
  const helloW = measure(c.fonts.body, hello, 26);
  return {
    width: 1000,
    height: 1500,
    layers: [
      { name: "Fondo", svg: backdropSvg(c.kit, 1000, 1500, "claro") + shadow(500, 1450, 330, 30, 0.25) },
      {
        name: "Teléfono",
        svg:
          `<rect x="190" y="60" width="620" height="1380" rx="84" fill="#0F1115"/>` +
          `<defs><clipPath id="${screen}"><rect x="210" y="80" width="580" height="1340" rx="66"/></clipPath></defs>` +
          `<g clip-path="url(#${screen})">${rect(210, 80, 580, 1340, "#F4F4F6")}${rect(210, 80, 580, 190, p.primary)}</g>` +
          `<rect x="440" y="100" width="120" height="26" rx="13" fill="#0F1115"/>`,
      },
      {
        name: "Perfil",
        svg:
          `<circle cx="282" cy="200" r="44" fill="#FFFFFF"/>` +
          place(await logo(c, "isotipo", "color"), 252, 170, 60, 60).svg +
          textSvg(c.fonts.heading, cut(c.name, 20), 346, 194, 28, on, { tracking: -0.01 }) +
          textSvg(c.fonts.body, "en línea", 346, 228, 20, on, { opacity: 0.75 }),
      },
      {
        name: "Mensajes",
        svg:
          rect(760 - helloW - 44, 330, helloW + 44, 70, mixHex(p.primary, "#FFFFFF", 0.84), 26) +
          textSvg(c.fonts.body, hello, 760 - 22, 374, 26, p.dark, { anchor: "end" }) +
          rect(240, 570, 500, msg.height + 70, "#FFFFFF", 26) +
          msg.svg +
          rect(230, 1320, 480, 64, "#FFFFFF", 32) +
          textSvg(c.fonts.body, "Mensaje", 262, 1360, 22, "#9CA3AF") +
          arrow(752, 1352, 32, p.primary, on),
      },
    ],
  };
}

// ---------- Tablero de marca (presentación tipo agencia) ----------

export async function tableroArt(c: BrandCtx): Promise<Art> {
  const p = kitPalette(c.kit);
  const f = fontsById(c.kit.fonts);
  const W = 1600;
  const H = 1200;
  const tile = (x: number, y: number, w: number, h: number, inner: string, fill?: string) => {
    const id = nextId("tb");
    return `<defs><clipPath id="${id}"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="28"/></clipPath></defs><g clip-path="url(#${id})">${fill ? rect(x, y, w, h, fill) : ""}${inner}</g>`;
  };
  const colors = [p.primary, p.secondary, p.accent, p.dark, p.light];
  const sw = (580 - 4 * 10) / 5;
  const swatches = colors
    .map((hex, i) => {
      const x = 980 + i * (sw + 10);
      return rect(x, 380, sw, 230, hex, 18, ` stroke="#E5E7EB" stroke-width="${hex === p.light ? 2 : 0}"`) + textSvg(c.fonts.body, hex, x + sw / 2, 590, 15, onColor(hex, p.dark), { anchor: "middle" });
    })
    .join("");
  const post = await publicacionArt(c);
  return {
    width: W,
    height: H,
    layers: [
      { name: "Fondo", svg: rect(0, 0, W, H, "#F3F2EF") },
      {
        name: "Logo",
        svg: tile(40, 40, 900, 570, `<g transform="translate(40 40)">${backdropSvg(c.kit, 900, 570, "claro")}</g>` + place(await logo(c, "principal", "color"), 130, 180, 720, 290).svg),
      },
      { name: "Símbolo", svg: tile(960, 40, 600, 320, `<g transform="translate(960 40)">${backdropSvg(c.kit, 600, 320, "oscuro")}</g>` + place(await logo(c, "isotipo", "blanco"), 1180, 120, 160, 160).svg) },
      { name: "Colores", svg: tile(960, 380, 600, 230, swatches) },
      {
        name: "Tipografía",
        svg: tile(
          40,
          630,
          500,
          530,
          textSvg(c.fonts.heading, "Aa", 80, 860, 220, p.dark, { tracking: -0.04 }) +
            textSvg(c.fonts.heading, f.heading.family, 80, 960, 34, p.dark) +
            textSvg(c.fonts.body, `Textos: ${f.body.family}`, 80, 1004, 22, mixHex(p.dark, "#FFFFFF", 0.4)) +
            paragraphSvg(c.fonts.body, "ABCDEFGHIJKLMNÑOPQRSTUVWXYZ abcdefghijklmnñopqrstuvwxyz 0123456789", 80, 1050, 420, 20, mixHex(p.dark, "#FFFFFF", 0.3), { maxLines: 3 }).svg,
          "#FFFFFF",
        ),
      },
      {
        name: "Eslogan",
        svg: tile(
          560,
          630,
          500,
          530,
          `<g transform="translate(560 630)">${backdropSvg(c.kit, 500, 530, "oscuro")}</g>` +
            pill(c.fonts.body, cut(caption(c), 22), 600, 680, 14, "#FFFFFF") +
            paragraphSvg(c.fonts.heading, c.kit.slogan, 600, 780, 420, 56, "#FFFFFF", { maxLines: 5, lineHeight: 1.02, tracking: TITLE }).svg,
        ),
      },
      { name: "Publicación", svg: tile(1080, 630, 480, 530, rect(1080, 630, 480, 530, "#FFFFFF") + place(post, 1100, 665, 440, 440).svg) },
    ],
  };
}

// ---------- Sistema dinámico (el mismo logo en distintos fondos y colores) ----------

export async function sistemaArt(c: BrandCtx): Promise<Art> {
  const variants = dynamicVariants(c.kit);
  const W = 1800;
  const H = 1200;
  const tw = (W - 80 - 2 * 20) / 3;
  const th = (H - 80 - 20) / 2;
  let tiles = "";
  for (const [i, v] of variants.entries()) {
    const x = 40 + (i % 3) * (tw + 20);
    const y = 40 + Math.floor(i / 3) * (th + 20);
    const id = nextId("dv");
    const ink = v.theme === "blanco" ? "#FFFFFF" : kitPalette(c.kit).dark;
    tiles +=
      `<defs><clipPath id="${id}"><rect x="${x}" y="${y}" width="${tw}" height="${th}" rx="28"/></clipPath></defs>` +
      `<g clip-path="url(#${id})"><rect x="${x}" y="${y}" width="${tw}" height="${th}" fill="${v.bg}"/></g>` +
      (v.bg === "#FFFFFF" ? `<rect x="${x}" y="${y}" width="${tw}" height="${th}" rx="28" fill="none" stroke="#E5E7EB" stroke-width="2"/>` : "") +
      place(await logo(c, "principal", v.theme), x + 60, y + 90, tw - 120, th - 200).svg +
      textSvg(c.fonts.body, v.label.toLocaleUpperCase("es"), x + 40, y + th - 40, 18, ink, { tracking: 0.14, opacity: 0.75 });
  }
  return { width: W, height: H, layers: [{ name: "Fondo", svg: rect(0, 0, W, H, "#F3F2EF") }, { name: "Sistema", svg: tiles }] };
}
