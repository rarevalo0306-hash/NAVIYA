"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { NunaMark, type NunaState } from "@/components/nuna-mark";
import { OpenAIAgentVoice } from "@/lib/voice-openai-agent";
import { askNuna, startCompanionVoice } from "./companion-actions";

// Nuna acompaña al dueño en marca, página web, CRM y activar: abajo al centro, su logo animado y una
// barra con escribir, hablar y minimizar (como un asistente flotante). Al llegar a cada paso deja un globito.

type Msg = { role: "owner" | "nuna"; text: string };
const MIN_KEY = "orbusiness:nuna-minimizada";
const TIP_KEY = (step: string) => `orbusiness:nuna-tip:${step}`;
const read = (key: string) => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};
const write = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value);
  } catch {}
};

export function NunaCompanion({ tips, voice }: { tips: Record<string, string>; voice: boolean }) {
  const step = usePathname()?.split("/")[2] ?? "";
  const tip = tips[step];
  const [minimized, setMinimized] = useState(false);
  const [open, setOpen] = useState(false);
  const [tipShown, setTipShown] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const [live, setLive] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const voiceRef = useRef<OpenAIAgentVoice | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Lo guardado del navegador solo se puede leer ya montado.
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- depende del navegador, solo se sabe ya montado */
    setMinimized(read(MIN_KEY) === "1");
    setTipShown(Boolean(tip) && read(TIP_KEY(step)) !== "1");
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [step, tip]);

  // Al cambiar de paso, la voz se cierra (sus instrucciones eran del paso anterior).
  useEffect(() => {
    return () => {
      voiceRef.current?.close();
      voiceRef.current = null;
    };
  }, [step]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages.length, open]);

  if (!tip) return null;

  const state: NunaState = connecting || pending ? "thinking" : speaking ? "speaking" : listening ? "listening" : "idle";

  function closeTip() {
    setTipShown(false);
    write(TIP_KEY(step), "1");
  }

  function openChat() {
    closeTip();
    if (!messages.length) setMessages([{ role: "nuna", text: tip }]);
    setOpen((o) => !o);
  }

  function minimize(on: boolean) {
    setMinimized(on);
    write(MIN_KEY, on ? "1" : "0");
    if (on) {
      setOpen(false);
      voiceRef.current?.close();
    }
  }

  async function ask(text: string) {
    const q = text.trim();
    if (!q || pending) return;
    setDraft("");
    setError(null);
    // Platicando por voz, lo escrito entra a la misma plática y ella contesta hablando.
    if (voiceRef.current && live) return voiceRef.current.sendText(q);
    const history = messages;
    setMessages((m) => [...m, { role: "owner", text: q }]);
    setPending(true);
    const r = await askNuna(step, history, q).catch(() => ({ error: "Se cortó la conexión. Intenta de nuevo." }));
    setMessages((m) => [...m, { role: "nuna", text: "reply" in r ? r.reply : r.error }]);
    setPending(false);
  }

  async function toggleVoice() {
    if (voiceRef.current) {
      voiceRef.current.close();
      return;
    }
    closeTip();
    setError(null);
    setConnecting(true);
    const v = new OpenAIAgentVoice({
      onSpeaking: setSpeaking,
      onListening: setListening,
      onTool: async () => ({}),
      onTurn: (owner, said) =>
        setMessages((m) => [...m, ...(owner ? [{ role: "owner" as const, text: owner }] : []), ...(said ? [{ role: "nuna" as const, text: said }] : [])]),
      onClosed: () => {
        if (voiceRef.current !== v) return;
        voiceRef.current = null;
        setLive(false);
        setSpeaking(false);
        setListening(false);
      },
    });
    voiceRef.current = v;
    try {
      const s = await startCompanionVoice(step);
      if ("error" in s) throw new Error(s.error);
      await v.connect(s.key, "hola");
      if (voiceRef.current !== v) return v.close();
      setLive(true);
      if (!messages.length) setMessages([{ role: "nuna", text: tip }]);
      setOpen(true);
    } catch (e) {
      v.close();
      voiceRef.current = null;
      const denied = e instanceof DOMException && e.name === "NotAllowedError";
      setError(denied ? "Para hablar, permite el micrófono en tu navegador." : "No pude conectar la voz. Puedes escribirme.");
    } finally {
      setConnecting(false);
    }
  }

  if (minimized)
    return (
      <button
        type="button"
        onClick={() => minimize(false)}
        aria-label="Abrir a Nuna"
        className="fixed bottom-4 right-4 z-40 rounded-full transition hover:scale-105 active:scale-95"
      >
        <NunaMark size={64} state={state} />
      </button>
    );

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-3 z-40 flex flex-col items-center gap-2 px-4">
      {open && (
        <section
          aria-label="Plática con Nuna"
          className="pointer-events-auto flex max-h-[55dvh] w-full max-w-md flex-col overflow-hidden rounded-[24px] border border-white/[0.08] bg-panel shadow-2xl shadow-black/50"
        >
          <div ref={listRef} aria-live="polite" className="flex flex-1 flex-col gap-3 overflow-y-auto p-4">
            {messages.map((m, i) =>
              m.role === "owner" ? (
                <p key={i} className="max-w-[85%] self-end rounded-[18px] rounded-br-md bg-lime px-3 py-2 text-[15px] font-medium text-lime-ink">
                  {m.text}
                </p>
              ) : (
                <p key={i} className="max-w-[92%] text-[15px] leading-relaxed">
                  {m.text}
                </p>
              ),
            )}
            {pending && <p className="text-sm text-muted">Nuna está pensando…</p>}
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void ask(draft);
            }}
            className="flex gap-2 border-t border-line p-2"
          >
            <label htmlFor="nuna-pregunta" className="sr-only">
              Pregúntale a Nuna
            </label>
            <input
              id="nuna-pregunta"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              autoComplete="off"
              placeholder={live ? "Escribe mientras platican…" : "Pregúntale a Nuna…"}
              className="min-h-11 min-w-0 flex-1 bg-transparent px-3 text-[16px] outline-none placeholder:text-muted/70"
            />
            <button
              type="submit"
              disabled={pending || !draft.trim()}
              aria-label="Enviar"
              className="flex size-11 shrink-0 items-center justify-center rounded-full bg-lime text-lime-ink transition active:scale-95 disabled:opacity-40"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="size-5" aria-hidden>
                <path d="M12 19V5M5 12l7-7 7 7" />
              </svg>
            </button>
          </form>
        </section>
      )}

      {!open && tipShown && (
        <div role="status" className="pointer-events-auto relative max-w-sm rounded-[20px] border border-white/[0.08] bg-panel px-4 py-3 pr-10 text-[15px] leading-relaxed shadow-xl shadow-black/40">
          {tip}
          <button type="button" onClick={closeTip} aria-label="Cerrar mensaje de Nuna" className="absolute right-2 top-2 flex size-8 items-center justify-center rounded-full text-muted hover:text-bone">
            ×
          </button>
        </div>
      )}
      {error && (
        <p role="alert" className="pointer-events-auto rounded-full bg-panel px-4 py-2 text-sm text-muted shadow-lg">
          {error}
        </p>
      )}

      <button type="button" onClick={openChat} aria-label={open ? "Cerrar la plática con Nuna" : "Platicar con Nuna"} className="pointer-events-auto -mb-1 rounded-full">
        <NunaMark size={open ? 60 : 84} state={state} />
      </button>
      <div className="pointer-events-auto flex items-center rounded-full border border-white/[0.08] bg-panel px-2 py-1.5 shadow-xl shadow-black/40">
        <button
          type="button"
          onClick={openChat}
          aria-pressed={open}
          aria-label="Escribirle a Nuna"
          className={`flex size-12 items-center justify-center rounded-full transition active:scale-95 ${open ? "bg-panel-2 text-lime" : "text-bone hover:bg-panel-2"}`}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-6" aria-hidden>
            <path d="M12 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-6" />
            <path d="M18.4 2.6a2 2 0 0 1 2.8 2.8L12 14.6l-4 1 1-4z" />
          </svg>
        </button>
        {voice && (
          <>
            <span aria-hidden className="mx-1 h-7 w-px bg-line" />
            <button
              type="button"
              onClick={toggleVoice}
              disabled={connecting}
              aria-pressed={live}
              aria-label={live ? "Terminar la voz con Nuna" : "Hablar con Nuna"}
              className={`flex size-12 items-center justify-center rounded-full transition active:scale-95 disabled:opacity-60 ${
                live ? "bg-red-500 text-white" : "text-bone hover:bg-panel-2"
              }`}
            >
              {connecting ? (
                <span aria-hidden className="size-5 rounded-full border-2 border-bone/30 border-t-bone motion-safe:animate-spin" />
              ) : live ? (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" className="size-5" aria-hidden>
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" className="size-6" aria-hidden>
                  <path d="M4 10v4M8 7v10M12 4v16M16 7v10M20 10v4" />
                </svg>
              )}
            </button>
          </>
        )}
        <span aria-hidden className="mx-1 h-7 w-px bg-line" />
        <button type="button" onClick={() => minimize(true)} aria-label="Minimizar a Nuna" className="flex size-12 items-center justify-center rounded-full text-bone transition hover:bg-panel-2 active:scale-95">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="size-6" aria-hidden>
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>
      </div>
    </div>
  );
}
