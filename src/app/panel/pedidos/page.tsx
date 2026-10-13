import { requireBusiness } from "@/lib/business";
import { money } from "@/lib/interview";
import { StatusSelect } from "./status-select";

type Line = { name: string; qty: number; price: number | null; price_mode: string; options: Record<string, string> };

// Pedidos y cotizaciones que mandan los clientes desde la página web.
export default async function OrdersPage() {
  const { supabase, business } = await requireBusiness();
  const { data } = await supabase
    .from("orders")
    .select("*, contacts(name, phone, email)")
    .eq("business_id", business.id)
    .order("created_at", { ascending: false })
    .limit(100);
  const orders = data ?? [];
  const when = new Intl.DateTimeFormat("es", { dateStyle: "medium", timeStyle: "short" });

  return (
    <div className="flex flex-col gap-8 pb-10">
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">Pedidos</h1>
        <p className="max-w-2xl text-muted">Lo que tus clientes piden o cotizan desde tu página. Cada cliente queda también en tus Clientes.</p>
      </div>

      {!orders.length && (
        <p className="rounded-[24px] border border-dashed border-line p-8 text-center text-muted">
          Todavía no te llegan pedidos. Cuando un cliente pida algo en tu página, aparece aquí.
        </p>
      )}

      <ul className="flex flex-col gap-4">
        {orders.map((o) => {
          const contact = o.contacts as unknown as { name: string; phone: string | null; email: string | null } | null;
          const lines = (Array.isArray(o.items) ? o.items : []) as unknown as Line[];
          const phone = o.customer_phone ?? contact?.phone ?? null;
          const digits = phone?.replace(/\D/g, "");
          return (
            <li key={o.id} className="flex flex-col gap-4 rounded-[24px] border border-white/[0.06] bg-panel p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex flex-col gap-1">
                  <span className="text-sm text-muted">
                    {o.kind === "order" ? "Pedido" : "Cotización"}
                    {o.number ? ` #${o.number}` : ""} · {when.format(new Date(o.created_at))}
                  </span>
                  <span className="text-lg font-semibold">{contact?.name ?? "Cliente"}</span>
                  <span className="flex flex-wrap gap-3 text-sm">
                    {digits && (
                      <a href={`https://wa.me/${digits}`} target="_blank" rel="noopener" className="font-semibold text-lime underline-offset-4 hover:underline">
                        WhatsApp {phone}
                      </a>
                    )}
                    {contact?.email && (
                      <a href={`mailto:${contact.email}`} className="text-muted underline-offset-4 hover:underline">
                        {contact.email}
                      </a>
                    )}
                  </span>
                </div>
                <StatusSelect id={o.id} status={o.status} />
              </div>
              <ul className="flex flex-col divide-y divide-white/[0.06] text-sm">
                {lines.map((l, i) => (
                  <li key={i} className="flex justify-between gap-3 py-2">
                    <span>
                      {l.qty} × {l.name}
                      {Object.keys(l.options ?? {}).length > 0 && <span className="text-muted"> ({Object.entries(l.options).map(([k, v]) => `${k}: ${v}`).join(", ")})</span>}
                    </span>
                    <span className="shrink-0 text-muted">{l.price === null ? "a cotizar" : `${l.price_mode === "from" ? "desde " : ""}${money(Number(l.price) * l.qty, o.currency)}`}</span>
                  </li>
                ))}
              </ul>
              {(o.fulfillment || o.payment_method) && (
                <p className="flex flex-col gap-1 text-sm">
                  {o.fulfillment === "delivery" && <span>🚚 Entrega a domicilio: {o.address}</span>}
                  {o.fulfillment === "pickup" && <span>🏪 Recoge en el local</span>}
                  {o.payment_method && <span>💳 Paga con: {o.payment_method}</span>}
                </p>
              )}
              {o.note && <p className="rounded-[16px] bg-panel-2 p-3 text-sm">Nota: {o.note}</p>}
              {o.total !== null && (
                <div className="flex flex-col items-end gap-0.5 text-sm">
                  {o.subtotal !== null && o.fulfillment === "delivery" && <span className="text-muted">Subtotal: {money(Number(o.subtotal), o.currency)}</span>}
                  {o.fulfillment === "delivery" && (
                    <span className="text-muted">Envío: {o.delivery_fee === null ? "por confirmar" : money(Number(o.delivery_fee), o.currency)}</span>
                  )}
                  <span className="text-base font-semibold">Total: {money(Number(o.total), o.currency)}</span>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
