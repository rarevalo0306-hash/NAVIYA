import "server-only";
import { writePsdBuffer } from "ag-psd";
import { AlignmentType, Document, Footer, Header, ImageRun, Packer, Paragraph, TextRun } from "docx";
import { zipSync } from "fflate";
import PDFDocument from "pdfkit";
import sharp from "sharp";
import SVGtoPDF from "svg-to-pdfkit";
import { backdropSvg, cmykText, fontsById, kitPalette, rgbText, rulesBase, type BrandKit } from "@/lib/brand";
import {
  bannerArt,
  bolsaArt,
  CTA,
  destacadaArt,
  camisetaArt,
  chatArt,
  cotizacionArt,
  historiaArt,
  iconoAppArt,
  letreroArt,
  membreteArt,
  perfilArt,
  portadaArt,
  publicacionArt,
  sistemaArt,
  tableroArt,
  tarjetaArts,
  vehiculoArt,
  volanteArt,
  type BrandCtx,
} from "@/lib/brand-art";
import { bookPages } from "@/lib/brand-book";
import { emailSignatureHtml } from "@/lib/brand-signature";
import { artSvg, logoArt, type Art, type LogoTheme, type LogoVariant } from "@/lib/brand-render";

// Archivos del kit de marca en todos los formatos: SVG (vector), PNG (fondo transparente), JPG,
// PDF (vector: se abre y se edita en Illustrator), PSD (Photoshop, por capas), Word, paleta de
// Adobe (.ase) y todo junto en un .zip.

export type Format = "svg" | "png" | "jpg" | "pdf" | "psd" | "docx" | "ase" | "txt" | "html";
export type Group = "Presentación" | "Logo" | "Redes sociales" | "Papelería" | "Mockups" | "Colores y patrón";

type Item = {
  id: string;
  label: string;
  group: Group;
  formats: Format[];
  px: number; // ancho de PNG / JPG / PSD
  art?: (c: BrandCtx) => Promise<Art | Art[]>;
};

const baseFor = (c: BrandCtx) =>
  c.kit.base ??
  rulesBase(
    { name: c.name, industry: c.industry, business_type: null, offers_delivery: null, payment_methods: c.paymentMethods, address_form: c.form, zone: c.zone },
    c.kit,
  );
const welcomeFor = (c: BrandCtx) => baseFor(c).whatsappWelcome;

const logoItem = (id: string, label: string, variant: LogoVariant, theme: LogoTheme, formats: Format[], px: number): Item => ({
  id,
  label,
  group: "Logo",
  formats,
  px,
  art: (c) => logoArt(c.kit, c.name, variant, theme, c.fonts),
});

