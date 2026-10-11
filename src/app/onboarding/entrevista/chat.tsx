"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { Fish } from "@/components/fish";
import { canSpeak, pickVoice, recognitionClass, sentences, speakable, type Recognition } from "@/lib/voice";
import { GeminiVoice } from "@/lib/voice-gemini";
import { canRealtime, RealtimeVoice } from "@/lib/voice-realtime";
import { canRecord, startRecording, type RecorderHandle } from "@/lib/voice-recorder";
import { answerInterview, startGeminiVoice, voiceLog, voiceSave } from "./actions";

type Message = { id: string; role: string; content: string; step_key?: string | null };

const VOICE_KEY = "orbusiness:voz-entrevista";

function MicIcon({ className = "size-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <rect x="9" y="2" width="6" height="12" rx="3" />
      <path d="M5 10a7 7 0 0 0 14 0M12 17v5" />
    </svg>
  );
}

// Nuna "escribe" sus mensajes nuevos letra por letra (unos 2 segundos, sin importar el largo).
function TypeText({ text, animate, onTick }: { text: string; animate: boolean; onTick?: () => void }) {
  const [shown, setShown] = useState(animate ? 0 : text.length);
  useEffect(() => {
    if (!animate || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setShown(text.length); // eslint-disable-line react-hooks/set-state-in-effect -- sin animación: todo de una vez
      return;
    }
    const step = Math.max(1, Math.ceil(text.length / 110));
    const timer = setInterval(() => {
      setShown((n) => {
        if (n + step >= text.length) clearInterval(timer);
        return Math.min(text.length, n + step);
      });
      onTick?.();
    }, 20);
    return () => clearInterval(timer);
  }, [text, animate, onTick]);
  if (shown >= text.length) return <>{text}</>;
  return (
    <>
      <span aria-hidden>
        {text.slice(0, shown)}
        <span className="ml-0.5 inline-block h-[1em] w-[2px] translate-y-[2px] bg-lime motion-safe:animate-pulse" />
      </span>
      <span className="sr-only">{text}</span>
    </>
  );
}

