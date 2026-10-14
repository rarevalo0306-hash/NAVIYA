import Link from "next/link";
import { SubmitButton } from "@/components/submit-button";
import { APP_HOST } from "@/lib/app-url";
import { requireBusiness } from "@/lib/business";
import { requestDomainPurchase } from "./actions";
import { DomainForm } from "./domain-form";

const box = "flex flex-col gap-3 rounded-[24px] border border-white/[0.06] bg-panel p-5";
const badge = (on: boolean) => `self-start rounded-full px-3 py-1 text-xs font-semibold ${on ? "bg-lime text-lime-ink" : "bg-panel-2 text-muted"}`;

// Conexiones del negocio: su WhatsApp (Nuna contesta), su correo de Google y su dominio.
export default async function ConnectionsPage() {
  const { supabase, business } = await requireBusiness();
  const [{ data: line }, { data: domain }, { data: site }, { data: purchase }] = await Promise.all([
    supabase.from("whatsapp_lines").select("number").eq("business_id", business.id).maybeSingle(),
    supabase.from("custom_domains").select("domain, verified").eq("business_id", business.id).maybeSingle(),
    supabase.from("websites").select("subdomain, status").eq("business_id", business.id).maybeSingle(),
    supabase.from("audit_log").select("data, created_at").eq("business_id", business.id).eq("action", "domain.purchase_requested").order("created_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  const freeUrl = site?.subdomain ? `${APP_HOST}/sitio/${site.subdomain}` : null;

  return (
    <div className="flex flex-col gap-6 pb-10">
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">Conexiones</h1>
        <p className="max-w-2xl text-muted">Conecta tus cuentas una sola vez y Nuna hace el resto.</p>
      </div>

      <section className={box}>
        <h2 className="text-xl font-semibold">WhatsApp del negocio</h2>
        <span className={badge(Boolean(line))}>{line ? `Conectado · ${line.number}` : "Por conectar"}</span>
        <p className="text-muted">
          {line ? (
            <>
              Nuna contesta a tus clientes en este número. Ve las pláticas en <Link href="/panel/mensajes" className="text-lime underline-offset-4 hover:underline">Mensajes</Link>.
            </>
          ) : (
            "Con tu WhatsApp conectado, Nuna contesta a tus clientes, toma pedidos y agenda citas por ti, en tu mismo número. Estamos terminando la aprobación con Meta: te avisamos cuando puedas conectarlo con un clic."
          )}
        </p>
      </section>

      <section className={box}>
        <h2 className="text-xl font-semibold">Correo y calendario de Google</h2>
        <span className={badge(false)}>Muy pronto</span>
        <p className="text-muted">
          Entrarás con tu cuenta de Google para que Nuna mande los correos desde tu dirección y tus citas aparezcan en tu Google Calendar. Mientras tanto, los avisos
          te llegan al correo con el que entras a Orbusiness.
        </p>
      </section>

      <section className={box}>
        <h2 className="text-xl font-semibold">Dominio de tu página</h2>
        {freeUrl && site?.status === "published" && (
          <p className="text-muted">
            Tu página ya está en <a href={`https://${freeUrl}`} target="_blank" className="text-lime underline-offset-4 hover:underline">{freeUrl}</a> (gratis).
          </p>
        )}
        <h3 className="mt-2 font-semibold">¿Ya tienes un dominio?</h3>
        <DomainForm current={domain?.domain ?? null} />
        {domain && (
          <div className="flex flex-col gap-2 rounded-[16px] bg-panel-2 p-4 text-sm">
            <span className={badge(domain.verified)}>{domain.verified ? "Conectado ✓" : "Pendiente de conectar"}</span>
            {!domain.verified && (
              <>
                <p>En la página donde compraste {domain.domain} (GoDaddy, Namecheap, Google, etc.), en «DNS», agrega estos dos registros:</p>
                <table className="w-full text-left">
                  <thead className="text-muted">
                    <tr>
                      <th className="py-1 pr-3 font-normal">Tipo</th>
                      <th className="py-1 pr-3 font-normal">Nombre</th>
                      <th className="py-1 font-normal">Valor</th>
                    </tr>
                  </thead>
                  <tbody className="font-mono">
                    <tr>
                      <td className="py-1 pr-3">A</td>
                      <td className="py-1 pr-3">@</td>
                      <td className="py-1">76.76.21.21</td>
                    </tr>
                    <tr>
                      <td className="py-1 pr-3">CNAME</td>
                      <td className="py-1 pr-3">www</td>
                      <td className="py-1">cname.vercel-dns.com</td>
                    </tr>
                  </tbody>
                </table>
                <p className="text-muted">No borres otros registros (por ejemplo los de tu correo). Cuando estén, Orbusiness conecta tu dominio y te avisamos. ¿Dudas? Pregúntale a Nuna.</p>
              </>
            )}
          </div>
        )}
        <h3 className="mt-4 font-semibold">¿No tienes dominio?</h3>
        {purchase ? (
          <p className="text-muted">Recibimos tu solicitud{(purchase.data as { wanted?: string })?.wanted ? ` (${(purchase.data as { wanted?: string }).wanted})` : ""}. Te contactamos para elegirlo y conectarlo.</p>
        ) : (
          <form action={requestDomainPurchase} className="flex flex-col gap-2 sm:flex-row">
            <input
              name="wanted"
              maxLength={100}
              placeholder="¿Qué nombre te gustaría? Ej.: panelhorno.com"
              aria-label="Dominio que te gustaría"
              className="min-h-12 flex-1 rounded-[14px] border border-line bg-ink px-4 text-bone placeholder:text-muted/70"
            />
            <SubmitButton variant="ghost" pendingText="Enviando…">
              Quiero uno
            </SubmitButton>
          </form>
        )}
      </section>
    </div>
  );
}
