// Agenda del negocio (citas para servicios). La usan la página pública, el panel y Nuna.
// Los horarios libres los calcula la base (private.free_slots); aquí solo se leen y se validan los ajustes.

export type BookingSettings = {
  enabled: boolean;
  tz: string; // zona horaria IANA
  slot: number; // cada cuántos minutos empieza un turno (y duración si el servicio no tiene)
  capacity: number; // citas al mismo tiempo
  noticeHours: number; // anticipación mínima
  advanceDays: number; // hasta cuántos días adelante
  hours: Record<string, [string, string][]>; // "0" domingo … "6" sábado
};

export const WEEKDAYS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

const TZ_BY_COUNTRY: Record<string, string> = {
  MX: "America/Mexico_City", GT: "America/Guatemala", HN: "America/Tegucigalpa", SV: "America/El_Salvador",
  NI: "America/Managua", CR: "America/Costa_Rica", PA: "America/Panama", CO: "America/Bogota", VE: "America/Caracas",
  EC: "America/Guayaquil", PE: "America/Lima", BO: "America/La_Paz", CL: "America/Santiago", AR: "America/Argentina/Buenos_Aires",
  UY: "America/Montevideo", PY: "America/Asuncion", DO: "America/Santo_Domingo", US: "America/New_York", CA: "America/Toronto",
};

export const TIMEZONES = [
  ...new Set([
    ...Object.values(TZ_BY_COUNTRY),
    "America/Chicago", "America/Denver", "America/Phoenix", "America/Los_Angeles", "America/Tijuana", "America/Cancun", "America/Vancouver",
  ]),
];

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const int = (v: unknown, min: number, max: number, d: number) => (typeof v === "number" && Number.isFinite(v) ? Math.min(max, Math.max(min, Math.round(v))) : d);

export function bookingSettings(raw: unknown, countryCode: string | null): BookingSettings {
  const o = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const rawHours = o.hours && typeof o.hours === "object" ? (o.hours as Record<string, unknown>) : null;
  const hours: BookingSettings["hours"] = {};
  for (let d = 0; d < 7; d++) {
    const list = rawHours ? rawHours[String(d)] : d === 0 ? [] : [["09:00", "17:00"]]; // sin ajustes: lunes a sábado de 9 a 5
    hours[String(d)] = (Array.isArray(list) ? list : [])
      .filter((r): r is [string, string] => Array.isArray(r) && HHMM.test(r[0]) && HHMM.test(r[1]) && r[0] < r[1])
      .slice(0, 3);
  }
  return {
    enabled: o.enabled === true,
    tz: typeof o.tz === "string" && o.tz ? o.tz : (TZ_BY_COUNTRY[countryCode ?? ""] ?? "America/New_York"),
    slot: int(o.slot, 15, 240, 60),
    capacity: int(o.capacity, 1, 20, 1),
    noticeHours: int(o.noticeHours, 0, 168, 2),
    advanceDays: int(o.advanceDays, 1, 180, 30),
    hours,
  };
}

// "jueves 15 de octubre, 9:00 a. m." en la zona del negocio.
export const formatSlot = (iso: string, tz: string, opts: Intl.DateTimeFormatOptions = { weekday: "long", day: "numeric", month: "long", hour: "numeric", minute: "2-digit" }) =>
  new Intl.DateTimeFormat("es", { ...opts, timeZone: tz }).format(new Date(iso));

// "2026-10-15" + "09:30" en la zona del negocio -> instante UTC (ISO).
export function zonedToUtc(date: string, time: string, tz: string) {
  const guess = new Date(`${date}T${time}:00Z`);
  const shown = new Date(new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" })
    .format(guess)
    .replace(/(\d+)\/(\d+)\/(\d+), (\d+):(\d+):(\d+)/, "$3-$1-$2T$4:$5:$6Z"));
  return new Date(guess.getTime() - (shown.getTime() - guess.getTime())).toISOString();
}
