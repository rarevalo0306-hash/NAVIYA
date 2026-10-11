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

const Lines = z
  .array(z.object({ id: z.string().uuid(), qty: z.number().int().min(1).max(99), options: z.record(z.string(), z.string().max(40)) }))
  .min(1)
  .max(50);

// Pedido o cotización desde la página: la base revisa cada producto y pone los precios (nunca los del navegador).
export async function submitOrder(slug: string, _prev: LeadState, formData: FormData): Promise<LeadState> {
  const value = (k: string) => String(formData.get(k) ?? "").trim();
  const name = value("name");
  const phone = value("phone");
  const email = value("email");
  if (!name) return { error: "Escribe tu nombre." };
  if (!phone && !email) return { error: "Déjanos un teléfono o un correo para contactarte." };
  let items;
  try {
    items = Lines.parse(JSON.parse(value("items")));
  } catch {
    return { error: "Tu pedido está vacío." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("submit_order", {
    p_subdomain: slug,
    p_name: name,
    p_phone: phone,
    p_email: email,
    p_note: value("note"),
    p_items: items,
  });
  if (error) {
    return { error: error.message.includes("item not available") ? "Algo de tu pedido ya no está disponible. Recarga la página." : "No pudimos enviar tu pedido. Intenta de nuevo." };
  }
  return { ok: true };
}
