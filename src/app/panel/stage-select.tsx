"use client";

import { useTransition } from "react";
import { moveContact } from "./actions";

// Cambiar de etapa con un toque (a cualquiera, no solo a la siguiente).
export function StageSelect({ contactId, stageId, stages }: { contactId: string; stageId: string; stages: { id: string; name: string }[] }) {
  const [pending, start] = useTransition();
  return (
    <select
      aria-label="Etapa"
      defaultValue={stageId}
      disabled={pending}
      onChange={(e) => start(() => moveContact(contactId, e.target.value))}
      className="min-h-10 w-full rounded-lg border border-line bg-panel px-2 text-sm disabled:opacity-50"
    >
      {stages.map((s) => (
        <option key={s.id} value={s.id}>
          {s.name}
        </option>
      ))}
    </select>
  );
}