// Voz de la entrevista. "Conversar por voz" usa la voz en tiempo real de OpenAI (realtime): Nuna
// habla con voz natural y escucha continuamente. Si no se puede, usa la voz con IA por partes
// (aiVoice: audio + grabación) y, sin IA, la voz y el reconocimiento del navegador.
export function InterviewChat({
  messages,
  open,
  lang = "es-MX",
  aiVoice = false,
  realtime = false,
  ownerName = null,
  nextHref = null,
  gemini = false,
}: {
  messages: Message[];
  open: boolean;
  lang?: string;
  aiVoice?: boolean;
  realtime?: boolean;
  ownerName?: string | null;
  nextHref?: string | null; // a dónde pasar solo cuando Nuna cierra la entrevista
  gemini?: boolean; // la plática por voz la lleva Gemini Live (escucha, piensa y habla)
}) {
  const router = useRouter();
  const [draft, setDraft] = useState("");
  const [pending, startTransition] = useTransition();
  const listRef = useRef<HTMLDivElement>(null);

  const [support, setSupport] = useState({ listen: false, speak: false });
  const [voiceMode, setVoiceMode] = useState(false);
  const [listening, setListening] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [level, setLevel] = useState(0);
  const [hint, setHint] = useState<string | null>(null);

  const voiceModeRef = useRef(false);
  const recRef = useRef<Recognition | null>(null); // reconocimiento del navegador
  const recorderRef = useRef<RecorderHandle | null>(null); // grabadora (IA)
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const queueRef = useRef<Message[]>([]);
  const afterSpeakRef = useRef<(() => void) | null>(null);
  const useAi = useRef(aiVoice);
  const rtRef = useRef<RealtimeVoice | null>(null); // conversación en tiempo real
  const geminiRef = useRef<GeminiVoice | null>(null); // conversación con Gemini Live
  const [live, setLive] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const pendingRef = useRef(false);
  const leaveRef = useRef<(() => void) | null>(null); // pasar al siguiente paso cuando Nuna termine de hablar
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const lastNuna = messages.filter((m) => m.role !== "owner").at(-1)?.id ?? null;
  const spokenRef = useRef<string | null>(lastNuna); // lo que ya estaba al abrir no se vuelve a leer
  // Mensajes que ya estaban al abrir (no se animan). Si la plática apenas empieza (primera vez o
  // "Empezar de nuevo"), el saludo de Nuna sí se escribe en vivo.
  const [seen] = useState(() => new Set(messages.some((m) => m.role === "owner") ? messages.map((m) => m.id) : []));
  const scrollDown = useCallback(() => listRef.current?.scrollTo({ top: listRef.current.scrollHeight }), []);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
    pendingRef.current = pending;
  }, [messages.length, pending]);

  const send = useCallback(
    (text: string) => {
      if (!text.trim() || pending) return;
      setDraft("");
      startTransition(() => answerInterview(text));
    },
    [pending],
  );

  // Audio y micrófono se "despiertan" con un toque del dueño (requisito de los navegadores, sobre todo iPhone).
  function unlockAudio() {
    if (!audioRef.current) {
      audioRef.current = new Audio();
      audioRef.current.preload = "auto";
    }
    if (!audioCtxRef.current && typeof AudioContext !== "undefined") {
      try {
        audioCtxRef.current = new AudioContext();
      } catch {}
    }
    audioCtxRef.current?.resume().catch(() => {});
  }

  const stopAll = useCallback(() => {
    rtRef.current?.close();
    rtRef.current = null;
    geminiRef.current?.close();
    geminiRef.current = null;
    setLive(false);
    recRef.current?.abort();
    recRef.current = null;
    recorderRef.current?.cancel();
    recorderRef.current = null;
    queueRef.current = [];
    afterSpeakRef.current = null;
    audioRef.current?.pause();
    if (canSpeak()) window.speechSynthesis.cancel();
    setListening(false);
    setSpeaking(false);
    setLevel(0);
  }, []);

  // ---------- Escuchar ----------

  const listenBrowser = useCallback(
    (autoSend: boolean) => {
      const Rec = recognitionClass();
      if (!Rec || recRef.current) return;
      const rec = new Rec();
      rec.lang = lang;
      rec.interimResults = true;
      rec.continuous = false;
      rec.maxAlternatives = 1;
      const base = autoSend ? "" : draft.trim();
      let heard = "";
      rec.onresult = (e) => {
        let text = "";
        for (let i = 0; i < e.results.length; i++) text += e.results[i][0].transcript;
        heard = text.trim();
        setDraft([base, heard].filter(Boolean).join(" "));
      };
      rec.onerror = (e) => {
        if (e.error === "not-allowed" || e.error === "service-not-allowed") {
          setHint("Para hablar, permite el uso del micrófono en tu navegador (el ícono junto a la dirección de la página).");
          voiceModeRef.current = false;
          setVoiceMode(false);
        } else if (e.error === "no-speech") setHint("No te escuché. Toca el micrófono y habla cuando se ponga rojo.");
        else if (e.error !== "aborted") setHint("No pude usar el micrófono. Puedes escribir tu respuesta.");
      };
      rec.onend = () => {
        recRef.current = null;
        setListening(false);
        if (autoSend && heard) send(heard);
      };
      try {
        rec.start();
        recRef.current = rec;
        setListening(true);
        setHint(null);
      } catch {
        setHint("Toca el micrófono para responder.");
      }
    },
    [draft, lang, send],
  );

  const listenAi = useCallback(
    async (autoSend: boolean) => {
      if (recorderRef.current) return;
      let handle: RecorderHandle;
      try {
        handle = await startRecording({
          audioContext: audioCtxRef.current,
          silenceMs: autoSend ? 1500 : 2500,
          onLevel: setLevel,
        });
      } catch {
        setHint("Para hablar, permite el uso del micrófono en tu navegador (el ícono junto a la dirección de la página).");
        voiceModeRef.current = false;
        setVoiceMode(false);
        return;
      }
      recorderRef.current = handle;
      setListening(true);
      setHint(audioCtxRef.current?.state === "running" ? null : "Toca el micrófono cuando termines de hablar.");
      const rec = await handle.done;
      recorderRef.current = null;
      setListening(false);
      setLevel(0);
      if (!rec) return;
      if (!rec.spoke) {
        setHint("No te escuché. Toca el micrófono y habla cuando se ponga rojo.");
        return;
      }
      setTranscribing(true);
      try {
        const body = new FormData();
        body.append("audio", rec.blob);
        const res = await fetch("/api/voz/escuchar", { method: "POST", body });
        const json = (await res.json().catch(() => ({}))) as { text?: string; error?: string };
        const text = json.text?.trim() ?? "";
        if (!res.ok) setHint(json.error ?? "No pude entender el audio. Intenta de nuevo o escribe tu respuesta.");
        else if (!text) setHint("No te entendí bien. Intenta de nuevo, un poco más cerca del teléfono.");
        else if (autoSend) send(text);
        else setDraft((d) => [d.trim(), text].filter(Boolean).join(" "));
      } catch {
        setHint("Se cortó la conexión. Intenta de nuevo o escribe tu respuesta.");
      } finally {
        setTranscribing(false);
      }
    },
    [send],
  );

  const listen = useCallback(
    (autoSend: boolean) => {
      if (canSpeak()) window.speechSynthesis.cancel();
      audioRef.current?.pause();
      setSpeaking(false);
      if (useAi.current && canRecord()) void listenAi(autoSend);
      else listenBrowser(autoSend);
    },
    [listenAi, listenBrowser],
  );

  // ---------- Hablar ----------

  const speakBrowser = useCallback(
    (text: string, then: () => void) => {
      if (!canSpeak()) return then();
      const synth = window.speechSynthesis;
      synth.cancel();
      const parts = sentences(speakable(text));
      if (!parts.length) return then();
      const voice = pickVoice(lang);
      setSpeaking(true);
      // Seguro: si la voz del navegador se traba (pasa en Chrome), se sigue igual al tiempo estimado.
      let finished = false;
      const finish = () => {
        if (finished) return;
        finished = true;
        clearTimeout(watchdog);
        setSpeaking(false);
        then();
      };
      const watchdog = setTimeout(() => {
        synth.cancel();
        finish();
      }, 4000 + parts.join(" ").length * 90);
      parts.forEach((part, i) => {
        const u = new SpeechSynthesisUtterance(part);
        u.lang = voice?.lang ?? lang;
        if (voice) u.voice = voice;
        u.rate = 1.03;
        if (i === parts.length - 1) {
          u.onend = finish;
          u.onerror = finish;
        }
        synth.speak(u);
      });
    },
    [lang],
  );

  // Con IA: cada mensaje de Nuna se pide como audio (/api/voz/hablar) y se reproduce en orden.
  const playNextRef = useRef<() => void>(() => {});
  useEffect(() => {
    const playNext = () => {
      const audio = audioRef.current;
      const next = queueRef.current.shift();
      if (!next) {
        setSpeaking(false);
        const then = afterSpeakRef.current;
        afterSpeakRef.current = null;
        then?.();
        return;
      }
      if (!audio) return speakBrowser(next.content, playNext);
      setSpeaking(true);
      // Si falla la voz con IA, se usa la del navegador (una sola vez, aunque fallen las dos señales).
      let fellBack = false;
      const fallback = () => {
        if (fellBack) return;
        fellBack = true;
        audio.onended = null;
        audio.onerror = null;
        speakBrowser(next.content, playNext);
      };
      audio.onended = () => playNext();
      audio.onerror = fallback;
      audio.src = `/api/voz/hablar?m=${encodeURIComponent(next.id)}`;
      audio.play().catch((e: unknown) => {
        if (!(e instanceof DOMException && e.name === "AbortError")) fallback();
      });
    };
    playNextRef.current = playNext;
  }, [speakBrowser]);

  const speak = useCallback(
    (list: Message[], then: () => void) => {
      if (!list.length) return then();
      if (useAi.current) {
        audioRef.current?.pause();
        queueRef.current = [...list];
        afterSpeakRef.current = then;
        playNextRef.current();
      } else {
        speakBrowser(list.map((m) => m.content).join(" "), then);
      }
    },
    [speakBrowser],
  );

  // ---------- Montaje y mensajes nuevos ----------

  useEffect(() => {
    const listenOk = aiVoice ? canRecord() || Boolean(recognitionClass()) : Boolean(recognitionClass());
    const speakOk = aiVoice || canSpeak();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- depende del navegador, solo se sabe ya montado
    setSupport({ listen: listenOk, speak: speakOk });
    if (canSpeak()) window.speechSynthesis.getVoices(); // algunos navegadores cargan las voces tarde
    let saved = false;
    try {
      saved = localStorage.getItem(VOICE_KEY) === "1";
    } catch {}
    if (saved && listenOk && speakOk && !(realtime && canRealtime())) {
      voiceModeRef.current = true;
      setVoiceMode(true);
    }
    return () => {
      recRef.current?.abort();
      recorderRef.current?.cancel();
      audioRef.current?.pause();
      if (canSpeak()) window.speechSynthesis.cancel();
      void audioCtxRef.current?.close().catch(() => {});
      rtRef.current?.close();
      geminiRef.current?.close();
      if (leaveTimer.current) clearTimeout(leaveTimer.current);
    };
  }, [aiVoice, realtime]);

  // Llegó un mensaje nuevo de Nuna: en modo voz lo lee y después escucha la respuesta.
  useEffect(() => {
    if (!lastNuna || lastNuna === spokenRef.current) return;
    const from = messages.findIndex((m) => m.id === spokenRef.current);
    spokenRef.current = lastNuna;
    if (geminiRef.current) return; // con Gemini, lo que dice ya sonó: el mensaje solo deja la plática escrita
    const fresh = messages.slice(from + 1).filter((m) => m.role !== "owner");
    // Nuna cerró la entrevista: cuando termine de despedirse, se pasa solo al siguiente paso.
    const leave = nextHref && fresh.some((m) => m.step_key === "done") ? () => (stopAll(), router.push(nextHref)) : null;
    if (!voiceModeRef.current) {
      if (leave) leaveTimer.current = setTimeout(leave, 9000); // tiempo para leer la despedida
      return;
    }
    if (rtRef.current) {
      // En tiempo real Nuna lee y luego sigue escuchando sola.
      leaveRef.current = leave;
      for (const m of fresh) rtRef.current.speak(m.content);
      return;
    }
    speak(fresh, () => {
      if (leave) leave();
      else if (voiceModeRef.current && open) listen(true);
    });
  }, [lastNuna, messages, open, speak, listen, nextHref, router, stopAll]);

  function toggleVoiceMode() {
    const next = !voiceMode;
    voiceModeRef.current = next;
    setVoiceMode(next);
    setHint(null);
    try {
      localStorage.setItem(VOICE_KEY, next ? "1" : "0");
    } catch {}
    if (!next) return stopAll();
    unlockAudio();
    const last = messages.filter((m) => m.role !== "owner").at(-1);
    // Al conectarse saluda primero; si ya iban a media plática, retoma donde iban.
    const started = messages.some((m) => m.role === "owner");
    const first = ownerName?.split(/\s+/)[0];
    const firstText = last ? (started ? `¡Hola${first ? `, ${first}` : ""}! Qué gusto escucharte. Seguimos donde íbamos: ${last.content}` : last.content) : null;
    if (gemini && canRealtime()) return void startGemini(firstText);
    if (realtime && canRealtime()) return void startRealtime(firstText);
    const then = () => {
      if (voiceModeRef.current && open) listen(true);
    };
    if (last) speak([last], then);
    else then();
  }

  // Conversación en tiempo real: conecta, lee la última pregunta y escucha. Si falla, usa la voz por partes.
  async function startRealtime(firstText: string | null) {
    setConnecting(true);
    const rt = new RealtimeVoice({
      onSpeaking: (on) => {
        setSpeaking(on);
        const leave = leaveRef.current;
        if (!on && leave) {
          leaveRef.current = null;
          leave();
        }
      },
      onListening: setListening,
      onTranscript: (text) => {
        if (!voiceModeRef.current) return;
        if (pendingRef.current) {
          setHint("Espera a que Nuna termine de anotar tu respuesta anterior.");
          return;
        }
        setHint(null);
        send(text);
      },
      onClosed: (reason) => {
        if (rtRef.current !== rt) return;
        rtRef.current = null;
        setLive(false);
        if (reason !== "close_requested" && voiceModeRef.current) {
          voiceModeRef.current = false;
          setVoiceMode(false);
          setHint("Se cortó la conversación por voz. Toca «Conversar por voz» para seguir.");
        }
      },
    });
    rtRef.current = rt;
    try {
      await rt.connect();
      if (rtRef.current !== rt) return rt.close();
      setLive(true);
      if (firstText) rt.speak(firstText);
    } catch (error) {
      console.error("Voz en tiempo real:", error);
      rt.close();
      rtRef.current = null;
      if (!voiceModeRef.current) return;
      const denied = error instanceof DOMException && (error.name === "NotAllowedError" || error.name === "SecurityError");
      if (denied) {
        voiceModeRef.current = false;
        setVoiceMode(false);
        setHint("Para hablar, permite el uso del micrófono en tu navegador (el ícono junto a la dirección de la página).");
        return;
      }
      // Respaldo: voz con IA por partes (o la del navegador).
      const last = messages.filter((m) => m.role !== "owner").at(-1);
      const then = () => {
        if (voiceModeRef.current && open) listen(true);
      };
      if (last) speak([last], then);
      else then();
    } finally {
      setConnecting(false);
    }
  }

  // Plática con Gemini Live: ella lleva la conversación y va anotando con sus herramientas.
  // Si no se puede conectar, sigue con la voz de OpenAI (o la del navegador).
  async function startGemini(firstText: string | null) {
    setConnecting(true);
    let keys: string[] = []; // datos anotados en este turno (para marcar qué contestó el dueño)
    let ending = false;
    const gv = new GeminiVoice({
      onSpeaking: setSpeaking,
      onListening: setListening,
      onTool: async (name, args) => {
        if (name === "terminar_entrevista") {
          ending = true;
          return { ok: true };
        }
        if (name !== "anotar") return { error: "Herramienta desconocida" };
        const r = await voiceSave(args, keys);
        keys = [...keys, ...r.filled];
        return {
          faltan: r.missing.length ? r.missing : "Nada. Pregúntale si quiere agregar algo más.",
          nota: "Si ya hiciste tu siguiente pregunta, no digas nada más; si no, sigue la plática con lo que falta.",
        };
      },
      onTurn: (owner, said) => {
        const turn = { owner, nuna: said, keys, end: ending };
        keys = [];
        void voiceLog(turn).then((r) => {
          if (r.done && geminiRef.current === gv) gv.whenQuiet(() => (stopAll(), router.push("/onboarding/marca")));
        });
      },
      onClosed: (reason) => {
        if (geminiRef.current !== gv) return;
        geminiRef.current = null;
        setLive(false);
        setSpeaking(false);
        if (reason !== "close_requested" && voiceModeRef.current) {
          voiceModeRef.current = false;
          setVoiceMode(false);
          setHint("Se cortó la conversación por voz. Toca «Conversar por voz» para seguir.");
        }
      },
    });
    geminiRef.current = gv;
    try {
      const session = await startGeminiVoice();
      if ("error" in session) throw new Error(session.error);
      await gv.connect(session.token, session.model, "hola");
      if (geminiRef.current !== gv) return gv.close();
      setLive(true);
    } catch (error) {
      console.error("Voz con Gemini:", error);
      if (geminiRef.current === gv) geminiRef.current = null;
      gv.close();
      if (!voiceModeRef.current) return;
      if (error instanceof DOMException && (error.name === "NotAllowedError" || error.name === "SecurityError")) {
        voiceModeRef.current = false;
        setVoiceMode(false);
        setHint("Para hablar, permite el uso del micrófono en tu navegador (el ícono junto a la dirección de la página).");
        return;
      }
      if (realtime) return void startRealtime(firstText);
      const last = messages.filter((m) => m.role !== "owner").at(-1);
      if (last) speak([last], () => voiceModeRef.current && open && listen(true));
    } finally {
      setConnecting(false);
    }
  }

  function onMic() {
    if (listening) {
      recorderRef.current?.stop();
      recRef.current?.stop();
      return;
    }
    unlockAudio();
    setHint(null);
    listen(voiceMode);
  }

  const voiceReady = support.listen && support.speak;
  const busy = connecting || pending || transcribing;
  const title = connecting
    ? "Conectando…"
    : speaking
      ? "Nuna está hablando"
      : pending || transcribing
        ? "Nuna está anotando…"
        : listening
          ? "Te escucho"
          : "Tu turno";
  const status = speaking
    ? "Escucha la pregunta. Luego contesta hablando."
    : busy
      ? "Un momento…"
      : "Habla cuando quieras. Al terminar, haz una pausa.";

  function hush() {
    rtRef.current?.stopSpeaking();
    geminiRef.current?.stopSpeaking();
    queueRef.current = [];
    afterSpeakRef.current = null;
    audioRef.current?.pause();
    if (canSpeak()) window.speechSynthesis.cancel();
    setSpeaking(false);
  }

  return (
    <div className="flex flex-col gap-3">
      <div
        ref={listRef}
        aria-live="polite"
        className="flex h-[28rem] flex-col gap-5 overflow-y-auto rounded-[28px] border border-white/[0.06] bg-panel p-5 sm:h-[32rem] sm:p-7"
      >
        {messages.map((m) =>
          m.role === "owner" ? (
            <p key={m.id} className="max-w-[80%] self-end rounded-[22px] rounded-br-md bg-lime px-4 py-2.5 font-medium text-lime-ink">
              {m.content}
            </p>
          ) : (
            <div key={m.id} className="flex max-w-[90%] gap-3">
              <Fish size={26} className="mt-0.5 shrink-0 text-lime" />
              <p className="text-[17px] leading-relaxed">
                <TypeText text={m.content} animate={!seen.has(m.id)} onTick={scrollDown} />
              </p>
            </div>
          ),
        )}
        {pending && (
          <div className="flex gap-3 text-muted">
            <Fish size={26} className="shrink-0 text-lime" />
            <span>Nuna está escribiendo…</span>
          </div>
        )}
      </div>

      {open && voiceReady && !voiceMode && (
        <button
          type="button"
          onClick={toggleVoiceMode}
          className="flex w-full items-center gap-4 rounded-[24px] border border-lime/40 bg-lime/10 p-4 text-left transition hover:bg-lime/15 active:scale-[0.99] sm:p-5"
        >
          <span className="relative flex size-14 shrink-0 items-center justify-center rounded-full bg-lime text-lime-ink">
            <span aria-hidden className="absolute inset-0 rounded-full bg-lime/40 motion-safe:animate-ping [animation-duration:2.5s]" />
            <MicIcon className="relative size-6" />
          </span>
          <span className="flex flex-col gap-0.5">
            <span className="text-lg font-semibold">Conversar por voz con Nuna</span>
            <span className="text-sm text-muted">Ella te pregunta y tú contestas hablando, como una llamada.</span>
          </span>
        </button>
      )}

      {open && voiceMode && (
        <div className="flex flex-wrap items-center gap-4 rounded-[24px] border border-lime/40 bg-panel p-4 sm:p-5">
          {/* En tiempo real escucha sola; en el respaldo, tocar el círculo termina o empieza a escuchar. */}
          <button
            type="button"
            onClick={onMic}
            disabled={live || speaking || busy}
            aria-label={listening ? "Terminé de hablar" : "Responder hablando"}
            className={`relative flex size-14 shrink-0 items-center justify-center rounded-full transition disabled:cursor-default ${
              listening && !speaking ? "bg-red-500 text-white" : "bg-lime text-lime-ink"
            }`}
            style={listening && !speaking ? { boxShadow: `0 0 0 ${4 + level * 12}px rgb(239 68 68 / 0.25)` } : undefined}
          >
            {speaking ? (
              <span className="flex h-6 items-center gap-1">
                {[0, 1, 2, 3].map((i) => (
                  <span key={i} className="eq-bar h-full w-1.5 rounded-full bg-lime-ink" style={{ animationDelay: `${i * 0.15}s` }} />
                ))}
              </span>
            ) : busy ? (
              <span className="size-6 rounded-full border-2 border-lime-ink/30 border-t-lime-ink motion-safe:animate-spin" />
            ) : (
              <>
                {!listening && <span className="absolute inset-0 rounded-full bg-lime/40 motion-safe:animate-ping [animation-duration:2s]" />}
                <MicIcon className="relative size-6" />
              </>
            )}
          </button>
          <div className="min-w-0 flex-1" role="status">
            <p className="font-semibold">{title}</p>
            <p className="text-sm text-muted">{status}</p>
          </div>
          <div className="flex gap-2">
            {speaking && (
              <button type="button" onClick={hush} className="min-h-11 rounded-full border border-line px-4 text-sm hover:bg-panel-2">
                Callar
              </button>
            )}
            <button type="button" onClick={toggleVoiceMode} className="min-h-11 rounded-full border border-line px-4 text-sm text-muted hover:bg-panel-2 hover:text-bone">
              Terminar
            </button>
          </div>
        </div>
      )}

      {open && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            recRef.current?.abort();
            recorderRef.current?.cancel();
            send(draft);
          }}
          className="flex gap-2"
        >
          {support.listen && !voiceMode && (
            <button
              type="button"
              onClick={onMic}
              disabled={transcribing}
              aria-pressed={listening}
              aria-label={listening ? "Terminé de hablar" : "Responder hablando"}
              className={`relative flex size-14 shrink-0 items-center justify-center rounded-full border transition active:scale-95 disabled:opacity-60 ${
                listening ? "border-red-500 bg-red-500 text-white" : "border-line text-bone hover:bg-panel"
              }`}
              style={listening ? { boxShadow: `0 0 0 ${3 + level * 10}px rgb(239 68 68 / 0.25)` } : undefined}
            >
              <MicIcon />
            </button>
          )}
          <label htmlFor="answer" className="sr-only">
            Tu respuesta
          </label>
          <input
            id="answer"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            autoComplete="off"
            placeholder={
              listening ? "Te escucho…" : transcribing ? "Escribiendo lo que dijiste…" : support.listen ? "Escribe o toca el micrófono…" : "Escribe tu respuesta…"
            }
            className="min-h-14 min-w-0 flex-1 rounded-full border border-white/[0.06] bg-panel px-6 text-[17px] transition placeholder:text-muted/70 focus:border-lime/60"
          />
          <button
            type="submit"
            disabled={pending || !draft.trim()}
            aria-label="Enviar"
            className="flex size-14 shrink-0 items-center justify-center rounded-full bg-lime text-lime-ink transition hover:brightness-110 active:scale-95 disabled:opacity-40 disabled:active:scale-100"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="size-6" aria-hidden>
              <path d="M12 19V5M5 12l7-7 7 7" />
            </svg>
          </button>
        </form>
      )}
      {hint && (
        <p role="alert" className="text-sm text-muted">
          {hint}
        </p>
      )}
    </div>
  );
}
