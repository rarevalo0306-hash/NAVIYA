"use client";

import { useTransition } from "react";
import { setAppointmentStatus } from "./actions";

const LABELS: Record<string, string> = { scheduled: "Agendada", done: "Atendida", no_show: "No vino", cancelled: "Cancelada" };

export function AppointmentStatus({ id, status }: { id: string; status: string }) {
  const [pending, start] = useTransition();
  return (
    <select
      aria-label="Estado de la cita"
      defaultValue={status}
      disabled={pending}
      onChange={(e) => start(() => setAppointmentStatus(id, e.target.value))}
      className={`min-h-11 rounded-full px-4 text-sm font-semibold disabled:opacity-50 ${status === "scheduled" ? "bg-lime text-lime-ink" : "bg-panel-2 text-bone"}`}
    >
      {Object.entries(LABELS).map(([k, v]) => (
        <option key={k} value={k}>
          {v}
        </option>
      ))}
    </select>
  );
}
