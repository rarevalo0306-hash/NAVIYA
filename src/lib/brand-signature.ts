import { kitPalette, type BrandKit } from "@/lib/brand";

const esc = (t: string) => t.replace(/[<>&"']/g, (c) => `&#${c.charCodeAt(0)};`);

// Firma de email del negocio (en el manual para copiar y en el kit como .html). Todos los datos van escapados.
export function emailSignatureHtml(o: {
  name: string;
  owner: string | null;
  phone: string | null;
  address: string | null;
  siteUrl: string | null;
  logoUrl: string | null;
  kit: BrandKit;
}) {
  const p = kitPalette(o.kit);
  const site = o.siteUrl?.replace(/^https?:\/\//, "") ?? null;
  return `<table cellpadding="0" cellspacing="0" style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:${p.dark};line-height:1.45">
<tr>${o.logoUrl ? `<td style="padding-right:16px;border-right:3px solid ${p.primary};vertical-align:middle"><img src="${esc(o.logoUrl)}" alt="${esc(o.name)}" width="160" style="display:block;width:160px;height:auto"></td>` : ""}
<td style="padding-left:16px;vertical-align:middle">
<strong style="font-size:16px">${esc(o.owner ?? o.name)}</strong><br>
<span style="color:${p.primary};font-weight:bold">${esc(o.name)}</span><br>
${o.phone ? `${esc(o.phone)}<br>` : ""}${o.address ? `${esc(o.address)}<br>` : ""}${site ? `<a href="${esc(o.siteUrl!)}" style="color:${p.primary}">${esc(site)}</a><br>` : ""}
<em style="color:#666">${esc(o.kit.slogan)}</em>
</td></tr></table>`;
}
