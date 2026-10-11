import Link from "next/link";
import { requireBusiness } from "@/lib/business";
import { AutoRefresh } from "./auto-refresh";
import { CHANNEL_LABEL, STATUS_LABEL } from "./labels";
import { NunaSwitch } from "./nuna-switch";


// Bandeja: las pláticas con clientes (WhatsApp y página), las que necesitan al dueño primero.
export default async function MessagesPage() {
  const { supabase, business } = await requireBusiness();
  const [{ data: line }, { data: convs }] = await Promise.all([
    supabase.from("whatsapp_lines").select("number").eq("business_id", business.id).maybeSingle(),
    supabase
      .from("conversations")
      .select("id, channel, status, last_message_at, contacts(name, phone), messages(body, author, created_at)")
      .eq("business_id", business.id)
      .order("last_message_at", { ascending: false })
      .order("created_at", { referencedTable: "messages", ascending: false })
      .limit(1, { referencedTable: "messages" })
      .limit(80),
  ]);
  const list = (convs ?? []).sort((a, b) => Number(b.status === "needs_owner") - Number(a.status === "needs_owner"));
  const when = new Intl.DateTimeFormat("es", { dateStyle: "short", timeStyle: "short" });

  return (
    <div className="flex flex-col gap-8 pb-10">
      <AutoRefresh seconds={15} />
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">Mensajes</h1>
        <p className="max-w-2xl text-muted">
          {line
            ? `Tu WhatsApp ${line.number} está conectado. Nuna contesta con los datos de tu negocio y te avisa aquí cuando te necesita.`
            : "Aquí ves lo que te escriben desde tu página. Cuando conectemos tu WhatsApp, Nuna contestará esos mensajes por ti."}
        </p>
      </div>
      {line && <NunaSwitch on={business.nuna_replies} />}

      {!list.length && <p className="rounded-[24px] border border-dashed border-line p-8 text-center text-muted">Todavía no hay mensajes.</p>}

      <ul className="flex flex-col gap-3">
        {list.map((c) => {
          const contact = c.contacts as unknown as { name: string; phone: string | null } | null;
          const last = (c.messages as unknown as { body: string; author: string }[])[0];
          return (
            <li key={c.id}>
              <Link href={`/panel/mensajes/${c.id}`} className="flex flex-col gap-1 rounded-[24px] border border-white/[0.06] bg-panel p-4 transition hover:bg-panel-2">
                <span className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold">{contact?.name ?? "Cliente"}</span>
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${c.status === "needs_owner" ? "bg-lime text-lime-ink" : "bg-panel-2 text-muted"}`}>
                    {STATUS_LABEL[c.status] ?? c.status}
                  </span>
                </span>
                {last && (
                  <span className="line-clamp-2 text-sm text-muted">
                    {last.author === "nuna" ? "Nuna: " : last.author === "owner" ? "Tú: " : ""}
                    {last.body}
                  </span>
                )}
                <span className="text-xs text-muted">
                  {CHANNEL_LABEL[c.channel] ?? c.channel} · {when.format(new Date(c.last_message_at))}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
