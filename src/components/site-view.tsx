import type { CSSProperties, ReactNode } from "react";
import { BrandLogo } from "@/components/brand-logo";
import { Fit } from "@/components/fit";
import {
  backdropCss,
  contrast,
  fontsById,
  googleFontsHref,
  kitPalette,
  mixHex,
  onColor,
  palettesFor,
  sanitizeKit,
  type BrandKit,
  type Palette,
} from "@/lib/brand";
import { currencyName, money, priceLabel } from "@/lib/interview";
import type { SiteContent, SiteItem } from "@/lib/site";
import { templateById, type SiteTemplate } from "@/lib/site-templates";

// La página web de un negocio, con la plantilla que eligió el dueño. Usa los colores, letras y logo
// de su kit de marca (o una paleta moderna según su giro si no tiene kit). Todo es adaptable:
// se diseña primero para celular y crece para tablet y computadora.

// ---------- Tema (variables CSS) ----------

function siteTheme(p: Palette, heading: string, body: string, tpl: SiteTemplate, kit: BrandKit | null) {
  const safe = (fg: string, bg: string, fallback: string, min = 4.5) => (contrast(fg, bg) >= min ? fg : fallback);
  const corners = { rectas: ["4px", "6px", "6px"], suaves: ["14px", "26px", "999px"], redondas: ["22px", "38px", "999px"] }[tpl.corners];
  let t: Record<string, string>;
  if (tpl.mode === "oscuro") {
    const btn = safe(p.accent, p.dark, p.light);
    t = {
      "--bg": p.dark,
      "--surface": mixHex(p.dark, "#FFFFFF", 0.07),
      "--ink": p.light,
      "--muted": mixHex(p.light, p.dark, 0.35),
      "--line": mixHex(p.dark, p.light, 0.16),
      "--btn": btn,
      "--on-btn": onColor(btn, p.dark),
      "--eyebrow": safe(p.accent, p.dark, p.light),
      "--band": mixHex(p.dark, "#FFFFFF", 0.05),
      "--on-band": p.light,
    };
  } else if (tpl.mode === "contraste") {
    const ink = onColor(p.primary, p.dark);
    const btn = ink === "#FFFFFF" ? p.light : p.dark;
    t = {
      "--bg": p.primary,
      "--surface": mixHex(p.primary, ink, 0.1),
      "--ink": ink,
      "--muted": mixHex(ink, p.primary, 0.25),
      "--line": mixHex(p.primary, ink, 0.25),
      "--btn": btn,
      "--on-btn": safe(p.primary, btn, p.dark),
      "--eyebrow": safe(p.accent, p.primary, ink, 3),
      "--band": p.dark,
      "--on-band": p.light,
    };
  } else {
    const bg = tpl.mode === "tinte" ? mixHex(p.light, p.secondary, 0.3) : p.light;
    t = {
      "--bg": bg,
      "--surface": tpl.mode === "tinte" ? p.light : "#FFFFFF",
      "--ink": p.dark,
      "--muted": mixHex(p.dark, bg, 0.38),
      "--line": mixHex(bg, p.dark, 0.12),
      "--btn": p.primary,
      "--on-btn": onColor(p.primary, p.dark),
      "--eyebrow": safe(p.primary, bg, p.dark),
      "--band": p.dark,
      "--on-band": p.light,
    };
  }
  const brandLike = { pattern: kit?.pattern ?? "aurora", palette: p.id, colors: kit?.colors ?? (p.id === "custom" ? p : null) } as Pick<BrandKit, "pattern" | "palette" | "colors">;
  return {
    ...t,
    // En modo contraste la página ya es del color de la marca: la portada va en el tono oscuro para que se distinga.
    "--hero":
      tpl.mode === "contraste"
        ? `radial-gradient(120% 90% at 85% 15%, ${mixHex(p.dark, p.primary, 0.55)} 0%, ${p.dark} 65%)`
        : backdropCss(brandLike, "oscuro"),
    "--hero-soft": backdropCss(brandLike, "claro"),
    "--on-hero": onColor(p.primary, p.dark),
    "--r": corners[0],
    "--rl": corners[1],
    "--rb": corners[2],
    "--heading": `"${heading}", system-ui, sans-serif`,
    "--text": `"${body}", system-ui, sans-serif`,
  } as CSSProperties;
}

// ---------- Piezas ----------

