import type { ReactNode } from "react";
import { signOut } from "@/app/login/actions";
import { Wordmark } from "@/components/fish";
import { requireBusiness } from "@/lib/business";
import { PanelNav } from "./panel-nav";

// Panel del dueño: el mismo encabezado y menú en todas sus secciones.
export default async function PanelLayout({ children }: { children: ReactNode }) {
  const { supabase, business } = await requireBusiness();
  const { data: website } = await supabase.from("websites").select("subdomain, status").eq("business_id", business.id).maybeSingle();
  const sitePath = website?.status === "published" ? `/sitio/${website.subdomain}` : null;

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-4 py-6 sm:px-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <Wordmark />
        <form action={signOut}>
          <button className="min-h-11 text-sm text-muted underline underline-offset-4 hover:text-bone">Salir</button>
        </form>
      </header>
      <PanelNav sitePath={sitePath} done={business.onboarding_step === "done"} />
      {children}
    </div>
  );
}
