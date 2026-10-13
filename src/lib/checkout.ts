// Ajustes de la tienda (entrega, recoger, costo de envío y cómo pagar). Se usa en la página pública,
// en el panel y en Nuna. El costo de verdad lo calcula la base (private.delivery_fee) con la misma regla.

export type Rate = { from: number; fee: number }; // desde este subtotal, el envío cuesta fee
export type CheckoutSettings = {
  delivery: boolean;
  deliveryNote: string; // zonas, horarios de entrega
  rates: Rate[];
  pickup: boolean;
  pickupNote: string; // dónde y cuándo recoger
  paymentNote: string; // cómo pagar (número de cuenta, SINPE, efectivo al recibir…)
};

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? Math.round(v * 100) / 100 : null);
const text = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

export function checkoutSettings(raw: unknown, offersDelivery: boolean | null): CheckoutSettings {
  const o = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const rates = (Array.isArray(o.rates) ? o.rates : [])
    .map((r) => ({ from: num((r as Rate)?.from) ?? 0, fee: num((r as Rate)?.fee) }))
    .filter((r): r is Rate => r.fee !== null)
    .sort((a, b) => a.from - b.from)
    .slice(0, 6);
  return {
    delivery: typeof o.delivery === "boolean" ? o.delivery : Boolean(offersDelivery),
    deliveryNote: text(o.deliveryNote, 300),
    rates,
    pickup: typeof o.pickup === "boolean" ? o.pickup : true,
    pickupNote: text(o.pickupNote, 300),
    paymentNote: text(o.paymentNote, 500),
  };
}

// Envío para un subtotal: la tarifa con el "desde" más alto que se alcanza. null = lo confirma el negocio.
export function deliveryFee(s: Pick<CheckoutSettings, "rates">, subtotal: number): number | null {
  const hit = s.rates.filter((r) => r.from <= subtotal).sort((a, b) => b.from - a.from)[0];
  return hit ? hit.fee : null;
}
