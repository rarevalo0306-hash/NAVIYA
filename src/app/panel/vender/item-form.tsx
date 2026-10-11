"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import type { Kind, PriceMode } from "@/lib/catalog";
import { shrinkImage } from "@/lib/shrink-image";
import { createClient } from "@/lib/supabase/client";
import { startRecording, type RecorderHandle } from "@/lib/voice-recorder";
import { cleanBackground, deleteItem, preparePhoto, saveItem, writeDescription } from "./actions";

// Formulario de un producto o servicio, con las ayudas de Nuna: arreglar la foto, quitar el fondo y
// escribir la descripción (por texto o por voz). Nada sale en la página hasta que el dueño guarda.

type Photo = { path: string; url: string };
type Version = "fixed" | "clean" | "original";
export type FormItem = {
  id: string | null;
  kind: Kind;
  name: string;
  priceMode: PriceMode;
  price: string;
  description: string;
  category: string;
  variants: string;
  active: boolean;
  imagePath: string | null;
  originalPath: string | null;
  imageUrl: string | null;
  originalUrl: string | null;
};

const publicUrl = (path: string) => `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/brand-assets/${path}`;
const VERSION_LABEL: Record<Version, string> = { fixed: "Arreglada", clean: "Sin fondo", original: "Original" };
const MODES: [PriceMode, string][] = [
  ["fixed", "Precio fijo"],
  ["from", "Desde"],
  ["quote", "A cotizar"],
];