const shell = "mx-auto w-full max-w-6xl px-5 sm:px-8";
const eyebrow = "text-xs font-semibold uppercase tracking-[0.18em] text-[var(--eyebrow)]";
const btn = "inline-flex min-h-12 items-center justify-center gap-2 rounded-[var(--rb)] px-6 font-semibold transition hover:opacity-90";
const btnPrimary = `${btn} bg-[var(--btn)] text-[var(--on-btn)]`;
const btnGhost = `${btn} border border-[var(--line)] text-[var(--ink)]`;
const btnWa = `${btn} bg-[#1F8A4C] text-white`;
const card = "rounded-[var(--rl)] bg-[var(--surface)]";

function WaIcon({ className = "size-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
    </svg>
  );
}

function Arrow({ className = "size-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

type Ctx = {
  site: SiteContent;
  tpl: SiteTemplate;
  kit: BrandKit | null;
  cta: string;
  wa: string | null;
  waLabel: string;
  waFirst: boolean;
  initials: string;
  photo: string | null;
  h1: string;
  h2: string;
  headline: string;
  intro: string;
  orderButton?: (s: SiteItem) => ReactNode;
};

function Logo({ c, onDark = false, size = 40 }: { c: Ctx; onDark?: boolean; size?: number }) {
  const { site, kit } = c;
  if (site.logoUrl) {
    return (
      <span className="flex min-w-0 items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={site.logoUrl} alt={`Logo de ${site.name}`} className="size-11 rounded-[var(--r)] object-contain" />
        <span className="truncate text-lg font-bold [font-family:var(--heading)]">{site.name}</span>
      </span>
    );
  }
  if (kit) {
    return (
      <Fit align="start" className="max-w-xs sm:max-w-md">
        <BrandLogo kit={kit} name={site.name} size={size} compact theme={onDark ? "oscuro" : "color"} />
      </Fit>
    );
  }
  return (
    <span className="flex min-w-0 items-center gap-3">
      <span className="flex size-11 shrink-0 items-center justify-center rounded-[var(--r)] bg-[var(--btn)] font-bold text-[var(--on-btn)] [font-family:var(--heading)]">{c.initials}</span>
      <span className="truncate text-lg font-bold tracking-tight [font-family:var(--heading)]">{site.name}</span>
    </span>
  );
}

function Ctas({ c, center = false, light = false }: { c: Ctx; center?: boolean; light?: boolean }) {
  return (
    <div className={`flex flex-wrap gap-3 ${center ? "justify-center" : ""}`}>
      {c.waFirst && c.wa && (
        <a href={c.wa} target="_blank" rel="noopener" className={light ? `${btnWa} ring-1 ring-white/50` : btnWa}>
          <WaIcon /> {c.waLabel}
        </a>
      )}
      <a href="#contacto" className={c.waFirst ? (light ? `${btn} border border-white/40 text-white` : btnGhost) : btnPrimary}>
        {c.cta} <Arrow />
      </a>
    </div>
  );
}

function infoItems(site: SiteContent) {
  return [
    site.hours && { label: "Horario", value: site.hours },
    (site.address || site.zone) && { label: "Dónde estamos", value: site.address || site.zone },
    site.paymentMethods?.length && { label: site.copy?.payments ?? "Aceptamos", value: site.paymentMethods.join(", ") },
  ].filter(Boolean) as { label: string; value: string }[];
}

// Imagen principal: la foto del negocio o un panel con el fondo y el símbolo de la marca.
function Visual({ c, className = "" }: { c: Ctx; className?: string }) {
  if (c.photo) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={c.photo} alt={`${c.site.name}`} className={`h-full w-full object-cover ${className}`} />;
  }
  return (
    <div className={`flex h-full w-full items-center justify-center p-8 text-[var(--on-hero)] ${className}`} style={{ background: "var(--hero)" }}>
      {c.kit ? (
        <BrandLogo kit={c.kit} name={c.site.name} variant="isotipo" theme="oscuro" size={160} />
      ) : (
        <span className="text-8xl font-bold tracking-tight [font-family:var(--heading)]">{c.initials}</span>
      )}
    </div>
  );
}

// Portada a pantalla completa sin foto: el fondo de la marca con el símbolo grande a un lado,
// lejos del título (en celular queda tenue detrás).
function HeroBackdrop({ c }: { c: Ctx }) {
  return (
    <div className="absolute inset-0 overflow-hidden" style={{ background: "var(--hero)" }} aria-hidden>
      <div className="absolute -bottom-20 -right-24 opacity-15 md:bottom-auto md:right-10 md:top-1/2 md:-translate-y-1/2 md:opacity-100 lg:right-14">
        {c.kit ? (
          <BrandLogo kit={c.kit} name={c.site.name} variant="isotipo" theme="oscuro" size={300} />
        ) : (
          <span className="block text-[18rem] font-bold leading-none tracking-tighter text-white/15 [font-family:var(--heading)]">{c.initials}</span>
        )}
      </div>
    </div>
  );
}

// Lo que hace distinto al negocio (entrega, crédito, horario, respuesta rápida).
const HIGHLIGHT_ICONS: Record<string, string> = {
  entrega: "M3 7h11v9H3zM14 10h4l3 3v3h-7M7.5 19.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3ZM17.5 19.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z",
  credito: "M3 7h18v10H3zM3 11h18M7 15h3",
  horario: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 7v5l3 2",
  chat: "M7.9 20A9 9 0 1 0 4 16.1L2 22Z",
  visita: "M3 11l9-7 9 7v9H3zM9 20v-6h6v6",
  fijo: "M4 5h16v15H4zM4 10h16M9 3v4M15 3v4",
};

function Highlights({ c }: { c: Ctx }) {
  const items = c.site.highlights ?? [];
  if (items.length < 2) return null;
  return (
    <section className={`${shell} py-10 sm:py-14`}>
      <ul className={`grid grid-cols-2 gap-3 ${items.length >= 4 ? "lg:grid-cols-4" : "lg:grid-cols-3"}`}>
        {items.map((h) => (
          <li key={h.title} className={`${card} flex flex-col gap-3 p-4 sm:gap-4 sm:p-6`}>
            <span className="flex size-11 items-center justify-center rounded-[var(--r)] bg-[var(--btn)] text-[var(--on-btn)]">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="size-5" aria-hidden>
                <path d={HIGHLIGHT_ICONS[h.icon] ?? HIGHLIGHT_ICONS.chat} />
              </svg>
            </span>
            <span className="flex flex-col gap-1">
              <span className="font-semibold tracking-tight [font-family:var(--heading)] sm:text-lg">{h.title}</span>
              <span className="text-sm text-[var(--muted)] sm:text-base">{h.text}</span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

// ---------- Portadas ----------

function Hero({ c }: { c: Ctx }) {
  const { site, tpl } = c;
  const label = `${site.industry}${site.zone ? ` · ${site.zone}` : ""}`;
  switch (tpl.hero) {
    case "centrado":
      return (
        <section className="relative overflow-hidden">
          <div className={`${shell} flex flex-col items-center gap-7 py-20 text-center sm:py-28`}>
            <p className={eyebrow}>{label}</p>
            <h1 className={`${c.h1} max-w-4xl`}>{c.headline}</h1>
            <p className="max-w-2xl text-lg text-[var(--muted)]">{c.intro}</p>
            <Ctas c={c} center />
            {infoItems(site).length > 0 && (
              <ul className="mt-4 flex flex-wrap justify-center gap-2">
                {infoItems(site).map((i) => (
                  <li key={i.label} className="rounded-[var(--rb)] border border-[var(--line)] px-4 py-2 text-sm text-[var(--muted)]">
                    <span className="font-semibold text-[var(--ink)]">{i.label}:</span> {i.value}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      );
    case "imagen":
      return (
        <section className={`${shell} pt-2`}>
          <div className="relative min-h-[560px] sm:min-h-[640px] overflow-hidden rounded-[var(--rl)]">
            {c.photo ? (
              <>
                <Visual c={c} className="absolute inset-0" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/50 to-black/15" />
              </>
            ) : (
              <HeroBackdrop c={c} />
            )}
            <div className="relative flex min-h-[560px] sm:min-h-[640px] flex-col justify-end gap-5 p-6 text-white sm:p-12">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/80">{label}</p>
              <h1 className={`${c.h1} ${c.photo ? "max-w-3xl" : "max-w-3xl md:max-w-[58%]"}`}>{c.headline}</h1>
              <p className={`max-w-xl text-lg text-white/85 ${c.photo ? "" : "md:max-w-[52%]"}`}>{c.intro}</p>
              <Ctas c={c} light />
            </div>
          </div>
        </section>
      );
    case "editorial":
      return (
        <section className={`${shell} flex flex-col gap-10 py-14 sm:py-20`}>
          <p className={eyebrow}>{label}</p>
          <h1 className={c.h1}>{c.headline}</h1>
          <div className="grid gap-6 border-t border-[var(--line)] pt-8 md:grid-cols-[1.4fr_1fr] md:items-end">
            <p className="max-w-xl text-lg text-[var(--muted)]">{c.intro}</p>
            <div className="md:justify-self-end">
              <Ctas c={c} />
            </div>
          </div>
          <div className="aspect-[4/3] overflow-hidden rounded-[var(--rl)] sm:aspect-[21/9]">
            <Visual c={c} />
          </div>
        </section>
      );
    case "tarjeta":
      return (
        <section className="relative overflow-hidden px-5 py-16 sm:px-8 sm:py-24" style={{ background: "var(--hero)" }}>
          <div className={`${card} relative mx-auto flex max-w-2xl flex-col gap-6 p-7 shadow-2xl sm:p-12`}>
            <p className={eyebrow}>{label}</p>
            <h1 className={c.h2.replace("text-3xl", "text-4xl")}>{c.headline}</h1>
            <p className="text-lg text-[var(--muted)]">{c.intro}</p>
            <Ctas c={c} />
            {infoItems(site).length > 0 && (
              <dl className="grid gap-3 border-t border-[var(--line)] pt-6 sm:grid-cols-2">
                {infoItems(site).map((i) => (
                  <div key={i.label}>
                    <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">{i.label}</dt>
                    <dd className="mt-1">{i.value}</dd>
                  </div>
                ))}
              </dl>
            )}
          </div>
        </section>
      );
    case "bento":
      return (
        <section className={`${shell} grid gap-3 py-8 sm:py-12 md:grid-cols-4 md:grid-rows-[auto_auto]`}>
          <div className={`${card} flex flex-col justify-between gap-8 p-7 sm:p-10 md:col-span-2 md:row-span-2`}>
            <p className={eyebrow}>{label}</p>
            <div className="flex flex-col gap-5">
              <h1 className={c.h2.replace("text-3xl", "text-4xl")}>{c.headline}</h1>
              <p className="text-[var(--muted)]">{c.intro}</p>
              <Ctas c={c} />
            </div>
          </div>
          <div className="min-h-64 overflow-hidden rounded-[var(--rl)] md:col-span-2">
            <Visual c={c} />
          </div>
          <div className={`${card} flex flex-col gap-2 p-6`}>
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">Horario</span>
            <span className="text-lg font-semibold">{site.hours || "Escríbenos para saber"}</span>
          </div>
          {c.wa ? (
            <a href={c.wa} target="_blank" rel="noopener" className="flex flex-col justify-between gap-6 rounded-[var(--rl)] bg-[#1F8A4C] p-6 text-white">
              <WaIcon className="size-7" />
              <span className="text-lg font-semibold">{c.waLabel}</span>
            </a>
          ) : (
            <a href="#contacto" className="flex flex-col justify-between gap-6 rounded-[var(--rl)] bg-[var(--btn)] p-6 text-[var(--on-btn)]">
              <Arrow className="size-7" />
              <span className="text-lg font-semibold">{c.cta}</span>
            </a>
          )}
        </section>
      );
    default:
      return (
        <section className={`${shell} grid items-center gap-10 py-14 md:grid-cols-2 md:py-20`}>
          <div className="flex flex-col gap-6">
            <p className={eyebrow}>{label}</p>
            <h1 className={c.h1}>{c.headline}</h1>
            <p className="text-lg text-[var(--muted)]">{c.intro}</p>
            <Ctas c={c} />
          </div>
          <div className="aspect-[4/3] overflow-hidden rounded-[var(--rl)] md:aspect-square">
            <Visual c={c} />
          </div>
        </section>
      );
  }
}

// ---------- Lo que ofrecemos ----------

// Precio como lo puso el dueño ("$250", "desde $250", "A cotizar"); las páginas viejas no traen priceMode.
export function sitePrice(s: SiteItem, currency: string) {
  if (!s.priceMode) return priceLabel(s.price, currency);
  if (s.priceMode === "quote" || s.price === null) return "A cotizar";
  return s.priceMode === "from" ? `desde ${money(s.price, currency)}` : money(s.price, currency);
}

function ItemImage({ s, className }: { s: SiteItem; className: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return s.image ? <img src={s.image} alt={s.name} loading="lazy" className={`object-cover ${className}`} /> : null;
}

function ItemText({ s }: { s: SiteItem }) {
  return s.description ? <p className="line-clamp-3 text-sm leading-relaxed text-[var(--muted)]">{s.description}</p> : null;
}

function Services({ c }: { c: Ctx }) {
  const { site, tpl } = c;
  if (!site.services.length) return null;
  const price = (s: SiteItem) => sitePrice(s, site.currency);
  const order = (s: SiteItem) => (s.id && c.orderButton ? c.orderButton(s) : null);
  const rich = Boolean(c.orderButton) || site.services.some((s) => s.image || s.description);
  const note = site.secondaryCurrency ? (
    <p className="text-[var(--muted)]">
      Precios en {currencyName(site.currency)}; también aceptamos {currencyName(site.secondaryCurrency)}.
    </p>
  ) : null;
  const header = (
    <div className="flex flex-col gap-3">
      <p className={eyebrow}>Lo que ofrecemos</p>
      <h2 className={c.h2}>{site.services.some((x) => x.price != null) ? (site.kind === "products" ? "Productos y precios" : "Servicios y precios") : site.kind === "products" ? "Lo que vendemos" : "Lo que hacemos"}</h2>
      {note}
    </div>
  );
  const cards = (list: SiteItem[]) => (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {list.map((s) => (
        <li key={s.id ?? s.name} className={`${card} flex flex-col overflow-hidden`}>
          <ItemImage s={s} className="aspect-square w-full" />
          <div className="flex flex-1 flex-col justify-between gap-4 p-6">
            <div className="flex flex-col gap-2">
              <span className="text-xl font-semibold tracking-tight [font-family:var(--heading)]">{s.name}</span>
              <ItemText s={s} />
            </div>
            <span className="flex flex-wrap items-center justify-between gap-3 text-[var(--eyebrow)]">
              <span className="font-semibold">{price(s)}</span>
              {order(s) ?? <Arrow />}
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
  let body: ReactNode;
  if (tpl.services === "menu") {
    body = (
      <ul className="grid gap-x-12 md:grid-cols-2">
        {site.services.map((s) => (
          <li key={s.id ?? s.name} className="flex gap-4 border-b border-[var(--line)] py-4">
            <ItemImage s={s} className="size-20 shrink-0 rounded-[var(--r)]" />
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <div className="flex items-baseline gap-3">
                <span className="text-lg font-semibold">{s.name}</span>
                <span aria-hidden className="flex-1 border-b border-dotted border-[var(--line)]" />
                <span className="shrink-0 font-semibold text-[var(--eyebrow)]">{price(s)}</span>
              </div>
              <ItemText s={s} />
              {order(s) && <div>{order(s)}</div>}
            </div>
          </li>
        ))}
      </ul>
    );
  } else if (tpl.services === "numerado") {
    body = (
      <ol className="flex flex-col">
        {site.services.map((s, i) => (
          <li key={s.id ?? s.name} className="grid grid-cols-[auto_1fr] items-baseline gap-x-6 gap-y-2 border-t border-[var(--line)] py-6 sm:grid-cols-[4rem_1fr_auto]">
            <span className="text-sm font-semibold text-[var(--eyebrow)]">{String(i + 1).padStart(2, "0")}</span>
            <span className="flex items-center gap-4 text-2xl font-semibold tracking-tight [font-family:var(--heading)] sm:text-3xl">
              <ItemImage s={s} className="size-16 shrink-0 rounded-[var(--r)]" />
              {s.name}
            </span>
            <span className="col-start-2 text-[var(--muted)] sm:col-start-3">{price(s)}</span>
            {(s.description || order(s)) && (
              <div className="col-start-2 flex flex-col items-start gap-3">
                <ItemText s={s} />
                {order(s)}
              </div>
            )}
          </li>
        ))}
      </ol>
    );
  } else if (tpl.services === "destacados") {
    const [top, rest] = [site.services.slice(0, 3), site.services.slice(3)];
    body = (
      <div className="flex flex-col gap-6">
        <ul className="grid gap-3 md:grid-cols-3">
          {top.map((s, i) => (
            <li key={s.id ?? s.name} className={`flex min-h-48 flex-col overflow-hidden rounded-[var(--rl)] ${i === 0 ? "bg-[var(--btn)] text-[var(--on-btn)]" : "bg-[var(--surface)]"}`}>
              <ItemImage s={s} className="aspect-[4/3] w-full" />
              <div className="flex flex-1 flex-col justify-between gap-6 p-6">
                <div className="flex flex-col gap-2">
                  <span className="text-2xl font-semibold tracking-tight [font-family:var(--heading)]">{s.name}</span>
                  {s.description && <p className="line-clamp-3 text-sm leading-relaxed opacity-75">{s.description}</p>}
                </div>
                <span className="flex flex-wrap items-center justify-between gap-3 font-semibold">
                  {price(s)} {order(s) ?? <Arrow />}
                </span>
              </div>
            </li>
          ))}
        </ul>
        {rest.length > 0 &&
          (rich ? (
            cards(rest)
          ) : (
            <ul className="flex flex-wrap gap-2">
              {rest.map((s) => (
                <li key={s.id ?? s.name} className="rounded-[var(--rb)] border border-[var(--line)] px-4 py-2">
                  {s.name} <span className="text-[var(--muted)]">· {price(s)}</span>
                </li>
              ))}
            </ul>
          ))}
      </div>
    );
  } else {
    body = cards(site.services);
  }
  return (
    <section id="servicios" className={`${shell} flex scroll-mt-6 flex-col gap-10 py-16 sm:py-24`}>
      {header}
      {body}
    </section>
  );
}

// ---------- Quiénes somos ----------

function About({ c }: { c: Ctx }) {
  const base = c.kit?.base;
  if (c.tpl.about === "ninguno" || !base?.story) return null;
  if (c.tpl.about === "valores") {
    return (
      <section id="nosotros" className="scroll-mt-6 bg-[var(--band)] py-16 text-[var(--on-band)] sm:py-24">
        <div className={`${shell} flex flex-col gap-12`}>
          <h2 className={`${c.h2} max-w-3xl`}>“{base.promise || c.kit!.slogan}”</h2>
          <ul className="grid gap-8 md:grid-cols-3">
            {base.values.slice(0, 3).map((v, i) => (
              <li key={v.name} className="flex flex-col gap-3 border-t border-current/20 pt-6">
                <span className="text-sm font-semibold opacity-60">{String(i + 1).padStart(2, "0")}</span>
                <span className="text-xl font-semibold [font-family:var(--heading)]">{v.name}</span>
                <span className="opacity-75">{v.text}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>
    );
  }
  return (
    <section id="nosotros" className={`${shell} grid scroll-mt-6 gap-10 py-16 sm:py-24 md:grid-cols-2`}>
      <div className="flex flex-col gap-4">
        <p className={eyebrow}>Quiénes somos</p>
        <h2 className={c.h2}>{base.promise || c.kit!.slogan}</h2>
      </div>
      <div className="flex flex-col gap-6">
        <p className="text-lg leading-relaxed text-[var(--muted)]">{base.story}</p>
        <ul className="flex flex-wrap gap-2">
          {base.values.map((v) => (
            <li key={v.name} className="rounded-[var(--rb)] bg-[var(--surface)] px-4 py-2 font-semibold">
              {v.name}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

// ---------- Galería ----------

function Gallery({ c }: { c: Ctx }) {
  const photos = c.site.photos.filter((p) => p !== c.photo);
  if (!photos.length) return null;
  const alt = `Trabajo de ${c.site.name}`;
  let body: ReactNode;
  if (c.tpl.gallery === "tira") {
    body = (
      <div className="-mx-5 flex snap-x gap-3 overflow-x-auto px-5 pb-2 sm:-mx-8 sm:px-8">
        {photos.map((url) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={url} src={url} alt={alt} className="aspect-[3/4] w-64 shrink-0 snap-start rounded-[var(--rl)] object-cover sm:w-80" />
        ))}
      </div>
    );
  } else if (c.tpl.gallery === "mosaico") {
    body = (
      <div className="columns-2 gap-3 md:columns-3">
        {photos.map((url) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={url} src={url} alt={alt} className="mb-3 w-full break-inside-avoid rounded-[var(--rl)]" />
        ))}
      </div>
    );
  } else {
    body = (
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        {photos.map((url) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={url} src={url} alt={alt} className="aspect-square w-full rounded-[var(--rl)] object-cover" />
        ))}
      </div>
    );
  }
  return (
    <section className={`${shell} flex flex-col gap-8 py-16 sm:py-24`}>
      <h2 className={c.h2}>Nuestros trabajos</h2>
      {body}
    </section>
  );
}

// ---------- Contacto ----------

function FormPreview({ cta }: { cta: string }) {
  const field = "min-h-12 rounded-[var(--r)] border border-[var(--line)] bg-[var(--surface)]";
  return (
    <div aria-hidden className="flex flex-col gap-3">
      <span className={field} />
      <span className={field} />
      <span className={`${field} min-h-24`} />
      <span className={`${btnPrimary} w-full`}>{cta}</span>
    </div>
  );
}

function Contact({ c, leadForm }: { c: Ctx; leadForm?: ReactNode }) {
  const { site, tpl } = c;
  const form = leadForm ?? <FormPreview cta={c.cta} />;
  const info = (
    <dl className="flex flex-col gap-4">
      {[...infoItems(site), ...(site.phone ? [{ label: "Teléfono", value: site.phone }] : [])].map((i) => (
        <div key={i.label} className="flex flex-col gap-1">
          <dt className="text-xs font-semibold uppercase tracking-[0.14em] opacity-60">{i.label}</dt>
          <dd>{i.label === "Teléfono" ? <a href={`tel:${i.value}`} className="underline underline-offset-4">{i.value}</a> : i.value}</dd>
        </div>
      ))}
    </dl>
  );
  const waBtn = c.wa && (
    <a href={c.wa} target="_blank" rel="noopener" className={`${btnWa} self-start`}>
      <WaIcon /> {c.waLabel}
    </a>
  );
  const lead = <p className="text-lg opacity-80">{site.copy?.leadIntro ?? "Déjanos tus datos y te contestamos hoy mismo."}</p>;

  if (tpl.contact === "banda") {
    return (
      <section id="contacto" className="scroll-mt-6 bg-[var(--band)] py-16 text-[var(--on-band)] sm:py-24">
        <div className={`${shell} grid gap-10 md:grid-cols-2`}>
          <div className="flex flex-col gap-6">
            <h2 className={c.h2}>{c.cta}</h2>
            {lead}
            {waBtn}
            {info}
          </div>
          <div className="rounded-[var(--rl)] bg-[var(--bg)] p-6 text-[var(--ink)] sm:p-8">{form}</div>
        </div>
      </section>
    );
  }
  if (tpl.contact === "tarjeta") {
    return (
      <section id="contacto" className={`${shell} scroll-mt-6 py-16 sm:py-24`}>
        <div className={`${card} mx-auto flex max-w-3xl flex-col gap-8 p-7 sm:p-12`}>
          <div className="flex flex-col gap-4 text-center">
            <h2 className={c.h2}>{c.cta}</h2>
            {lead}
          </div>
          {form}
          <div className="flex flex-col items-start gap-6 border-t border-[var(--line)] pt-8 sm:flex-row sm:justify-between">
            {info}
            {waBtn}
          </div>
        </div>
      </section>
    );
  }
  return (
    <section id="contacto" className={`${shell} grid scroll-mt-6 gap-10 py-16 sm:py-24 md:grid-cols-2`}>
      <div className="flex flex-col gap-6">
        <p className={eyebrow}>Contacto</p>
        <h2 className={c.h2}>{c.cta}</h2>
        {lead}
        {waBtn}
        {info}
      </div>
      <div className={`${card} p-6 sm:p-8`}>{form}</div>
    </section>
  );
}

// ---------- Página ----------

// El kit guarda el nombre de la propuesta ("Arevalo Tuerca"); en la página se habla del negocio.
function withBusinessName(kit: BrandKit, name: string): BrandKit {
  if (!kit.base || !kit.name || kit.name === name) return kit;
  const fix = (t: string) => t.split(kit.name).join(name);
  return {
    ...kit,
    base: { ...kit.base, story: fix(kit.base.story), promise: fix(kit.base.promise), values: kit.base.values.map((v) => ({ ...v, text: fix(v.text) })) },
  };
}

function whatsappLink(phone: string, name: string) {
  const text = encodeURIComponent(`Hola ${name}, quisiera información.`);
  return `https://wa.me/${phone.replace(/\D/g, "")}?text=${text}`;
}

export function SiteView({
  site,
  leadForm,
  orderButton,
  cart,
  template,
  preview = false,
}: {
  site: SiteContent;
  leadForm?: ReactNode;
  orderButton?: (s: SiteItem) => ReactNode; // botón "Agregar al pedido" de cada producto (solo en la página pública)
  cart?: ReactNode; // barra y hoja del pedido
  template?: string; // para ver otra plantilla sin cambiar la guardada
  preview?: boolean; // dentro de la app: sin botones flotantes
}) {
  const tpl = templateById(template ?? site.template);
  const kit = site.brand ? withBusinessName(sanitizeKit(site.brand, site.brand), site.name) : null;
  const palette = kit ? kitPalette(kit) : palettesFor(site.industry)[0];
  const fonts = fontsById(kit?.fonts ?? "jakarta");
  const wa = site.phone ? whatsappLink(site.phone, site.name) : null;
  const c: Ctx = {
    site,
    tpl,
    kit,
    cta: site.copy?.cta ?? site.ctaLabel,
    wa,
    waLabel: site.copy?.whatsapp ?? "Escríbenos por WhatsApp",
    waFirst: Boolean(wa && site.whatsappFirst !== false),
    orderButton,
    initials: site.name
      .split(/\s+/)
      .map((w) => w.charAt(0))
      .join("")
      .slice(0, 2)
      .toUpperCase(),
    photo: site.photos[0] ?? null,
    headline: kit?.slogan || site.tagline,
    intro: kit?.slogan ? `${site.tagline}. ${site.intro}` : site.intro,
    h1: `font-semibold leading-[0.98] tracking-[-0.035em] [font-family:var(--heading)] ${tpl.big ? "text-5xl sm:text-7xl lg:text-8xl" : "text-4xl sm:text-5xl lg:text-6xl"}`,
    h2: `font-semibold leading-tight tracking-[-0.025em] [font-family:var(--heading)] ${tpl.big ? "text-3xl sm:text-5xl" : "text-3xl sm:text-4xl"}`,
  };
  const dark = tpl.mode === "oscuro" || tpl.mode === "contraste";

  return (
    <div style={{ ...siteTheme(palette, fonts.heading.family, fonts.body.family, tpl, kit), fontFamily: "var(--text)" }} className="min-h-full bg-[var(--bg)] text-[var(--ink)] antialiased">
      <link rel="stylesheet" href={googleFontsHref([fonts])} precedence="default" />
      <header className={`${shell} flex items-center justify-between gap-4 py-5`}>
        <div className="flex min-w-0 flex-1 items-center">
          <Logo c={c} onDark={dark} />
        </div>
        <nav aria-label="Secciones" className="hidden items-center gap-7 text-sm font-medium text-[var(--muted)] md:flex">
          {site.services.length > 0 && <a href="#servicios" className="hover:text-[var(--ink)]">Servicios</a>}
          {kit?.base?.story && tpl.about !== "ninguno" && <a href="#nosotros" className="hover:text-[var(--ink)]">Nosotros</a>}
          <a href="#contacto" className="hover:text-[var(--ink)]">Contacto</a>
        </nav>
        {c.waFirst && wa ? (
          <a href={wa} target="_blank" rel="noopener" className={`${btnWa} min-h-11 px-4 text-sm`}>
            <WaIcon className="size-4" /> <span className="hidden sm:inline">WhatsApp</span>
          </a>
        ) : (
          <a href="#contacto" className={`${btnPrimary} min-h-11 px-4 text-sm`}>
            {c.cta}
          </a>
        )}
      </header>

      <main>
        <Hero c={c} />
        <Highlights c={c} />
        <Services c={c} />
        <About c={c} />
        <Gallery c={c} />
        <Contact c={c} leadForm={leadForm} />
      </main>

      <footer className={`${shell} flex flex-col gap-6 border-t border-[var(--line)] py-10 sm:flex-row sm:items-end sm:justify-between`}>
        <div className="flex flex-col gap-2">
          <span className={`font-semibold tracking-tight [font-family:var(--heading)] ${tpl.big ? "text-4xl sm:text-6xl" : "text-2xl"}`}>{site.name}</span>
          {kit && <span className="text-[var(--muted)]">{kit.slogan}</span>}
        </div>
        <span className="text-sm text-[var(--muted)]">Página hecha con Orbusiness</span>
      </footer>
      {cart}

      {wa && !preview && (
        <a href={wa} target="_blank" rel="noopener" aria-label={c.waLabel} className="fixed bottom-5 right-5 z-20 flex size-14 items-center justify-center rounded-full bg-[#1F8A4C] text-white shadow-xl md:hidden">
          <WaIcon className="size-7" />
        </a>
      )}
    </div>
  );
}