export const ITEMS: Item[] = [
  { id: "manual", label: "Manual de marca (libro completo)", group: "Presentación", formats: ["pdf"], px: 1920, art: bookPages },
  { id: "tablero", label: "Tablero de marca (presentación)", group: "Presentación", formats: ["png", "jpg", "pdf"], px: 2400, art: tableroArt },
  { id: "sistema-dinamico", label: "Sistema dinámico (el logo en distintos colores)", group: "Presentación", formats: ["png", "pdf"], px: 2400, art: sistemaArt },
  { id: "textos", label: "Textos de marca (listos para copiar y pegar)", group: "Presentación", formats: ["docx", "txt"], px: 0 },
  { id: "firma-correo", label: "Firma de correo (ábrela, cópiala y pégala en tu email)", group: "Presentación", formats: ["html"], px: 0 },
  logoItem("logo", "Logo principal", "principal", "color", ["svg", "png", "jpg", "pdf", "psd"], 2400),
  {
    id: "logo-horizontal",
    label: "Logo horizontal (símbolo a la izquierda)",
    group: "Logo",
    formats: ["svg", "png", "pdf"],
    px: 2400,
    art: (c) => logoArt({ ...c.kit, layout: "clasico" }, c.name, "principal", "color", c.fonts),
  },
  logoItem("logo-vertical", "Logo vertical", "vertical", "color", ["svg", "png", "pdf"], 1600),
  logoItem("logo-blanco", "Logo en blanco (fondos oscuros)", "principal", "blanco", ["svg", "png", "pdf"], 2400),
  logoItem("logo-un-color", "Logo a un color", "principal", "mono", ["svg", "png", "pdf"], 2400),
  logoItem("isotipo", "Isotipo (solo el símbolo)", "isotipo", "color", ["svg", "png", "pdf"], 1200),
  logoItem("sello", "Sello redondo", "sello", "color", ["svg", "png", "pdf"], 1200),
  { id: "icono-app", label: "Ícono (app, favicon)", group: "Logo", formats: ["png"], px: 1024, art: iconoAppArt },
  { id: "perfil", label: "Foto de perfil", group: "Redes sociales", formats: ["png", "jpg", "psd"], px: 1000, art: perfilArt },
  { id: "portada", label: "Portada de Facebook", group: "Redes sociales", formats: ["png", "jpg", "psd"], px: 1640, art: portadaArt },
  { id: "publicacion", label: "Publicación (Instagram / Facebook)", group: "Redes sociales", formats: ["png", "jpg", "psd"], px: 1080, art: publicacionArt },
  { id: "historia", label: "Historia / Estado de WhatsApp", group: "Redes sociales", formats: ["png", "jpg", "psd"], px: 1080, art: historiaArt },
  { id: "tarjeta", label: "Tarjeta de presentación (imprenta, 2 caras)", group: "Papelería", formats: ["pdf", "png"], px: 1134, art: tarjetaArts },
  { id: "membrete", label: "Hoja membretada", group: "Papelería", formats: ["pdf", "docx", "png"], px: 1700, art: membreteArt },
  { id: "cotizacion", label: "Formato de cotización", group: "Papelería", formats: ["pdf", "png"], px: 1700, art: cotizacionArt },
  { id: "volante", label: "Volante", group: "Papelería", formats: ["pdf", "png", "jpg", "psd"], px: 1700, art: volanteArt },
  { id: "letrero", label: "Letrero del local", group: "Mockups", formats: ["png", "jpg"], px: 1600, art: letreroArt },
  { id: "camiseta", label: "Camiseta / uniforme", group: "Mockups", formats: ["png", "jpg"], px: 1200, art: camisetaArt },
  { id: "bolsa", label: "Bolsa", group: "Mockups", formats: ["png", "jpg"], px: 1200, art: bolsaArt },
  { id: "vehiculo", label: "Vehículo de reparto", group: "Mockups", formats: ["png", "jpg"], px: 1600, art: vehiculoArt },
  { id: "chat", label: "Chat de WhatsApp", group: "Mockups", formats: ["png"], px: 1000, art: (c) => chatArt(c, welcomeFor(c)) },
  { id: "fondo-oscuro", label: "Fondo de marca (oscuro)", group: "Colores y patrón", formats: ["svg", "png"], px: 2400, art: async (c) => fondoArt(c, "oscuro") },
  { id: "fondo-claro", label: "Fondo de marca (claro)", group: "Colores y patrón", formats: ["svg", "png"], px: 2400, art: async (c) => fondoArt(c, "claro") },
  { id: "colores", label: "Paleta de colores (Adobe .ase y texto)", group: "Colores y patrón", formats: ["ase", "txt"], px: 0 },
];

export const FORMAT_LABEL: Record<Format, string> = {
  svg: "SVG",
  png: "PNG",
  jpg: "JPG",
  pdf: "PDF (Illustrator)",
  psd: "PSD (Photoshop)",
  docx: "Word",
  ase: "Adobe .ase",
  txt: "Texto",
  html: "HTML",
};

const MIME: Record<Format | "zip", string> = {
  svg: "image/svg+xml",
  png: "image/png",
  jpg: "image/jpeg",
  pdf: "application/pdf",
  psd: "image/vnd.adobe.photoshop",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ase: "application/octet-stream",
  txt: "text/plain; charset=utf-8",
  html: "text/html; charset=utf-8",
  zip: "application/zip",
};

