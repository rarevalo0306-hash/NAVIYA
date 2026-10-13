"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Menú del panel. Mientras el dueño no termina el alta, "Clientes" no aparece y hay un atajo para volver.
export function PanelNav({ sitePath, done }: { sitePath: string | null; done: boolean }) {
  const path = usePathname();
  const items = [
    ...(done ? [{ href: "/panel", label: "Clientes" }] : [{ href: "/onboarding", label: "← Volver al alta" }]),
    { href: "/panel/mensajes", label: "Mensajes" },
    { href: "/panel/pedidos", label: "Pedidos" },
    { href: "/panel/agenda", label: "Agenda" },
    { href: "/panel/vender", label: "Lo que vendes" },
    { href: sitePath ?? "/onboarding/web", label: "Mi página", external: Boolean(sitePath) },
    { href: "/onboarding/marca", label: "Mi marca" },
    { href: "/onboarding/entrevista", label: "Ajustar mi negocio" },
  ];
  const active = (href: string) => (href === "/panel" ? path === "/panel" : path?.startsWith(href));
  return (
    <nav aria-label="Panel" className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:px-0">
      <ul className="flex w-max gap-2">
        {items.map((i) => (
          <li key={i.label}>
            <Link
              href={i.href}
              target={i.external ? "_blank" : undefined}
              aria-current={active(i.href) ? "page" : undefined}
              className={`flex min-h-11 items-center rounded-full px-4 text-sm font-semibold transition ${
                active(i.href) ? "bg-lime text-lime-ink" : "bg-panel text-muted hover:text-bone"
              }`}
            >
              {i.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
