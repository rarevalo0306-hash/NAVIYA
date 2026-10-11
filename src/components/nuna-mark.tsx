// Logo animado de Nuna: un pez dentro de un halo tecnológico que gira. `state` lo hace escuchar,
// pensar o hablar; `size` en px (se dibuja a 204 px y se escala).
export type NunaState = "idle" | "listening" | "thinking" | "speaking";

export function NunaMark({ size = 96, state = "idle" }: { size?: number; state?: NunaState }) {
  return (
    <span className="nuna-mark-box block" style={{ ["--nuna-k" as string]: size / 204 }} aria-hidden>
      <span className="nuna-mark" data-state={state}>
        <span className="nm-depth" />
        <span className="nm-pulse" />
        <span className="nm-core" />
        <span className="nm-orbit" />
        <span className="nm-scan" />
        <svg viewBox="0 0 64 32">
          <path d="M3 16C20-3 41-3 59 29M3 16C20 35 41 35 59 3" />
        </svg>
      </span>
    </span>
  );
}