export const ZIP_NAME = "kit-de-marca.zip";

export function parseFile(file: string): { item: Item; format: Format } | { page: number } | "zip" | null {
  if (file === ZIP_NAME) return "zip";
  const page = file.match(/^manual-(\d{1,2})\.png$/);
  if (page) return { page: Number(page[1]) };
  const m = file.match(/^([a-z-]+)\.([a-z]+)$/);
  const item = m && ITEMS.find((i) => i.id === m[1]);
  if (!item || !item.formats.includes(m![2] as Format)) return null;
  return { item, format: m![2] as Format };
}

// ---------- Codificadores ----------

const first = (a: Art | Art[]) => (Array.isArray(a) ? a[0] : a);

async function toPng(art: Art, width: number) {
  const density = Math.min(2400, (72 * width) / art.width);
  return sharp(Buffer.from(artSvg(art)), { density }).resize({ width: Math.round(width) }).png().toBuffer();
}

async function toJpg(art: Art, width: number) {
  return sharp(await toPng(art, width)).flatten({ background: "#FFFFFF" }).jpeg({ quality: 92 }).toBuffer();
}

function toPdf(arts: Art[], title: string, scale = 1): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ autoFirstPage: false, margin: 0, info: { Title: title, Creator: "Orbusiness" } });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    for (const a of arts) {
      const w = a.width * scale;
      const h = a.height * scale;
      doc.addPage({ size: [w, h], margin: 0 });
      SVGtoPDF(doc, artSvg(a, scale), 0, 0, { width: w, height: h, assumePt: true });
    }
    doc.end();
  });
}

// Recorta una capa a los píxeles visibles (las capas de Photoshop guardan solo su área).
function cropLayer(img: { width: number; height: number; data: Uint8ClampedArray }) {
  const { width, height, data } = img;
  let [minX, minY, maxX, maxY] = [width, height, -1, -1];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3]) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return { left: 0, top: 0, imageData: { width: 1, height: 1, data: new Uint8ClampedArray(4) } };
  const w = maxX - minX + 1;
  const h = maxY - minY + 1;
  const out = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) out.set(data.subarray(((minY + y) * width + minX) * 4, ((minY + y) * width + minX + w) * 4), y * w * 4);
  return { left: minX, top: minY, imageData: { width: w, height: h, data: out } };
}

async function toPsd(art: Art, width: number) {
  const W = Math.round(width);
  const H = Math.round((art.height * width) / art.width);
  const raster = async (inner: string) => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${art.width} ${art.height}" width="${W}" height="${H}">${inner}</svg>`;
    const { data, info } = await sharp(Buffer.from(svg)).resize(W, H).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    return { width: info.width, height: info.height, data: new Uint8ClampedArray(data.buffer, data.byteOffset, data.length) };
  };
  const children = [];
  for (const layer of art.layers) children.push({ name: layer.name, ...cropLayer(await raster(layer.svg)) });
  const composite = await raster(art.layers.map((l) => l.svg).join(""));
  return Buffer.from(writePsdBuffer({ width: W, height: H, imageData: composite, children }, { generateThumbnail: false, noBackground: true }));
}

// Paleta de Adobe (.ase): se importa en Illustrator, Photoshop e InDesign.
function toAse(colors: { name: string; hex: string }[]) {
  const blocks = colors.map(({ name, hex }) => {
    const label = Buffer.alloc(2 + (name.length + 1) * 2);
    label.writeUInt16BE(name.length + 1, 0);
    for (let i = 0; i < name.length; i++) label.writeUInt16BE(name.charCodeAt(i), 2 + i * 2);
    const body = Buffer.alloc(4 + 12 + 2);
    body.write("RGB ", 0, "ascii");
    [1, 3, 5].forEach((o, i) => body.writeFloatBE(parseInt(hex.slice(o, o + 2), 16) / 255, 4 + i * 4));
    body.writeUInt16BE(2, 16); // color normal
    const head = Buffer.alloc(6);
    head.writeUInt16BE(0x0001, 0);
    head.writeUInt32BE(label.length + body.length, 2);
    return Buffer.concat([head, label, body]);
  });
  const header = Buffer.alloc(12);
  header.write("ASEF", 0, "ascii");
  header.writeUInt16BE(1, 4);
  header.writeUInt16BE(0, 6);
  header.writeUInt32BE(blocks.length, 8);
  return Buffer.concat([header, ...blocks]);
}

