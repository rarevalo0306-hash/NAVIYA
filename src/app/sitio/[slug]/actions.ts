"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export type LeadState = { ok?: boolean; error?: string };

// Formulario público de cotización: crea el lead en el CRM del negocio (función segura en la base).
export async function submitLead(slug: string, _prev: LeadState, formData: FormData): Promise<LeadState> {
  const value = (k: string) => String(formData.get(k) ?? "").trim();
  const name = value("name");
  const phone = value("phone");
  const email = value("email");
  if (!name) return { error: "Escribe tu nombre." };
  if (!phone && !email) return { error: "Déjanos un teléfono o un correo para contactarte." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("submit_lead", {
    p_subdomain: slug,
    p_name: name,
    p_phone: phone,
    p_email: email,
    p_message: value("message"),
  });
  if (error) return { error: "No pudimos enviar tus datos. Intenta de nuevo." };
  return { ok: true };
}

const Order = z.object({
  name: z.string().trim().min(1).max(120),
  phone: z.string().trim().min(6).max(40),
  email: z.string().trim().email().max(200),
  note: z.string().trim().max(1000),
  fulfillment: z.enum(["delivery", "pickup", ""]),
  address: z.string().trim().max(300),
  payment: z.string().trim().max(60),
  items: z
    .array(z.object({ id: z.string().uuid(), qty: z.number().int().min(1).max(99), options: z.record(z.string(), z.string().max(40)) }))
    .min(1)
    .max(50),
});
export type OrderInput = z.infer<typeof Order>;
export type OrderResult = {
  number: number;
  kind: "order" | "quote";
  subtotal: number | null;
  delivery_fee: number | null;
  total: number | null;
  currency: string;
  fulfillment: "delivery" | "pickup" | null;
  payment: string | null;
  payment_note: string | null;
  pickup_note: string | null;
};

const ERRORS: [string, string][] = [
  ["item not available", "Algo de tu pedido ya no está disponible. Regresa a la tienda y revisa tu carrito."],
  ["address required", "Escribe la dirección de entrega."],
  ["email required", "Escribe un correo válido."],
  ["phone required", "Escribe tu teléfono o WhatsApp."],
  ["payment method invalid", "Elige cómo vas a pagar."],
  ["fulfillment required", "Elige si te lo llevamos o pasas a recogerlo."],
  ["not offered", "Esa forma de entrega ya no está disponible. Elige otra."],
];

// Checkout como visitante: la base revisa cada producto y pone precios y envío (nunca los del navegador).
export async function placeOrder(slug: string, input: OrderInput): Promise<{ ok: OrderResult } | { error: string }> {
  const parsed = Order.safeParse(input);
  if (!parsed.success) return { error: "Revisa tus datos: nombre, teléfono y un correo válido." };
  const o = parsed.data;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("place_order", {
    p_subdomain: slug,
    p_name: o.name,
    p_phone: o.phone,
    p_email: o.email,
    p_note: o.note,
    p_items: o.items,
    p_fulfillment: o.fulfillment,
    p_address: o.address,
    p_payment: o.payment,
  });
  if (error) return { error: ERRORS.find(([k]) => error.message.includes(k))?.[1] ?? "No pudimos enviar tu pedido. Intenta de nuevo." };
  return { ok: data as unknown as OrderResult };
}

// ---------- Citas ----------

export async function getSlots(slug: string, serviceId: string, date: string): Promise<string[]> {
  if (!z.string().uuid().safeParse(serviceId).success || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return [];
  const supabase = await createClient();
  const { data } = await supabase.rpc("available_slots", { p_subdomain: slug, p_service: serviceId, p_date: date });
  return (data ?? []) as string[];
}

const Booking = z.object({
  service: z.string().uuid(),
  start: z.string().datetime({ offset: true }),
  name: z.string().trim().min(1).max(120),
  phone: z.string().trim().min(6).max(40),
  email: z.string().trim().email().max(200),
  note: z.string().trim().max(1000),
});
export type BookingResult = { id: string; service: string; business: string; starts_at: string; ends_at: string; tz: string };

export async function bookAppointment(slug: string, input: z.infer<typeof Booking>): Promise<{ ok: BookingResult } | { error: string }> {
  const parsed = Booking.safeParse(input);
  if (!parsed.success) return { error: "Revisa tus datos: nombre, teléfono y un correo válido." };
  const b = parsed.data;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("book_appointment", {
    p_subdomain: slug,
    p_service: b.service,
    p_start: b.start,
    p_name: b.name,
    p_phone: b.phone,
    p_email: b.email,
    p_note: b.note,
  });
  if (error) {
    if (error.message.includes("slot taken")) return { error: "Ese horario se acaba de ocupar. Elige otro, por favor." };
    return { error: "No pudimos agendar tu cita. Intenta de nuevo." };
  }
  return { ok: data as unknown as BookingResult };
}
