import "server-only";
import { APP_HOST, APP_URL } from "@/lib/app-url";
import { formatSlot } from "@/lib/booking";
import { money } from "@/lib/interview";
import { adminEnabled, createAdminClient } from "@/lib/supabase/admin";
import { sendTemplate, whatsappEnabled } from "@/lib/whatsapp";

// Avisos: al cliente (confirmación de pedido o cita) y al dueño (le llegó un pedido, una cita o un cliente que lo necesita).
// Correo con Resend (RESEND_API_KEY) desde avisos@naviya.app; WhatsApp con plantillas aprobadas por Meta
// (TWILIO_TEMPLATE_*), porque escribirle primero a alguien en WhatsApp solo se permite con plantilla.
// Si falta una llave, ese canal simplemente no se usa. Nunca rompen el pedido o la cita: los errores solo se registran.

const APP = APP_URL;
const FROM_DOMAIN = () => process.env.EMAIL_FROM_DOMAIN?.trim() || APP_HOST;
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

async function sendEmail(to: string, subject: string, lines: string[], from: string, replyTo?: string | null) {
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key || !to) return;
  const html =
    `<div style="font-family:Arial,sans-serif;font-size:16px;line-height:1.5;color:#111;max-width:560px">` +
    lines
      .filter(Boolean)
      .map((l) => `<p style="margin:0 0 8px">${l}</p>`)
      .join("") +
    `<p style="margin-top:24px;font-size:12px;color:#777">Enviado con Orbusiness</p></div>`;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: `${from.replace(/[<>"]/g, "")} <avisos@${FROM_DOMAIN()}>`, to: [to], subject, html, ...(replyTo ? { reply_to: replyTo } : {}) }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) console.error("Correo no enviado:", res.status, (await res.text()).slice(0, 300));
}

// Correo y WhatsApp del dueño: el correo con el que entra y el teléfono del negocio.
async function owner(businessId: string) {
  if (!adminEnabled()) return null;
  const db = createAdminClient();
  const [{ data: b }, { data: m }] = await Promise.all([
    db.from("businesses").select("name, phone, owner_name").eq("id", businessId).single(),
    db.from("memberships").select("user_id").eq("business_id", businessId).order("created_at").limit(1).maybeSingle(),
  ]);
  const user = m ? (await db.auth.admin.getUserById(m.user_id)).data.user : null;
  return { name: b?.name ?? "Tu negocio", ownerName: b?.owner_name ?? null, phone: b?.phone ?? null, email: user?.email ?? null };
}

async function whatsappOwner(phone: string | null, template: string | undefined, vars: Record<string, string>) {
  if (!phone || !template || !whatsappEnabled()) return;
  const to = phone.replace(/[^\d+]/g, "");
  if (!/^\+\d{8,15}$/.test(to)) return;
  await sendTemplate(to, template, vars).catch((e) => console.error("Aviso por WhatsApp no enviado:", e));
}

type OrderLine = { name: string; qty: number; options?: Record<string, string> };
export type OrderNotice = {
  businessId: string;
  number: number | null;
  kind: string;
  items: OrderLine[];
  total: number | null;
  deliveryFee: number | null;
  currency: string;
  fulfillment: string | null;
  address: string | null;
  payment: string | null;
  paymentNote: string | null;
  customer: { name: string; phone: string | null; email: string | null };
  channel: "web" | "whatsapp";
};