function paletteList(c: BrandCtx) {
  const p = kitPalette(c.kit);
  return [
    { name: "Principal", hex: p.primary },
    { name: "Secundario", hex: p.secondary },
    { name: "Acento", hex: p.accent },
    { name: "Oscuro", hex: p.dark },
    { name: "Claro", hex: p.light },
  ];
}

function fondoArt(c: BrandCtx, tone: "oscuro" | "claro"): Art {
  return { width: 1600, height: 1000, layers: [{ name: "Fondo", svg: backdropSvg(c.kit, 1600, 1000, tone) }] };
}

async function toDocx(c: BrandCtx) {
  const p = kitPalette(c.kit);
  const f = fontsById(c.kit.fonts);
  const logo = await logoArt(c.kit, c.name, "principal", "color", c.fonts);
  const png = await toPng(logo, 900);
  const lines = [c.phone, c.address, c.siteUrl?.replace(/^https?:\/\//, "")].filter((v): v is string => Boolean(v));
  const logoW = 200;
  const doc = new Document({
    creator: "Orbusiness",
    title: `Membrete ${c.name}`,
    styles: { default: { document: { run: { font: f.body.family, size: 22 } } } },
    sections: [
      {
        properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 2000, bottom: 1500, left: 1080, right: 1080, header: 600, footer: 500 } } },
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                children: [new ImageRun({ type: "png", data: png, transformation: { width: logoW, height: Math.round((logoW * logo.height) / logo.width) } })],
              }),
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                border: { bottom: { style: "single", size: 12, color: p.primary.slice(1), space: 4 } },
                children: lines.map((l, i) => new TextRun({ text: l, size: 17, color: p.dark.slice(1), break: i ? 1 : 0 })),
              }),
            ],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [new TextRun({ text: [c.kit.slogan, c.siteUrl?.replace(/^https?:\/\//, "")].filter(Boolean).join("   ·   "), size: 16, color: p.primary.slice(1) })],
              }),
            ],
          }),
        },
        children: [new Paragraph({ children: [new TextRun({ text: "" })] })],
      },
    ],
  });
  return Packer.toBuffer(doc);
}

// Logo principal en PNG (para guardarlo en internet: firma de email).
export async function logoPng(kit: BrandKit, name: string, width: number) {
  return toPng(await logoArt(kit, name, "principal", "color"), width);
}

// ---------- Generar ----------

export async function brandFile(c: BrandCtx, item: Item, format: Format): Promise<{ data: Buffer; type: string }> {
  const out = async (): Promise<Buffer | string> => {
    if (item.id === "colores") {
      const list = paletteList(c);
      if (format === "ase") return toAse(list);
      return list.map((x) => `${x.name}\tHEX ${x.hex}\tRGB ${rgbText(x.hex)}\tCMYK ${cmykText(x.hex)}`).join("\n") + "\n";
    }
    if (item.id === "textos") return format === "docx" ? textosDocx(c) : brandTexts(c).map(([t, v]) => `${t.toUpperCase()}\n${v}\n`).join("\n");
    if (item.id === "firma-correo") return signatureFile(c);
    if (format === "docx") return toDocx(c);
    const arts = await item.art!(c);
    const list = Array.isArray(arts) ? arts : [arts];
    switch (format) {
      case "svg":
        return artSvg(first(arts));
      case "png":
        return toPng(first(arts), item.px);
      case "jpg":
        return toJpg(first(arts), item.px);
      case "pdf":
        // Logos: página del tamaño del logo, ampliada para que se vea bien al abrirla.
        return toPdf(list, `${item.label} · ${c.name}`, item.group === "Logo" ? 3 : item.id === "manual" ? 0.5 : 1);
      case "psd":
        return toPsd(first(arts), item.px);
      default:
        throw new Error("Formato no disponible");
    }
  };
  const data = await out();
  return { data: typeof data === "string" ? Buffer.from(data) : data, type: MIME[format] };
}