export function ItemForm(props: {
  businessId: string;
  currency: string;
  both: boolean;
  canRemoveBackground: boolean;
  voice: boolean;
  categories: string[];
  item: FormItem;
}) {
  const { item } = props;
  const router = useRouter();
  const [kind, setKind] = useState<Kind>(item.kind);
  const [name, setName] = useState(item.name);
  const [priceMode, setPriceMode] = useState<PriceMode>(item.priceMode);
  const [price, setPrice] = useState(item.price);
  const [description, setDescription] = useState(item.description);
  const [category, setCategory] = useState(item.category);
  const [variants, setVariants] = useState(item.variants);
  const [active, setActive] = useState(item.active);

  // Fotos: la original y las versiones que Nuna preparó; el dueño elige cuál usar.
  const [original, setOriginal] = useState<Photo | null>(item.originalPath && item.originalUrl ? { path: item.originalPath, url: item.originalUrl } : null);
  const [versions, setVersions] = useState<Partial<Record<Version, Photo>>>(
    item.imagePath && item.imageUrl && item.imagePath !== item.originalPath ? { fixed: { path: item.imagePath, url: item.imageUrl } } : {},
  );
  const [chosen, setChosen] = useState<Version | null>(item.imagePath ? (item.imagePath === item.originalPath ? "original" : "fixed") : null);
  const [photoBusy, setPhotoBusy] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const created = useRef<string[]>([]); // fotos subidas en esta pantalla (las que no se usen se borran al guardar)

  const [helper, setHelper] = useState<string | null>(null); // "Nuna está escribiendo…", "Te escucho…"
  const [question, setQuestion] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const recorder = useRef<RecorderHandle | null>(null);
  const [recording, setRecording] = useState(false);

  const photo = chosen === "original" ? original : chosen ? versions[chosen] ?? null : null;

  async function pickPhoto(file: File) {
    if (!file.type.startsWith("image/")) return setError("Sube una foto (JPG o PNG).");
    setError(null);
    setPhotoBusy("Subiendo tu foto…");
    try {
      const blob = await shrinkImage(file, 2400);
      const path = `${props.businessId}/productos/original-${crypto.randomUUID()}.jpg`;
      const { error: upErr } = await createClient().storage.from("brand-assets").upload(path, blob, { contentType: "image/jpeg" });
      if (upErr) throw new Error("No se pudo subir la foto.");
      created.current.push(path);
      setOriginal({ path, url: publicUrl(path) });
      setVersions({});
      setChosen("original");
      setPhotoBusy("Nuna está arreglando tu foto…");
      const fixed = await preparePhoto(path);
      if ("error" in fixed) throw new Error(fixed.error);
      created.current.push(fixed.path);
      setVersions({ fixed });
      setChosen("fixed");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo subir la foto.");
    } finally {
      setPhotoBusy(null);
    }
  }

  async function removeBg() {
    if (!original) return;
    setError(null);
    setPhotoBusy("Nuna está quitando el fondo…");
    const clean = await cleanBackground(original.path);
    setPhotoBusy(null);
    if ("error" in clean) return setError(clean.error);
    created.current.push(clean.path);
    setVersions((v) => ({ ...v, clean }));
    setChosen("clean");
  }

  async function nunaWrite(notes: string) {
    setError(null);
    setQuestion(null);
    setHelper("Nuna está escribiendo…");
    const r = await writeDescription({ kind, name, notes, photoPath: photo?.path ?? original?.path ?? null });
    setHelper(null);
    if ("error" in r) return setError(r.error);
    setDescription(r.description);
    if (!name.trim() && r.name) setName(r.name);
    if (!category.trim() && r.category) setCategory(r.category);
    setQuestion(r.question);
  }

  // Dictar: graba hasta que el dueño deja de hablar, lo pasa a texto y Nuna escribe la descripción.
  async function dictate() {
    if (recorder.current) return recorder.current.stop();
    setError(null);
    try {
      const handle = await startRecording({ audioContext: new AudioContext(), silenceMs: 2000, noSpeechMs: 12_000 });
      recorder.current = handle;
      setRecording(true);
      setHelper("Te escucho… cuéntame de tu producto. Cuando termines, haz una pausa.");
      const rec = await handle.done;
      recorder.current = null;
      setRecording(false);
      if (!rec?.spoke) return setHelper(null);
      setHelper("Escribiendo lo que dijiste…");
      const body = new FormData();
      body.append("audio", rec.blob);
      const res = await fetch("/api/voz/escuchar", { method: "POST", body });
      const json = (await res.json().catch(() => ({}))) as { text?: string; error?: string };
      setHelper(null);
      if (!res.ok || !json.text?.trim()) return setError(json.error ?? "No te entendí bien. Intenta de nuevo.");
      await nunaWrite(json.text);
    } catch {
      recorder.current = null;
      setRecording(false);
      setHelper(null);
      setError("Para dictar, permite el micrófono en tu navegador.");
    }
  }

  async function save() {
    setSaving(true);
    setError(null);
    const r = await saveItem({
      id: item.id,
      kind,
      name,
      priceMode,
      price,
      description,
      category,
      variants: kind === "product" ? variants : "",
      active,
      imagePath: photo?.path ?? null,
      originalPath: original?.path ?? null,
      discard: created.current.filter((p) => p !== photo?.path && p !== original?.path),
    });
    setSaving(false);
    if ("error" in r) return setError(r.error);
    router.push("/panel/vender");
    router.refresh();
  }

  async function remove() {
    if (!item.id || !confirm(`¿Borrar «${item.name}»? Ya no saldrá en tu página.`)) return;
    await deleteItem(item.id);
    router.push("/panel/vender");
    router.refresh();
  }

  const busy = Boolean(photoBusy || helper || saving || recording);
  const field = "min-h-12 w-full rounded-2xl border border-line bg-ink px-4 text-[16px] outline-none transition focus:border-lime/60";
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
      className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]"
    >
      {/* Foto */}
      <section className="flex flex-col gap-3" aria-label="Foto">
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) void pickPhoto(f);
          }}
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={busy}
          className="relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-[28px] border border-dashed border-line bg-panel text-muted transition hover:border-lime/50"
        >
          {photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photo.url} alt="Foto del producto" className="size-full object-cover" />
          ) : (
            <span className="flex flex-col items-center gap-2 p-6 text-center">
              <span className="text-4xl" aria-hidden>
                +
              </span>
              Toma o sube una foto. Nuna la arregla.
            </span>
          )}
          {photoBusy && (
            <span className="absolute inset-0 flex items-center justify-center gap-2 bg-black/60 font-semibold text-bone">
              <span aria-hidden className="size-5 rounded-full border-2 border-bone/30 border-t-bone motion-safe:animate-spin" />
              {photoBusy}
            </span>
          )}
        </button>
        {original && (
          <div className="flex flex-wrap items-center gap-2">
            {(["fixed", "clean", "original"] as Version[])
              .filter((v) => (v === "original" ? true : Boolean(versions[v])))
              .map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setChosen(v)}
                  aria-pressed={chosen === v}
                  className={`min-h-10 rounded-full px-4 text-sm font-semibold transition ${chosen === v ? "bg-lime text-lime-ink" : "bg-panel text-muted hover:text-bone"}`}
                >
                  {VERSION_LABEL[v]}
                </button>
              ))}
            {props.canRemoveBackground && !versions.clean && (
              <button type="button" onClick={removeBg} disabled={busy} className="min-h-10 rounded-full border border-line px-4 text-sm font-semibold transition hover:bg-panel disabled:opacity-50">
                Quitar fondo
              </button>
            )}
            <button type="button" onClick={() => fileRef.current?.click()} disabled={busy} className="min-h-10 px-2 text-sm text-muted underline underline-offset-4">
              Cambiar foto
            </button>
          </div>
        )}
      </section>

      {/* Datos */}
      <section className="flex flex-col gap-5" aria-label="Datos">
        {props.both && (
          <div className="flex gap-2" role="radiogroup" aria-label="Tipo">
            {(["product", "service"] as Kind[]).map((k) => (
              <button
                key={k}
                type="button"
                role="radio"
                aria-checked={kind === k}
                onClick={() => setKind(k)}
                className={`min-h-11 rounded-full px-5 text-sm font-semibold transition ${kind === k ? "bg-lime text-lime-ink" : "bg-panel text-muted"}`}
              >
                {k === "product" ? "Producto" : "Servicio"}
              </button>
            ))}
          </div>
        )}

        <label className="flex flex-col gap-2 font-semibold">
          Nombre
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} required placeholder={kind === "product" ? "Ej.: Pastel de 3 leches" : "Ej.: Reparación de goteras"} className={field} />
        </label>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 font-semibold">Precio</legend>
          <div className="flex flex-wrap gap-2">
            {MODES.map(([m, label]) => (
              <button
                key={m}
                type="button"
                aria-pressed={priceMode === m}
                onClick={() => setPriceMode(m)}
                className={`min-h-10 rounded-full px-4 text-sm font-semibold transition ${priceMode === m ? "bg-lime text-lime-ink" : "bg-panel text-muted"}`}
              >
                {label}
              </button>
            ))}
          </div>
          {priceMode !== "quote" && (
            <label className="flex items-center gap-3 text-muted">
              <span className="sr-only">Precio</span>
              <input value={price} onChange={(e) => setPrice(e.target.value)} inputMode="decimal" placeholder="0.00" className={`${field} max-w-48`} />
              <span>{props.currency}</span>
            </label>
          )}
        </fieldset>

        <div className="flex flex-col gap-2">
          <label htmlFor="descripcion" className="font-semibold">
            Descripción
          </label>
          <textarea
            id="descripcion"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={1500}
            rows={5}
            placeholder="Escribe unas palabras (o nada si subiste foto) y Nuna te la escribe."
            className="w-full rounded-2xl border border-line bg-ink p-4 text-[16px] leading-relaxed outline-none transition focus:border-lime/60"
          />
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => nunaWrite(description || name)}
              disabled={busy || (!description.trim() && !name.trim() && !photo)}
              className="min-h-10 rounded-full bg-lime/15 px-4 text-sm font-semibold text-lime transition hover:bg-lime/25 disabled:opacity-50"
            >
              {description.trim() ? "Mejorar con Nuna" : "Escríbelo con Nuna"}
            </button>
            {props.voice && (
              <button
                type="button"
                onClick={dictate}
                disabled={Boolean(photoBusy || saving) || (Boolean(helper) && !recording)}
                aria-label={recording ? "Terminé de hablar" : "Dictarle a Nuna"}
                className={`min-h-10 rounded-full px-4 text-sm font-semibold transition disabled:opacity-50 ${recording ? "bg-red-500 text-white" : "border border-line hover:bg-panel"}`}
              >
                {recording ? "■ Terminé" : "🎙 Dictarle a Nuna"}
              </button>
            )}
          </div>
          {helper && (
            <p role="status" className="text-sm text-muted">
              {helper}
            </p>
          )}
          {question && (
            <p className="rounded-2xl bg-panel px-4 py-3 text-sm">
              <span className="font-semibold text-lime">Nuna pregunta:</span> {question}
            </p>
          )}
        </div>

        <label className="flex flex-col gap-2 font-semibold">
          Categoría <span className="text-sm font-normal text-muted">Para agrupar en tu página (opcional)</span>
          <input value={category} onChange={(e) => setCategory(e.target.value)} maxLength={60} list="categorias" placeholder="Ej.: Pasteles" className={field} />
          <datalist id="categorias">
            {props.categories.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </label>

        {kind === "product" && (
          <label className="flex flex-col gap-2 font-semibold">
            Variantes <span className="text-sm font-normal text-muted">Una por renglón, por ejemplo «Talla: S, M, L» o «Sabor: chocolate, vainilla» (opcional)</span>
            <textarea value={variants} onChange={(e) => setVariants(e.target.value)} rows={2} className="w-full rounded-2xl border border-line bg-ink p-4 text-[16px] outline-none transition focus:border-lime/60" />
          </label>
        )}

        <label className="flex items-center gap-3 font-semibold">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="size-5 accent-lime" />
          Mostrar en mi página
        </label>

        {error && (
          <p role="alert" className="text-sm text-red-300">
            {error}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" disabled={busy} className="min-h-12 rounded-full bg-lime px-8 font-semibold text-lime-ink transition active:scale-[0.98] disabled:opacity-50">
            {saving ? "Guardando…" : "Guardar"}
          </button>
          {item.id && (
            <button type="button" onClick={remove} disabled={busy} className="min-h-12 px-4 text-sm text-muted underline underline-offset-4 hover:text-red-300">
              Borrar
            </button>
          )}
        </div>
      </section>
    </form>
  );
}
