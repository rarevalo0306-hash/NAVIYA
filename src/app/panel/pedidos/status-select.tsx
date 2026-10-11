"use client";

import { useTransition } from "react";
import { setOrderStatus } from "./actions";

const LABELS: Record<string, string> = { new: "Nuevo", confirmed: "Confirmado", paid: "Pagado", delivered: "Entregado", cancelled: "Cancelado" };

export function StatusSelect({ id, status }: { id: string; status: string }) {
  const [pending, start] = useTransition();
  return (
    <select
      aria-label="Estado del pedido"
      defaultValue={status}
      disabled={pending}
      onChange={(e) => start(() => setOrderStatus(id, e.target.value))}
      className={`min-h-11 rounded-full px-4 text-sm font-semibold disabled:opacity-50 ${status === "new" ? "bg-lime text-lime-ink" : "bg-panel-2 text-bone"}`}
    >
      {Object.entries(LABELS).map(([k, v]) => (
        <option key={k} value={k}>
          {v}
        </option>
      ))}
    </select>
  );
}
