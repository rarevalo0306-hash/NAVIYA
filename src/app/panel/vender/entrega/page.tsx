import Link from "next/link";
import { SubmitButton } from "@/components/submit-button";
import { requireBusiness } from "@/lib/business";
import { checkoutSettings } from "@/lib/checkout";
import { currencyName } from "@/lib/interview";
import { saveCheckout } from "./actions";

const field = "min-h-12 w-full rounded-[16px] border border-line bg-ink px-4 text-bone placeholder:text-muted/70";
const box = "flex flex-col gap-4 rounded-[24px] border border-white/[0.06] bg-panel p-5";

// Entrega y pago de la tienda: lo que ve el cliente en el checkout de la página.
export default async function DeliveryPage() {
  const { business } = await requireBusiness();
  const s = checkoutSettings(business.checkout, business.offers_delivery);
  const rows = [...s.rates, { from: null, fee: null }, { from: null, fee: null }].slice(0, Math.max(3, s.rates.length + 1));

  return (
    <div className="flex flex-col gap-6 pb-10">
      <Link href="/panel/vender" className="min-h-11 content-center self-start text-sm text-muted underline underline-offset-4 hover:text-bone">
        ← Lo que vendes
      </Link>
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-3xl font-bold tracking-tight">Entrega y pago</h1>
        <p className="max-w-2xl text-muted">Así reciben y pagan tus clientes cuando compran en tu página. Los precios van en {currencyName(business.currency)}.</p>
      </div>

      <form action={saveCheckout} className="flex max-w-2xl flex-col gap-5">
        <section className={box}>
          <label className="flex items-center gap-3 text-lg font-semibold">
            <input type="checkbox" name="delivery" defaultChecked={s.delivery} className="size-5 accent-[var(--color-lime)]" />
            Entrega a domicilio
          </label>
          <label className="flex flex-col gap-1 text-sm font-semibold text-muted">
            Zonas y horarios de entrega (lo ve el cliente)
            <input name="deliveryNote" defaultValue={s.deliveryNote} maxLength={300} placeholder="Ej.: Managua, de lunes a sábado de 9 a 5" className={field} />
          </label>
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-sm font-semibold text-muted">Costo de envío</legend>
            <p className="text-sm text-muted">
              Fijo: deja «desde» en 0 y pon el costo. Según la compra: agrega otro renglón, por ejemplo desde 50 → envío 0 (gratis). Sin costo puesto, el
              cliente ve «te lo confirmamos».
            </p>
            {rows.map((r, i) => (
              <div key={i} className="grid grid-cols-2 gap-3">
                <label className="flex flex-col gap-1 text-xs text-muted">
                  Si la compra es desde
                  <input name="from" inputMode="decimal" defaultValue={r.from ?? ""} placeholder={i === 0 ? "0" : ""} className={field} />
                </label>
                <label className="flex flex-col gap-1 text-xs text-muted">
                  El envío cuesta
                  <input name="fee" inputMode="decimal" defaultValue={r.fee ?? ""} className={field} />
                </label>
              </div>
            ))}
          </fieldset>
        </section>

        <section className={box}>
          <label className="flex items-center gap-3 text-lg font-semibold">
            <input type="checkbox" name="pickup" defaultChecked={s.pickup} className="size-5 accent-[var(--color-lime)]" />
            Recoger en el local
          </label>
          <label className="flex flex-col gap-1 text-sm font-semibold text-muted">
            Dónde y cuándo recoger
            <input name="pickupNote" defaultValue={s.pickupNote} maxLength={300} placeholder={business.address ?? "Dirección y horario"} className={field} />
          </label>
        </section>

        <section className={box}>
          <h2 className="text-lg font-semibold">Cómo te pagan</h2>
          <p className="text-sm text-muted">
            Formas de pago que aceptas: {business.payment_methods.length ? business.payment_methods.join(", ") : "todavía no las dijiste"} (se cambian en
            «Ajustar mi negocio» o pidiéndoselo a Nuna).
          </p>
          <label className="flex flex-col gap-1 text-sm font-semibold text-muted">
            Instrucciones de pago (el cliente las ve al confirmar su pedido)
            <textarea
              name="paymentNote"
              defaultValue={s.paymentNote}
              maxLength={500}
              rows={3}
              placeholder="Ej.: Transferencia a BAC cuenta 123456 a nombre de… Envía tu comprobante por WhatsApp. O paga en efectivo al recibir."
              className={`${field} py-3`}
            />
          </label>
        </section>

        <SubmitButton pendingText="Guardando…" className="self-start">
          Guardar
        </SubmitButton>
      </form>
    </div>
  );
}
