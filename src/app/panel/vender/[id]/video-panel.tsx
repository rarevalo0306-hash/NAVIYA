"use client";

import { useEffect, useState } from "react";
import { makeVideo, refreshVideos, type VideoRow } from "../video-actions";

const pill = (on: boolean) => `min-h-11 rounded-full px-4 text-sm font-semibold transition ${on ? "bg-lime text-lime-ink" : "bg-panel-2 text-muted"}`;

// "Video para redes": Nuna hace un video corto del producto con IA a partir de su foto.
export function VideoPanel({ serviceId, hasPhoto, left, initial }: { serviceId: string; hasPhoto: boolean; left: number; initial: VideoRow[] }) {
  const [videos, setVideos] = useState(initial);
  const [aspect, setAspect] = useState<"9:16" | "1:1">("9:16");
  const [seconds, setSeconds] = useState(5);
  const [idea, setIdea] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const generating = videos.some((v) => v.status === "generating");

  // Mientras uno se está haciendo, revisa cada 8 segundos.
  useEffect(() => {
    if (!generating) return;
    const t = setInterval(() => void refreshVideos(serviceId).then(setVideos), 8000);
    return () => clearInterval(t);
  }, [generating, serviceId]);

  async function create() {
    setPending(true);
    setError(null);
    const r = await makeVideo(serviceId, { aspect, seconds, idea }).catch(() => ({ error: "Se cortó la conexión. Intenta de nuevo." }));
    setPending(false);
    if ("error" in r) return setError(r.error);
    setIdea("");
    setVideos(await refreshVideos(serviceId));
  }

  return (
    <section className="flex flex-col gap-4 rounded-[24px] border border-white/[0.06] bg-panel p-5" aria-labelledby="video-redes">
      <div className="flex flex-col gap-1">
        <h2 id="video-redes" className="font-display text-2xl font-bold">
          Video para redes
        </h2>
        <p className="text-muted">Nuna hace un video corto de este producto con su foto, listo para Reels, TikTok o tu WhatsApp. Tarda 1 a 3 minutos.</p>
      </div>

      {!hasPhoto ? (
        <p className="text-muted">Primero ponle una foto al producto y guárdalo.</p>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-2" role="group" aria-label="Formato">
            <button type="button" aria-pressed={aspect === "9:16"} onClick={() => setAspect("9:16")} className={pill(aspect === "9:16")}>
              Vertical (Reels, TikTok)
            </button>
            <button type="button" aria-pressed={aspect === "1:1"} onClick={() => setAspect("1:1")} className={pill(aspect === "1:1")}>
              Cuadrado (publicación)
            </button>
          </div>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Duración">
            {[5, 10].map((s) => (
              <button key={s} type="button" aria-pressed={seconds === s} onClick={() => setSeconds(s)} className={pill(seconds === s)}>
                {s} segundos
              </button>
            ))}
          </div>
          <label className="flex flex-col gap-1 text-sm font-semibold text-muted">
            Idea (opcional)
            <input
              value={idea}
              onChange={(e) => setIdea(e.target.value)}
              maxLength={300}
              placeholder="Ej.: que se vea girando sobre una mesa de madera, con vapor saliendo"
              className="min-h-12 rounded-[16px] border border-line bg-ink px-4 font-normal text-bone placeholder:text-muted/70"
            />
          </label>
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" onClick={create} disabled={pending || left <= 0} className="min-h-12 rounded-full bg-lime px-6 font-semibold text-lime-ink disabled:opacity-50">
              {pending ? "Nuna está preparando tu video…" : "Hacer video con Nuna"}
            </button>
            <span className="text-sm text-muted">Te quedan {left} videos este mes.</span>
          </div>
          {error && (
            <p role="alert" className="text-sm text-[#ff8a8a]">
              {error}
            </p>
          )}
        </div>
      )}

      {videos.length > 0 && (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-live="polite">
          {videos.map((v) => (
            <li key={v.id} className="flex flex-col gap-2 rounded-[20px] bg-panel-2 p-3">
              {v.status === "ready" && v.url ? (
                <>
                  <video src={v.url} controls playsInline className={`w-full rounded-[14px] bg-ink ${v.aspect === "1:1" ? "aspect-square" : "aspect-[9/16]"} object-cover`} />
                  <div className="flex flex-wrap gap-3 text-sm font-semibold">
                    <a href={v.url} download className="text-lime underline-offset-4 hover:underline">
                      Descargar
                    </a>
                    <a href={`https://wa.me/?text=${encodeURIComponent(v.url)}`} target="_blank" rel="noopener" className="text-lime underline-offset-4 hover:underline">
                      Compartir por WhatsApp
                    </a>
                  </div>
                </>
              ) : v.status === "generating" ? (
                <div className={`flex w-full flex-col items-center justify-center gap-3 rounded-[14px] bg-ink ${v.aspect === "1:1" ? "aspect-square" : "aspect-[9/16]"}`}>
                  <span aria-hidden className="size-8 rounded-full border-2 border-lime/30 border-t-lime motion-safe:animate-spin" />
                  <span className="text-sm text-muted">Haciendo tu video…</span>
                </div>
              ) : (
                <p className="text-sm text-muted">{v.error}</p>
              )}
              <span className="text-xs text-muted">
                {v.aspect === "1:1" ? "Cuadrado" : "Vertical"} · {v.seconds} s
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
