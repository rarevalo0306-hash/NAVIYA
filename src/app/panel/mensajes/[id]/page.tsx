import Link from "next/link";
import { notFound } from "next/navigation";
import { requireBusiness } from "@/lib/business";
import { setConversationStatus } from "../actions";
import { AutoRefresh } from "../auto-refresh";
import { CHANNEL_LABEL, STATUS_LABEL } from "../labels";
import { ReplyForm } from "./reply-form";

const AUTHOR: Record<string, string> = { customer: "", nuna: "Nuna", owner: "Tú", system: "Nota" };

// Una plática con un cliente: lo que escribió, lo que contestó Nuna y lo que contestó el dueño.
export default async function ConversationPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const { supabase, business } = await requireBusiness();
  const [{ data: conv }, { data: messages }] = await Promise.all([
    supabase.from("conversations").select("id, channel, status, contacts(name, phone, email)").eq("id", id).eq("business_id", business.id).maybeSingle(),
    supabase.from("messages").select("id, author, body, created_at").eq("conversation_id", id).eq("business_id", business.id).order("created_at").limit(300),
  ]);
  if (!conv) notFound();
  const contact = conv.contacts as unknown as { name: string; phone: string | null; email: string | null } | null;
  const when = new Intl.DateTimeFormat("es", { dateStyle: "short", timeStyle: "short" });
  const statusButton = (status: "nuna" | "owner" | "closed", label: string) => (
    <form action={setConversationStatus.bind(null, id, status)}>
      <button className="min-h-11 rounded-full border border-line px-4 text-sm font-semibold hover:bg-panel">{label}</button>
    </form>
  );

  return (
    <div className="flex flex-col gap-6 pb-10">
      <AutoRefresh />
      <Link href="/panel/mensajes" className="min-h-11 content-center self-start text-sm text-muted underline underline-offset-4 hover:text-bone">
        ← Mensajes
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="font-display text-3xl font-bold tracking-tight">{contact?.name ?? "Cliente"}</h1>
          <p className="text-sm text-muted">
            {[CHANNEL_LABEL[conv.channel] ?? conv.channel, contact?.phone, contact?.email].filter(Boolean).join(" · ")}
          </p>
        </div>
        <span className={`rounded-full px-3 py-1 text-sm font-semibold ${conv.status === "needs_owner" ? "bg-lime text-lime-ink" : "bg-panel text-muted"}`}>
          {STATUS_LABEL[conv.status] ?? conv.status}
        </span>
      </div>

      <ol className="flex flex-col gap-3">
        {(messages ?? []).map((m) => {
          const mine = m.author !== "customer";
          return (
            <li key={m.id} className={`flex max-w-[85%] flex-col gap-1 ${mine ? "self-end items-end" : "self-start"}`}>
              <span className={`whitespace-pre-wrap rounded-[20px] px-4 py-2.5 ${m.author === "owner" ? "bg-lime text-lime-ink" : mine ? "bg-panel-2" : "bg-panel"}`}>{m.body}</span>
              <span className="text-xs text-muted">{[AUTHOR[m.author], when.format(new Date(m.created_at))].filter(Boolean).join(" · ")}</span>
            </li>
          );
        })}
      </ol>

      {conv.channel === "whatsapp" && <ReplyForm id={id} />}
      <div className="flex flex-wrap gap-2">
        {conv.channel === "whatsapp" && conv.status !== "nuna" && statusButton("nuna", "Que Nuna siga atendiendo")}
        {conv.channel === "whatsapp" && conv.status === "nuna" && statusButton("owner", "Atiendo yo")}
        {conv.status !== "closed" && statusButton("closed", "Cerrar plática")}
      </div>
    </div>
  );
}