// Los textos de la marca, en el orden en que el dueño los va a usar (redes, Google, WhatsApp...).
function brandTexts(c: BrandCtx): [string, string][] {
  const b = baseFor(c);
  const list = (xs: string[]) => xs.map((x) => `• ${x}`).join("\n");
  return [
    ["Eslogan", c.kit.slogan],
    ["Bio para redes (Instagram / Facebook)", b.bio],
    ["Descripción para Google y WhatsApp Business", b.description],
    ["Mensaje de bienvenida de WhatsApp", b.whatsappWelcome],
    ["Hashtags", b.hashtags.join(" ")],
    ["Ideas de publicaciones", list(b.postIdeas)],
    ["Mensajes clave", list(b.messages)],
    ["Así sí hablamos", list(b.voiceDo)],
    ["Así no hablamos", list(b.voiceDont)],
    ["Historia de la marca", b.story],
    ["Misión", b.mission],
    ["Visión", b.vision],
    ["Valores", list(b.values.map((v) => `${v.name}: ${v.text}`))],
    ["Cliente ideal", b.audience],
    ["Promesa de marca", b.promise],
    ["Cómo deben ser las fotos", b.photoStyle],
  ].filter((x): x is [string, string] => Boolean(x[1]));
}

async function textosDocx(c: BrandCtx) {
  const f = fontsById(c.kit.fonts);
  const p = kitPalette(c.kit);
  const doc = new Document({
    creator: "Orbusiness",
    title: `Textos de marca · ${c.name}`,
    styles: { default: { document: { run: { font: f.body.family, size: 22 } } } },
    sections: [
      {
        children: [
          new Paragraph({ spacing: { after: 300 }, children: [new TextRun({ text: `Textos de marca · ${c.name}`, bold: true, size: 40, font: f.heading.family, color: p.primary.replace("#", "") })] }),
          ...brandTexts(c).flatMap(([title, text]) => [
            new Paragraph({ spacing: { before: 240, after: 80 }, children: [new TextRun({ text: title, bold: true, size: 26, color: p.dark.replace("#", "") })] }),
            ...text.split("\n").map((line) => new Paragraph({ spacing: { after: 60 }, children: [new TextRun(line)] })),
          ]),
        ],
      },
    ],
  });
  return Packer.toBuffer(doc);
}

