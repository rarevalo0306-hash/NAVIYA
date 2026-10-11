"use client";

import { useActionState, useRef } from "react";
import { sendOwnerReply, type ReplyState } from "../actions";

export function ReplyForm({ id }: { id: string }) {
  const form = useRef<HTMLFormElement>(null);
  const [state, action, pending] = useActionState<ReplyState, FormData>(async (prev, data) => {
    const result = await sendOwnerReply(id, prev, data);
    if (result.ok) form.current?.reset();
    return result;
  }, {});
  return (
    <form ref={form} action={action} className="flex flex-col gap-2">
      <label htmlFor="respuesta" className="text-sm font-semibold text-muted">
        Contestar tú (Nuna deja de contestar esta plática)
      </label>
      <div className="flex items-end gap-2">
        <textarea id="respuesta" name="text" rows={2} maxLength={1600} required className="min-h-12 flex-1 rounded-[20px] border border-line bg-ink px-4 py-3 text-bone" />
        <button type="submit" disabled={pending} className="min-h-12 rounded-full bg-lime px-6 font-semibold text-lime-ink disabled:opacity-60">
          {pending ? "Enviando…" : "Enviar"}
        </button>
      </div>
      {state.error && (
        <p role="alert" className="text-sm text-[#ff8a8a]">
          {state.error}
        </p>
      )}
    </form>
  );
}
