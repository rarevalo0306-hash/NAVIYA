import { ButtonLink, Card, PageTitle } from "@/components/ui";
import { geminiLiveEnabled } from "@/lib/gemini-live";
import { requireBusiness } from "@/lib/business";
import { QUESTIONS, answeredKeysOf, describeAnswer, missingQuestions } from "@/lib/interview";
import { nunaUsesAI } from "@/lib/nuna";
import { voiceLang } from "@/lib/voice";
import { aiVoiceEnabled, realtimeEnabled } from "@/lib/voice-ai";
import { completeMissing, startFix } from "./actions";
import { InterviewChat } from "./chat";
import { RestartButton } from "./restart-button";

export default async function InterviewPage() {
  const { supabase, business } = await requireBusiness();
  const [{ data: messages }, { data: services }] = await Promise.all([
    supabase
      .from("interview_messages")
      .select("id, role, content, step_key")
      .eq("business_id", business.id)
      .order("created_at"),
    supabase.from("services").select("name, price").eq("business_id", business.id).order("sort"),
  ]);

  const step = messages?.filter((m) => m.role === "nuna").at(-1)?.step_key ?? null;
  const open = step !== "done";
  const interviewDone = business.onboarding_step !== "interview";
  const fixingKey = step?.startsWith("fix:") ? step.slice(4).split(">")[0] : null;

  const answeredKeys = new Set(
    (messages ?? [])
      .filter((m) => m.role === "owner")
      .flatMap((m) => answeredKeysOf(m.step_key)),
  );
  const missing = step === "done" ? missingQuestions(business, services ?? [], answeredKeys) : [];

  const understood = QUESTIONS.filter((q) => !q.applies || q.applies(business)).map((q) => ({
    key: q.key,
    label: q.label,
    value: describeAnswer(q.key, business, services ?? [], interviewDone),
  }));

  return (
    <>
      <PageTitle
        title="Platícame de tu negocio"
        lead={
          nunaUsesAI()
            ? "Contesta con tus palabras, escribiendo o hablando. Nuna (con IA) entiende tus respuestas y arma todo con ellas."
            : "Contesta con tus palabras. Nuna está en modo básico (sin IA): entiende respuestas sencillas."
        }
      />
      <div className="grid gap-4 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-3">
          <InterviewChat messages={messages ?? []} open={open} lang={voiceLang(business.country_code)} aiVoice={aiVoiceEnabled()} realtime={realtimeEnabled()} ownerName={business.owner_name}
            nextHref={business.onboarding_step === "brand" ? "/onboarding/marca" : null}
            voiceAgent={geminiLiveEnabled() ? "gemini" : realtimeEnabled() ? "openai" : null}
          />
          {missing.length > 0 && (
            <form action={completeMissing} className="flex flex-wrap items-center gap-3 rounded-[24px] border border-lime/40 bg-lime/10 p-5">
              <p className="flex-1">
                Nuna necesita {missing.length} dato{missing.length > 1 ? "s" : ""} más para dejar todo listo (
                {missing.map((q) => q.label.toLowerCase()).join(", ")}).
              </p>
              <button className="min-h-11 rounded-full bg-lime px-5 font-semibold text-lime-ink transition active:scale-[0.98]">Completar ahora</button>
            </form>
          )}
        </div>
        <div className="flex flex-col gap-4">
        {/* Avance en grande, estilo tablero */}
        <Card className="flex flex-col gap-4">
          <span className="text-sm font-semibold text-muted">Lo que Nuna ya sabe</span>
          <span className="font-display text-6xl font-bold leading-none tracking-tight">
            {understood.filter((i) => i.value).length}
            <span className="text-3xl text-muted">/{understood.length}</span>
          </span>
          <div className="h-1.5 overflow-hidden rounded-full bg-panel-2" aria-hidden>
            <div
              className="h-full rounded-full bg-lime transition-all duration-500"
              style={{ width: `${(understood.filter((i) => i.value).length / Math.max(understood.length, 1)) * 100}%` }}
            />
          </div>
        </Card>
        <Card className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-display text-xl font-bold tracking-tight">Lo que Nuna entendió</h2>
            <RestartButton />
          </div>
          <dl className="flex flex-col gap-3">
            {understood.map((item) => (
              <div key={item.key} className="flex items-start justify-between gap-2 border-b border-line pb-2">
                <div className="min-w-0">
                  <dt className="text-xs font-semibold uppercase tracking-wide text-muted">{item.label}</dt>
                  <dd className="break-words">{item.value ?? "—"}</dd>
                </div>
                {item.value && fixingKey !== item.key && (
                  <form action={startFix.bind(null, item.key)}>
                    <button
                      className="min-h-9 shrink-0 rounded-full bg-panel-2 px-3 text-xs font-semibold text-muted transition hover:text-bone active:scale-[0.97]"
                      aria-label={`Corregir ${item.label.toLowerCase()}`}
                    >
                      Corregir
                    </button>
                  </form>
                )}
              </div>
            ))}
          </dl>
        </Card>
        </div>
      </div>
      {interviewDone && !open && (
        <ButtonLink href="/onboarding/marca" className="self-start">
          Seguir: logo, fotos y web →
        </ButtonLink>
      )}
    </>
  );
}
