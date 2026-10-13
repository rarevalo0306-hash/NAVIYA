import "server-only";
import { publicAssetUrl } from "@/lib/business";
import { checkoutSettings, deliveryFee } from "@/lib/checkout";
import { notifyHandoff, notifyOrder } from "@/lib/notify";
import { customerReply, orderFromReply } from "@/lib/nuna-whatsapp";
import { createAdminClient } from "@/lib/supabase/admin";
import { transcribe } from "@/lib/voice-ai";
import { sendWhatsApp, twilioMedia } from "@/lib/whatsapp";

// Mensaje que llega al WhatsApp de un negocio: se guarda en su CRM y, si Nuna está atendiendo, ella contesta.

const NUNA_DAILY = 600; // respuestas de Nuna por negocio al día (tope de costo si alguien manda mensajes sin parar)

export async function handleIncoming(p: Record<string, string>) {
  const db = createAdminClient();
  const to = (p.To ?? "").replace(/^whatsapp:/, "");
  const from = (p.From ?? "").replace(/^whatsapp:/, "");
  if (!from || !to || !p.MessageSid) return;

  const { data: line } = await db.from("whatsapp_lines").select("business_id").eq("number", to).maybeSingle();
  if (!line) return console.error("WhatsApp: llegó un mensaje a un número sin negocio:", to);
  const { data: b } = await db.from("businesses").select("*").eq("id", line.business_id).single();
  if (!b) return;

  // Notas de voz: se pasan a texto. Fotos y otros archivos: por ahora solo se avisa que llegaron.
  let text = (p.Body ?? "").trim();
  for (let i = 0; i < Math.min(Number(p.NumMedia) || 0, 3); i++) {
    const type = p[`MediaContentType${i}`] ?? "";
    if (type.startsWith("audio/")) {
      const heard = await twilioMedia(p[`MediaUrl${i}`])
        .then((blob) => transcribe(blob, `nota.${type.split("/")[1]?.split(";")[0] || "ogg"}`, ""))
        .catch(() => null);
      text += heard ? `${text ? "\n" : ""}🎤 ${heard}` : `${text ? "\n" : ""}[nota de voz que no se pudo escuchar]`;
    } else {
      text += `${text ? "\n" : ""}[mandó ${type.startsWith("image/") ? "una foto" : "un archivo"}]`;
    }
  }
  if (!text) return;

  // Cliente: el mismo número es el mismo cliente.
  let { data: contact } = await db.from("contacts").select("id, name").eq("business_id", b.id).eq("phone", from).limit(1).maybeSingle();
  if (!contact) {
    const { data: stage } = await db.from("pipeline_stages").select("id").eq("business_id", b.id).order("position").limit(1).maybeSingle();
    ({ data: contact } = await db
      .from("contacts")
      .insert({ business_id: b.id, name: (p.ProfileName || from).slice(0, 120), phone: from, source_channel: "whatsapp", stage_id: stage?.id ?? null })
      .select("id, name")
      .single());
  }
  if (!contact) return;

  let { data: conv } = await db
    .from("conversations")
    .select("id, status")
    .eq("business_id", b.id)
    .eq("contact_id", contact.id)
    .eq("channel", "whatsapp")
    .neq("status", "closed")
    .order("last_message_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!conv) {
    ({ data: conv } = await db
      .from("conversations")
      .insert({ business_id: b.id, contact_id: contact.id, channel: "whatsapp", status: b.nuna_replies ? "nuna" : "needs_owner" })
      .select("id, status")
      .single());
  }
  if (!conv) return;

  const now = new Date().toISOString();
  const { error: dup } = await db
    .from("messages")
    .insert({ business_id: b.id, conversation_id: conv.id, direction: "in", author: "customer", channel: "whatsapp", body: text.slice(0, 4000), external_id: p.MessageSid });
  if (dup) return; // Twilio reintentó un mensaje que ya teníamos
  await db.from("conversations").update({ last_message_at: now }).eq("id", conv.id);

  // Nuna contesta solo si el dueño la tiene prendida y no tomó (o le pasaron) esta plática.
  if (!b.nuna_replies || conv.status !== "nuna") return;
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const { count } = await db.from("audit_log").select("id", { count: "exact", head: true }).eq("business_id", b.id).eq("action", "whatsapp.nuna_reply").gte("created_at", since);
  if ((count ?? 0) >= NUNA_DAILY) return console.error("WhatsApp: Nuna llegó a su tope diario en", b.id);

  const [{ data: items }, { data: history }, { data: site }] = await Promise.all([
    db.from("services").select("*").eq("business_id", b.id).eq("active", true).order("sort").limit(120),
    db.from("messages").select("author, body").eq("conversation_id", conv.id).order("created_at", { ascending: false }).limit(24),
    db.from("websites").select("subdomain").eq("business_id", b.id).eq("status", "published").maybeSingle(),
  ]);
  const catalog = items ?? [];
  const started = Date.now();
  const out = await customerReply(b, catalog, (history ?? []).reverse(), site?.subdomain ? `https://orbusiness.app/sitio/${site.subdomain}` : null);
  console.log(`WhatsApp: Nuna pensó en ${Date.now() - started} ms`);

  // Si la IA falla, el cliente no se queda sin respuesta y el dueño queda avisado en su panel.
  const reply = out?.reply.trim() || `¡Gracias por escribir a ${b.name}! En un momento te respondemos.`;
  const sid = await sendWhatsApp(to, from, reply).catch((e) => (console.error("WhatsApp: no se pudo mandar la respuesta:", e), null));
  if (!sid) return;
  await db.from("messages").insert({ business_id: b.id, conversation_id: conv.id, direction: "out", author: "nuna", channel: "whatsapp", body: reply, external_id: sid });

  // Fotos que pidió el cliente (de su catálogo, máximo 3).
  for (const r of (out?.photos ?? []).slice(0, 3)) {
    const item = catalog[Number(r.replace(/\D/g, "")) - 1];
    if (!item?.image_path) continue;
    const photoSid = await sendWhatsApp(to, from, item.name, publicAssetUrl(item.image_path)).catch((e) => (console.error("WhatsApp: foto no enviada:", e), null));
    if (photoSid) await db.from("messages").insert({ business_id: b.id, conversation_id: conv.id, direction: "out", author: "nuna", channel: "whatsapp", body: `[foto: ${item.name}]`, external_id: photoSid });
  }

  if (out?.order?.length) {
    const o = orderFromReply(out.order, catalog);
    if (o.lines.length) {
      const d = out.delivery;
      const fulfillment = o.kind === "order" ? (d?.fulfillment ?? null) : null;
      const fee = fulfillment === "delivery" && o.total !== null ? deliveryFee(checkoutSettings(b.checkout, b.offers_delivery), o.total) : null;
      const { data: last } = await db.from("orders").select("number").eq("business_id", b.id).order("number", { ascending: false, nullsFirst: false }).limit(1).maybeSingle();
      const { data: order } = await db
        .from("orders")
        .insert({
          business_id: b.id,
          contact_id: contact.id,
          number: (last?.number ?? 0) + 1,
          kind: o.kind,
          items: o.lines,
          subtotal: o.total,
          delivery_fee: fee,
          total: o.total === null ? null : o.total + (fee ?? 0),
          currency: b.currency,
          note: "Pedido por WhatsApp",
          customer_name: (out.customer_name ?? contact.name).slice(0, 120),
          customer_phone: from,
          fulfillment,
          address: fulfillment === "delivery" ? (d?.address?.slice(0, 300) ?? null) : null,
          payment_method: d?.payment?.slice(0, 60) ?? null,
        })
        .select("id")
        .single();
      if (order) {
        await db.from("audit_log").insert({ business_id: b.id, actor: "nuna", action: "order.created_from_whatsapp", entity: "orders", entity_id: order.id });
        await notifyOrder({
          businessId: b.id,
          number: (last?.number ?? 0) + 1,
          kind: o.kind,
          items: o.lines,
          total: o.total === null ? null : o.total + (fee ?? 0),
          deliveryFee: fee,
          currency: b.currency,
          fulfillment,
          address: d?.address ?? null,
          payment: d?.payment ?? null,
          paymentNote: null,
          customer: { name: out.customer_name ?? contact.name, phone: from, email: null },
          channel: "whatsapp",
        });
      }
    }
  }
  const handoff = !out || out.handoff; // con un pedido Nuna sigue atendiendo: el pedido ya aparece en Pedidos
  if (handoff) await notifyHandoff(b.id, out?.customer_name ?? contact.name, text);
  await db
    .from("conversations")
    .update({ last_message_at: new Date().toISOString(), ...(handoff ? { status: "needs_owner" } : {}) })
    .eq("id", conv.id);
  if (out?.customer_name && contact.name === from) await db.from("contacts").update({ name: out.customer_name.slice(0, 120) }).eq("id", contact.id);
  await db.from("audit_log").insert({ business_id: b.id, actor: "nuna", action: "whatsapp.nuna_reply", entity: "conversations", entity_id: conv.id });
}
