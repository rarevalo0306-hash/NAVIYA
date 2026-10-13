"use server";

import { revalidatePath } from "next/cache";
import { refreshPublishedSite } from "@/lib/brand-store";
import { requireBusiness } from "@/lib/business";
import { bookingSettings, zonedToUtc } from "@/lib/booking";
import type { Json } from "@/lib/database.types";

// Horarios de la agenda (se aplican a la página publicada).
export async function saveBooking(formData: FormData) {
  const { supabase, business } = await requireBusiness();
  const n = (k: string) => Number(formData.get(k));
  const hours: Record<string, [string, string][]> = {};
  for (let d = 0; d < 7; d++) {
    hours[String(d)] =
      formData.get(`abre${d}`) === "on"
        ? [0, 1].map((i) => [String(formData.get(`de${d}_${i}`) ?? ""), String(formData.get(`a${d}_${i}`) ?? "")] as [string, string]).filter(([a, b]) => a && b)
        : [];
  }
  const settings = bookingSettings(
    { enabled: formData.get("enabled") === "on", tz: String(formData.get("tz") ?? ""), slot: n("slot"), capacity: n("capacity"), noticeHours: n("noticeHours"), advanceDays: n("advanceDays"), hours },
    business.country_code,
  );
  const { data: updated, error } = await supabase.from("businesses").update({ booking: settings as unknown as Json }).eq("id", business.id).select("*").single();
  if (error) throw new Error(error.message);
  await refreshPublishedSite(supabase, updated);
  revalidatePath("/panel/agenda");
}

const STATUSES = ["scheduled", "done", "cancelled", "no_show"];

export async function setAppointmentStatus(id: string, status: string) {
  if (!STATUSES.includes(status)) return;
  const { supabase, business } = await requireBusiness();
  await supabase.from("appointments").update({ status }).eq("id", id).eq("business_id", business.id);
  revalidatePath("/panel/agenda");
}

// Cita que el dueño anota a mano (por ejemplo, la agendaron por teléfono).
export async function addAppointment(formData: FormData) {
  const { supabase, business } = await requireBusiness();
  const text = (k: string) => String(formData.get(k) ?? "").trim();
  const settings = bookingSettings(business.booking, business.country_code);
  const date = text("date");
  const time = text("time");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time) || !text("name")) return;
  const { data: service } = await supabase.from("services").select("id, name, duration_minutes").eq("business_id", business.id).eq("id", text("service")).maybeSingle();
  const start = zonedToUtc(date, time, settings.tz);
  const minutes = service?.duration_minutes ?? settings.slot;
  await supabase.from("appointments").insert({
    business_id: business.id,
    service_id: service?.id ?? null,
    title: service?.name ?? (text("title") || "Cita"),
    kind: "booking",
    starts_at: start,
    ends_at: new Date(new Date(start).getTime() + minutes * 60_000).toISOString(),
    customer_name: text("name").slice(0, 120),
    customer_phone: text("phone").slice(0, 40) || null,
    notes: text("notes").slice(0, 1000) || null,
  });
  revalidatePath("/panel/agenda");
}