// La firma como página web: se abre en el navegador, se copia y se pega en la firma del correo.
function signatureFile(c: BrandCtx) {
  const sig = emailSignatureHtml({ name: c.name, owner: c.owner, phone: c.phone, address: c.address, siteUrl: c.siteUrl, logoUrl: c.logoUrl ?? null, kit: c.kit });
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Firma de correo</title></head>
<body style="font-family:Arial,Helvetica,sans-serif;margin:40px;color:#222">
<p style="color:#666;max-width:560px">Selecciona la firma de abajo (desde el logo hasta el eslogan), cópiala y pégala en la configuración de firma de tu correo
(Gmail: Configuración → Ver todos los ajustes → Firma. Outlook: Configuración → Correo → Redactar y responder).</p>
<hr style="margin:24px 0;border:none;border-top:1px solid #ddd">
${sig}
</body></html>`;
}

// Una página del manual, en PNG (para verlo en pantalla).
export async function bookPage(c: BrandCtx, n: number) {
  const pages = await bookPages(c);
  const page = pages[n - 1];
  if (!page) return null;
  return { data: await toPng(page, 1920), type: MIME.png, count: pages.length };
}

// Logos como los entregan las agencias: vector, PNG transparente en 4 tamaños, JPG con fondo
// blanco, íconos web y Photoshop, con nombres claros (Negocio_Logo_Principal_Color_1200px.png).
const LOGO_NAMES: Record<string, string> = {
  logo: "Logo_Principal_Color",
  "logo-horizontal": "Logo_Horizontal_Color",
  "logo-vertical": "Logo_Vertical_Color",
  "logo-blanco": "Logo_Principal_Blanco",
  "logo-un-color": "Logo_Principal_UnColor",
  isotipo: "Simbolo_Color",
  sello: "Sello_Color",
};
const PNG_SIZES = [300, 600, 1200, 2000];

// "Los Loquitos.com" -> "LosLoquitos": sin espacios ni acentos, para nombres de archivo.
const fileBrand = (name: string) =>
  name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\.[a-z]{2,4}$/i, "")
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join("") || "Marca";

// favicon.ico con 16, 32 y 48 px (el formato .ico guarda varios PNG juntos).
async function toIco(png: Buffer) {
  const sizes = [16, 32, 48];
  const imgs = await Promise.all(sizes.map((px) => sharp(png).resize(px, px).png().toBuffer()));
  const head = Buffer.alloc(6 + 16 * imgs.length);
  head.writeUInt16LE(1, 2);
  head.writeUInt16LE(imgs.length, 4);
  let offset = head.length;
  imgs.forEach((img, i) => {
    const o = 6 + 16 * i;
    head.writeUInt8(sizes[i], o);
    head.writeUInt8(sizes[i], o + 1);
    head.writeUInt16LE(1, o + 4);
    head.writeUInt16LE(32, o + 6);
    head.writeUInt32LE(img.length, o + 8);
    head.writeUInt32LE(offset, o + 12);
    offset += img.length;
  });
  return Buffer.concat([head, ...imgs]);
}

const README = (name: string) => `KIT DE MARCA · ${name}

Logo/01 Vector ............ SVG y PDF: para imprenta, rótulos y diseñadores (se agrandan sin perder calidad; el PDF se edita en Illustrator).
Logo/02 PNG transparente .. Para usar sobre fotos o colores: 300 px (correo y web), 600 px, 1200 px (redes) y 2000 px (impresión pequeña).
Logo/03 JPG fondo blanco .. Para documentos, Word y donde no se acepta transparencia.
Logo/04 Iconos web ........ favicon.ico y los íconos para celular (apple-touch-icon, android-chrome) de tu página web.
Logo/05 Photoshop ......... PSD por capas.
Redes sociales ............ Una carpeta por red (Facebook, Instagram, WhatsApp, TikTok, Google, LinkedIn, YouTube, X) con todas
                            sus plantillas en el tamaño exacto y con el llamado de esa red: el PNG se sube tal cual y el PSD
                            (Photoshop, por capas) es para editarlo.
Presentación .............. Manual de marca, tablero, textos de marca (para copiar y pegar) y firma de correo (con su logo).
Papelería ................. Tarjeta, hoja membretada (PDF y Word), cotización y volante para imprenta.
Mockups ................... Cómo se ve tu marca en letrero, camiseta, bolsa, vehículo y WhatsApp.
Colores y patrón .......... Paleta (HEX, RGB, CMYK y Adobe .ase) y fondos de marca.

Hecho con Orbusiness.
`;

// Plantillas por red: cada una en su tamaño exacto (PNG para subir tal cual) y las que se diseñan
// también en PSD por capas para editarlas. [carpeta/nombre, arte, ancho en px, con PSD]
type Template = [string, Art, number, boolean];
async function socialTemplates(c: BrandCtx): Promise<Template[]> {
  // Cada red con su llamado propio (Messenger, mensaje directo, WhatsApp, "Síguenos en TikTok"...).
  const [perfil, portada, destacada] = await Promise.all([perfilArt(c), portadaArt(c), destacadaArt(c)]);
  const [fbPost, fbPostV, fbStory, igPost, igPostV, igStory, igReel, waStory, waCatalog, ttCover] = await Promise.all([
    publicacionArt(c, 1080, CTA.messenger),
    publicacionArt(c, 1350, CTA.messenger),
    historiaArt(c, CTA.facebook),
    publicacionArt(c, 1080, CTA.dm),
    publicacionArt(c, 1350, CTA.dm),
    historiaArt(c, CTA.instagram),
    historiaArt(c, CTA.video),
    historiaArt(c, CTA.whatsapp),
    publicacionArt(c, 1080, CTA.pideWhatsapp),
    historiaArt(c, CTA.tiktok),
  ]);
  const [evento, linkedin, linkedinPost, youtube, miniatura, x, xPost, google, googlePost] = await Promise.all([
    bannerArt(c, 1920, 1005, 1920, 1005, 0, true),
    bannerArt(c, 1584, 396, 1080, 396, 480),
    bannerArt(c, 1200, 627, 1200, 627, 0, true),
    bannerArt(c, 2560, 1440, 1546, 423),
    bannerArt(c, 1280, 720, 1280, 720, 0, true),
    bannerArt(c, 1500, 500),
    bannerArt(c, 1600, 900, 1600, 900, 0, true),
    bannerArt(c, 1080, 608),
    bannerArt(c, 1200, 900, 1200, 900, 0, true),
  ]);
  return [
    ["Facebook/Foto de perfil (720x720)", perfil, 720, false],
    ["Facebook/Portada (1640x624)", portada, 1640, true],
    ["Facebook/Publicación cuadrada (1080x1080)", fbPost, 1080, true],
    ["Facebook/Publicación vertical (1080x1350)", fbPostV, 1080, true],
    ["Facebook/Historia (1080x1920)", fbStory, 1080, true],
    ["Facebook/Portada de evento (1920x1005)", evento, 1920, true],
    ["Instagram/Foto de perfil (1080x1080)", perfil, 1080, false],
    ["Instagram/Publicación cuadrada (1080x1080)", igPost, 1080, true],
    ["Instagram/Publicación vertical (1080x1350)", igPostV, 1080, true],
    ["Instagram/Historia (1080x1920)", igStory, 1080, true],
    ["Instagram/Portada de Reel (1080x1920)", igReel, 1080, true],
    ["Instagram/Portada de historias destacadas (1080x1920)", destacada, 1080, true],
    ["WhatsApp Business/Foto de perfil (640x640)", perfil, 640, false],
    ["WhatsApp Business/Estado (1080x1920)", waStory, 1080, true],
    ["WhatsApp Business/Imagen para el catálogo (1080x1080)", waCatalog, 1080, true],
    ["TikTok/Foto de perfil (720x720)", perfil, 720, false],
    ["TikTok/Portada de video (1080x1920)", ttCover, 1080, true],
    ["Google (Perfil de negocio)/Logo (720x720)", perfil, 720, false],
    ["Google (Perfil de negocio)/Portada (1080x608)", google, 1080, true],
    ["Google (Perfil de negocio)/Publicación (1200x900)", googlePost, 1200, true],
    ["LinkedIn/Foto de perfil (400x400)", perfil, 400, false],
    ["LinkedIn/Portada (1584x396)", linkedin, 1584, true],
    ["LinkedIn/Publicación (1200x627)", linkedinPost, 1200, true],
    ["YouTube/Foto de perfil (800x800)", perfil, 800, false],
    ["YouTube/Portada (2560x1440)", youtube, 2560, true],
    ["YouTube/Miniatura de video (1280x720)", miniatura, 1280, true],
    ["X (Twitter)/Foto de perfil (400x400)", perfil, 400, false],
    ["X (Twitter)/Portada (1500x500)", x, 1500, true],
    ["X (Twitter)/Publicación (1600x900)", xPost, 1600, true],
  ];
}

// Todo el kit en un .zip, ordenado en carpetas.
export async function brandZip(c: BrandCtx) {
  const files: Record<string, Uint8Array> = {};
  const brand = fileBrand(c.name);
  const add = (path: string, data: Buffer | string) => (files[path] = new Uint8Array(typeof data === "string" ? Buffer.from(data) : data));
  add("LEEME.txt", README(c.name));
  const seen = new Set<string>(); // si el horizontal o el vertical salen igual al principal, no se repiten
  for (const item of ITEMS) {
    const logoName = LOGO_NAMES[item.id];
    if (logoName) {
      const art = first(await item.art!(c));
      const svg = artSvg(art);
      if (seen.has(svg)) continue;
      seen.add(svg);
      const n = `${brand}_${logoName}`;
      add(`Logo/01 Vector/${n}.svg`, artSvg(art));
      add(`Logo/01 Vector/${n}.pdf`, await toPdf([art], `${item.label} · ${c.name}`, 3));
      const big = await toPng(art, 2000);
      for (const px of PNG_SIZES) add(`Logo/02 PNG transparente/${n}_${px}px.png`, px === 2000 ? big : await sharp(big).resize({ width: px }).png().toBuffer());
      // El logo blanco sobre fondo blanco no se vería.
      if (item.id !== "logo-blanco") add(`Logo/03 JPG fondo blanco/${n}_2000px.jpg`, await sharp(big).flatten({ background: "#FFFFFF" }).jpeg({ quality: 92 }).toBuffer());
      if (item.formats.includes("psd")) add(`Logo/05 Photoshop/${n}.psd`, await toPsd(art, item.px));
      continue;
    }
    if (item.id === "icono-app") {
      const icon = await toPng(first(await item.art!(c)), 512);
      const web = "Logo/04 Iconos web";
      add(`${web}/favicon.ico`, await toIco(icon));
      add(`${web}/apple-touch-icon.png`, await sharp(icon).resize(180).png().toBuffer());
      add(`${web}/android-chrome-192x192.png`, await sharp(icon).resize(192).png().toBuffer());
      add(`${web}/android-chrome-512x512.png`, icon);
      for (const px of [32, 48, 64, 128]) add(`${web}/${brand}_Icono_${px}px.png`, await sharp(icon).resize(px).png().toBuffer());
      continue;
    }
    if (item.group === "Redes sociales") continue; // van abajo, por red
    for (const format of item.formats) add(`${item.group}/${brand}_${item.id}.${format}`, (await brandFile(c, item, format)).data);
  }
  // Lo que se repite entre redes (la misma historia para Facebook, Instagram, WhatsApp...) se dibuja una vez.
  // Los editables (PSD) van una sola vez, diciendo en qué redes se usan: repetirlos por red pesaba el doble.
  const pngs = new Map<string, Promise<Buffer>>();
  const editables = new Map<string, { art: Art; px: number; name: string; networks: string[] }>();
  const ids = new Map<Art, number>();
  for (const [path, art, px, editable] of await socialTemplates(c)) {
    if (!ids.has(art)) ids.set(art, ids.size);
    const key = `${ids.get(art)}:${px}`;
    if (!pngs.has(key)) pngs.set(key, toPng(art, px));
    add(`Redes sociales/${path}.png`, await pngs.get(key)!);
    const [network, name] = path.split("/");
    if (!editable) continue;
    const e = editables.get(key) ?? { art, px, name, networks: [] };
    if (!e.networks.includes(network)) e.networks.push(network);
    editables.set(key, e);
  }
  // El PSD va junto a su PNG en la carpeta de la red; si un diseño lo comparten varias redes, va una sola vez aparte.
  for (const e of editables.values()) {
    const path = e.networks.length === 1 ? `${e.networks[0]}/${e.name}` : `Editables (Photoshop)/${e.name} - ${e.networks.join(", ")}`;
    add(`Redes sociales/${path}.psd`, await toPsd(e.art, e.px));
  }
  const horizontal = await logoArt({ ...c.kit, layout: "clasico" }, c.name, "principal", "color", c.fonts);
  add("Presentación/Firma de correo - logo (320px).png", await toPng(horizontal, 320));
  return { data: Buffer.from(zipSync(files, { level: 6 })), type: MIME.zip };
}
