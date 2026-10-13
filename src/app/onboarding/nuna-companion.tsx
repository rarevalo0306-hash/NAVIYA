"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { NunaMark, type NunaState } from "@/components/nuna-mark";
import { OpenAIAgentVoice } from "@/lib/voice-openai-agent";
import { askNuna, companionInstructions, companionSave, startCompanionVoice } from "./companion-actions";

// Nuna acompaña al dueño en marca, página web, CRM y activar: abajo al centro, su logo animado y una
// barra con escribir, hablar y minimizar (como un asistente flotante). Al llegar a cada paso deja un globito.

type Msg = { role: "owner" | "nuna"; text: string };
const MIN_KEY = "orbusiness:nuna-minimizada";
const POS_KEY = "orbusiness:nuna-posicion"; // dónde la dejó el dueño, en fracción de la pantalla
const TIP_KEY = (step: string) => `orbusiness:nuna-tip:${step}`;
// La entrevista por voz deja esta marca al terminar: aquí Nuna sigue hablando sin que el dueño toque nada.
export const VOICE_CONTINUES = "orbusiness:nuna-voz-sigue";
const STEP_LABEL: Record<string, string> = { marca: "Marca", web: "Página web", crm: "CRM", activar: "Activar" };
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
  const [muted, setMuted] = useState(false); // micrófono en silencio mientras platican por voz
  const [error, setError] = useState<string | null>(null);
  const voiceRef = useRef<OpenAIAgentVoice | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  // Se arrastra desde su logo a cualquier parte de la pantalla. pos = punto donde queda la barra (fracción de la pantalla).
  const [pos, setPos] = useState({ fx: 0.5, fy: 1 });
  const [screen, setScreen] = useState({ w: 0, h: 0 });
  const drag = useRef<{ sx: number; sy: number; x: number; y: number; moved: boolean } | null>(null);
  const dragged = useRef(false); // si se arrastró, el toque no abre el chat

  // Lo guardado del navegador solo se puede leer ya montado.
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- depende del navegador, solo se sabe ya montado */
    setMinimized(read(MIN_KEY) === "1");
    try {
      const saved = JSON.parse(read(POS_KEY) ?? "null") as { fx?: unknown; fy?: unknown } | null;
      if (typeof saved?.fx === "number" && typeof saved?.fy === "number") setPos({ fx: saved.fx, fy: saved.fy });
    } catch {}
    setTipShown(Boolean(tip) && read(TIP_KEY(step)) !== "1");
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [step, tip]);

  // Al salir del alta, la voz se cierra.
  useEffect(() => () => voiceRef.current?.close(), []);

  // Al cambiar de paso con la voz abierta, la plática sigue: Nuna recibe lo de la pantalla nueva y la comenta.
  // Si viene de la entrevista por voz, empieza a hablar sola.
  const lastStep = useRef(step);
  useEffect(() => {
    if (!tip || lastStep.current === step) return;
    lastStep.current = step;
    const v = voiceRef.current;
    if (v) {
      void companionInstructions(step).then((text) => {
        if (!text || voiceRef.current !== v) return;
        v.updateInstructions(text);
        v.nudge(`(El dueño pasó al paso «${STEP_LABEL[step] ?? step}». Dile en una o dos frases qué hay en esta pantalla y sigue la plática.)`);
      });
      return;
    }
    let continues = false;
    try {
      continues = sessionStorage.getItem(VOICE_CONTINUES) === "1";
      sessionStorage.removeItem(VOICE_CONTINUES);
    } catch {}
    if (continues)
      void toggleVoice(`(Acaban de terminar la entrevista por voz y el dueño llegó al paso «${STEP_LABEL[step] ?? step}». No lo saludes de nuevo: dile en una o dos frases qué hay en esta pantalla y qué le recomiendas hacer primero.)`);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo al cambiar de paso
  }, [step, tip]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages.length, open]);

  useEffect(() => {
    const measure = () => setScreen({ w: window.innerWidth, h: window.innerHeight });
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  if (!tip) return null;

  const state: NunaState = connecting || pending ? "thinking" : speaking ? "speaking" : listening && !muted ? "listening" : "idle";

  // Dónde va: sin medir la pantalla todavía, abajo al centro. Nunca se sale de la pantalla.
  const half = minimized ? 40 : open ? Math.min(224, screen.w / 2 - 8) : tipShown ? Math.min(200, screen.w / 2 - 8) : 90;
  const x = Math.min(Math.max(pos.fx * screen.w, half + 8), screen.w - half - 8);
  const y = Math.min(Math.max(pos.fy * screen.h, 80), screen.h - 12);
  const below = y < screen.h * 0.45; // en la mitad de arriba, el chat se abre hacia abajo
  const place = screen.w
    ? { left: x, top: below ? y - 60 : y, transform: below ? "translate(-50%, 0)" : "translate(-50%, -100%)" }
    : { left: "50%", bottom: 12, transform: "translateX(-50%)" };

  const dragHandlers = {
    onPointerDown: (e: React.PointerEvent) => {
      drag.current = { sx: e.clientX, sy: e.clientY, x, y, moved: false };
      e.currentTarget.setPointerCapture(e.pointerId);
    },
    onPointerMove: (e: React.PointerEvent) => {
      const d = drag.current;
      if (!d || !screen.w) return;
      const dx = e.clientX - d.sx;
      const dy = e.clientY - d.sy;
      if (!d.moved && Math.hypot(dx, dy) < 6) return;
      d.moved = true;
      setPos({ fx: (d.x + dx) / screen.w, fy: (d.y + dy) / screen.h });
    },
    onPointerUp: (e: React.PointerEvent) => {
      const d = drag.current;
      drag.current = null;
      if (!d?.moved) return;
      dragged.current = true;
      write(POS_KEY, JSON.stringify({ fx: (d.x + e.clientX - d.sx) / screen.w, fy: (d.y + e.clientY - d.sy) / screen.h }));
    },
  };
  // Un arrastre termina con un "clic": ese no cuenta.
  const tapped = () => {
    if (!dragged.current) return true;
    dragged.current = false;
    return false;
  };

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

  async function toggleVoice(greeting = "hola") {
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
      onTool: async (name, args) => (name === "anotar" ? companionSave(args) : { error: "Herramienta desconocida" }),
      onTurn: (owner, said) =>
        setMessages((m) => [...m, ...(owner ? [{ role: "owner" as const, text: owner }] : []), ...(said ? [{ role: "nuna" as const, text: said }] : [])]),
      onClosed: () => {
        if (voiceRef.current !== v) return;
        voiceRef.current = null;
        setLive(false);
        setSpeaking(false);
        setListening(false);
        setMuted(false);
      },
    });
    voiceRef.current = v;
    try {
      const s = await startCompanionVoice(step);
      if ("error" in s) throw new Error(s.error);
      await v.connect(s.key, greeting);
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
        {...dragHandlers}
        onClick={() => tapped() && minimize(false)}
        aria-label="Abrir a Nuna"
        title="Toca para abrir a Nuna; arrástrala para moverla"
        style={place}
        className="fixed z-40 touch-none rounded-full"
      >
        <NunaMark size={64} state={state} />
      </button>
    );

  return (
    <div style={place} className={`pointer-events-none fixed z-40 flex w-[min(28rem,calc(100vw-1rem))] items-center gap-2 ${below ? "flex-col-reverse" : "flex-col"}`}>
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

      <button
        type="button"
        {...dragHandlers}
        onClick={() => tapped() && openChat()}
        aria-label={open ? "Cerrar la plática con Nuna" : "Platicar con Nuna"}
        title="Toca para platicar; arrástrala para moverla a cualquier parte"
        className="pointer-events-auto -my-1 cursor-grab touch-none rounded-full active:cursor-grabbing"
      >
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
              onClick={() => void toggleVoice()}
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
        {live && (
          <>
            <span aria-hidden className="mx-1 h-7 w-px bg-line" />
            <button
              type="button"
              onClick={() => {
                voiceRef.current?.setMuted(!muted);
                setMuted(!muted);
              }}
              aria-pressed={muted}
              aria-label={muted ? "Activar mi micrófono" : "Silenciar mi micrófono"}
              title={muted ? "Activar mi micrófono" : "Silenciar mi micrófono"}
              className={`flex size-12 items-center justify-center rounded-full transition active:scale-95 ${muted ? "bg-bone text-ink" : "text-bone hover:bg-panel-2"}`}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-6" aria-hidden>
                <rect x="9" y="2" width="6" height="12" rx="3" />
                <path d="M5 10a7 7 0 0 0 14 0M12 17v5" />
                {muted && <path d="M3 3l18 18" />}
              </svg>
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
