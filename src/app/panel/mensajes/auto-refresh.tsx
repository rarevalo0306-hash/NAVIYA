"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

// Vuelve a pedir la página cada tantos segundos para ver los mensajes nuevos sin recargar.
export function AutoRefresh({ seconds = 8 }: { seconds?: number }) {
  const router = useRouter();
  useEffect(() => {
    const t = setInterval(() => document.visibilityState === "visible" && router.refresh(), seconds * 1000);
    return () => clearInterval(t);
  }, [router, seconds]);
  return null;
}
