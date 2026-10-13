import Link from "next/link";
import { Fish } from "@/components/fish";
import { publicAssetUrl, requireBusiness } from "@/lib/business";
import { MAX_ITEMS, itemPrice } from "@/lib/catalog";
import { ListImport } from "./list-import";
import { VisibleToggle } from "./visible-toggle";

// "Lo que vendes": lo que el negocio ofrece, con foto y precio. Lo que se cambia aquí sale solo en su página.
export default async function SellPage() {
  const { supabase, business } = await requireBusiness();
  const { data } = await supabase.from("services").select("*").eq("business_id", business.id).order("kind").order("sort");
  const items = data ?? [];
  const kinds = business.business_type === "products" ? ["product"] : business.business_type === "services" ? ["service"] : ["product", "service"];
  const groups = (["product", "service"] as const).filter((k) => kinds.includes(k) || items.some((i) => i.kind === k));

  return (
    <div className="flex flex-col gap-8 pb-10">
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">Lo que vendes</h1>
        <p className="max-w-2xl text-muted">
          Todo lo que agregues aquí sale solo en tu página web. Nuna te ayuda con las fotos y las descripciones.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {kinds.includes("product") && (
          <Link href="/panel/vender/nuevo?tipo=producto" className="inline-flex min-h-12 items-center rounded-full bg-lime px-6 font-semibold text-lime-ink transition active:scale-[0.98]">
            + Agregar producto
          </Link>
        )}
        {kinds.includes("service") && (
          <Link href="/panel/vender/nuevo?tipo=servicio" className="inline-flex min-h-12 items-center rounded-full bg-lime px-6 font-semibold text-lime-ink transition active:scale-[0.98]">
            + Agregar servicio
          </Link>
        )}
        <ListImport />
        {kinds.includes("product") && (
          <Link href="/panel/vender/entrega" className="inline-flex min-h-12 items-center rounded-full border border-line px-5 font-semibold transition hover:bg-panel">
            Entrega y pago
          </Link>
        )}
        <span className="text-sm text-muted">
          {items.length} de {MAX_ITEMS}
        </span>
      </div>

      {!items.length && (
        <p className="rounded-[24px] border border-dashed border-line p-8 text-center text-muted">
          Todavía no tienes nada aquí. Agrega tu primer {kinds[0] === "product" ? "producto" : "servicio"} o sube una foto de tu lista de precios y Nuna los crea por ti.
        </p>
      )}

      {groups.map((kind) => {
        const list = items.filter((i) => i.kind === kind);
        if (!list.length) return null;
        return (
          <section key={kind} className="flex flex-col gap-4" aria-labelledby={`grupo-${kind}`}>
            <h2 id={`grupo-${kind}`} className="font-display text-2xl font-bold">
              {kind === "product" ? "Productos" : "Servicios"}
            </h2>
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {list.map((i) => (
                <li key={i.id} className={`flex gap-4 rounded-[24px] border border-white/[0.06] bg-panel p-3 ${i.active ? "" : "opacity-60"}`}>
                  <Link href={`/panel/vender/${i.id}`} className="flex min-w-0 flex-1 gap-4">
                    {i.image_path ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={publicAssetUrl(i.image_path)} alt="" className="size-24 shrink-0 rounded-[18px] object-cover" />
                    ) : (
                      <span className="flex size-24 shrink-0 items-center justify-center rounded-[18px] bg-panel-2 text-muted">
                        <Fish size={34} />
                      </span>
                    )}
                    <span className="flex min-w-0 flex-col gap-1 py-1">
                      <span className="font-semibold leading-snug">{i.name}</span>
                      <span className="text-sm text-lime">{itemPrice(i, business.currency)}</span>
                      {i.category && <span className="truncate text-xs text-muted">{i.category}</span>}
                      {!i.image_path && <span className="text-xs text-muted">Sin foto</span>}
                    </span>
                  </Link>
                  <VisibleToggle id={i.id} active={i.active} />
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