export async function notifyOrder(o: OrderNotice) {
  try {
    const biz = await owner(o.businessId);
    if (!biz) return;
    const label = o.kind === "order" ? `Pedido${o.number ? ` #${o.number}` : ""}` : "Solicitud de cotización";
    const list = o.items.map((l) => `${l.qty} × ${esc(l.name)}${l.options && Object.keys(l.options).length ? ` (${esc(Object.values(l.options).join(", "))})` : ""}`);
    const total = o.total !== null ? money(o.total, o.currency) : "por confirmar";
    const how = o.fulfillment === "delivery" ? `Entrega a domicilio: ${esc(o.address ?? "")}` : o.fulfillment === "pickup" ? "Recoge en el local" : "";
    // Al dueño
    await sendEmail(
      biz.email ?? "",
      `${label} de ${o.customer.name} · ${total}`,
      [
        `<strong>${label}</strong> ${o.channel === "whatsapp" ? "por WhatsApp (lo tomó Nuna)" : "desde tu página"}.`,
        ...list,
        `Total: <strong>${total}</strong>${o.deliveryFee ? ` (envío ${money(o.deliveryFee, o.currency)})` : ""}`,
        how,
        o.payment ? `Paga con: ${esc(o.payment)}` : "",
        "",
        `Cliente: ${esc(o.customer.name)}${o.customer.phone ? ` · ${esc(o.customer.phone)}` : ""}${o.customer.email ? ` · ${esc(o.customer.email)}` : ""}`,
        `<a href="${APP}/panel/pedidos">Ver en mi panel</a>`,
      ],
      "Orbusiness",
      o.customer.email,
    );
    await whatsappOwner(biz.phone, process.env.TWILIO_TEMPLATE_OWNER_ALERT, {
      "1": label,
      "2": `${o.customer.name} · ${total}`,
      "3": `${APP}/panel/pedidos`,
    });
    // Al cliente (solo los pedidos de la página traen correo)
    if (o.customer.email) {
      await sendEmail(
        o.customer.email,
        o.kind === "order" ? `Recibimos tu pedido${o.number ? ` #${o.number}` : ""} · ${biz.name}` : `Recibimos tu solicitud · ${biz.name}`,
        [
          `¡Hola, ${esc(o.customer.name)}! Gracias por tu ${o.kind === "order" ? "pedido" : "solicitud"} en <strong>${esc(biz.name)}</strong>.`,
          ...list,
          o.total !== null ? `Total: <strong>${total}</strong>` : "",
          how,
          o.paymentNote ? `<strong>Cómo pagar:</strong> ${esc(o.paymentNote)}` : "",
          "",
          "Te escribimos pronto para confirmar.",
        ],
        biz.name,
        biz.email,
      );
    }
  } catch (e) {
    console.error("Avisos del pedido:", e);
  }
}

export type BookingNotice = {
  businessId: string;
  service: string;
  startsAt: string;
  tz: string;
  customer: { name: string; phone: string | null; email: string | null };
};

export async function notifyBooking(a: BookingNotice) {
  try {
    const biz = await owner(a.businessId);
    if (!biz) return;
    const when = formatSlot(a.startsAt, a.tz);
    await sendEmail(
      biz.email ?? "",
      `Nueva cita: ${a.service} · ${when}`,
      [
        `<strong>Nueva cita</strong> desde tu página.`,
        `${esc(a.service)} — ${esc(when)}`,
        `Cliente: ${esc(a.customer.name)}${a.customer.phone ? ` · ${esc(a.customer.phone)}` : ""}${a.customer.email ? ` · ${esc(a.customer.email)}` : ""}`,
        `<a href="${APP}/panel/agenda">Ver mi agenda</a>`,
      ],
      "Orbusiness",
      a.customer.email,
    );
    await whatsappOwner(biz.phone, process.env.TWILIO_TEMPLATE_OWNER_ALERT, { "1": "Nueva cita", "2": `${a.customer.name} · ${a.service}, ${when}`, "3": `${APP}/panel/agenda` });
    if (a.customer.email) {
      await sendEmail(
        a.customer.email,
        `Tu cita en ${biz.name}: ${when}`,
        [
          `¡Hola, ${esc(a.customer.name)}! Tu cita quedó agendada.`,
          `<strong>${esc(a.service)}</strong>`,
          esc(when.charAt(0).toUpperCase() + when.slice(1)),
          `En <strong>${esc(biz.name)}</strong>${biz.phone ? ` · ${esc(biz.phone)}` : ""}`,
          "",
          "Si necesitas cambiarla, responde este correo.",
        ],
        biz.name,
        biz.email,
      );
    }
    if (a.customer.phone && whatsappEnabled()) {
      const to = a.customer.phone.replace(/[^\d+]/g, "");
      if (/^\+\d{8,15}$/.test(to) && process.env.TWILIO_TEMPLATE_BOOKING)
        await sendTemplate(to, process.env.TWILIO_TEMPLATE_BOOKING, { "1": a.customer.name, "2": a.service, "3": when, "4": biz.name }).catch((e) =>
          console.error("Confirmación de cita por WhatsApp no enviada:", e),
        );
    }
  } catch (e) {
    console.error("Avisos de la cita:", e);
  }
}

// Nuna le pasa una plática de WhatsApp al dueño.
export async function notifyHandoff(businessId: string, customer: string, lastMessage: string) {
  try {
    const biz = await owner(businessId);
    if (!biz) return;
    await sendEmail(
      biz.email ?? "",
      `${customer} te necesita en WhatsApp`,
      [`Nuna te pasó una plática: <strong>${esc(customer)}</strong> necesita que le contestes tú.`, `Último mensaje: «${esc(lastMessage.slice(0, 300))}»`, `<a href="${APP}/panel/mensajes">Contestar desde mi panel</a>`],
      "Orbusiness",
    );
    await whatsappOwner(biz.phone, process.env.TWILIO_TEMPLATE_OWNER_ALERT, { "1": "Un mensaje que te necesita", "2": customer, "3": `${APP}/panel/mensajes` });
  } catch (e) {
    console.error("Aviso de plática:", e);
  }
}
