import { Wordmark } from "@/components/fish";
import { getOwnerContext } from "@/lib/business";
import { COMPANION_STEPS, STEP_GUIDE } from "@/lib/companion";
import { realtimeEnabled } from "@/lib/voice-ai";
import { signOut } from "@/app/login/actions";
import { NunaCompanion } from "./nuna-companion";
import { StepNav } from "./step-nav";

// Después de la entrevista, Nuna acompaña cada paso (marca, página web, CRM y activar).
const TIPS = Object.fromEntries(COMPANION_STEPS.map((s) => [s, STEP_GUIDE[s].tip]));

export default async function OnboardingLayout({ children }: LayoutProps<"/onboarding">) {
  const { business } = await getOwnerContext();

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-10 px-4 py-6 sm:px-8 sm:py-10">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <Wordmark />
        <form action={signOut}>
          <button className="min-h-11 text-sm text-muted underline underline-offset-4 hover:text-bone">Salir</button>
        </form>
      </header>
      {business && <StepNav reached={business.onboarding_step} />}
      {/* Espacio abajo para que Nuna (fija abajo al centro) no tape los últimos botones. */}
      <main className="flex flex-1 flex-col gap-8 pb-44">{children}</main>
      {business && <NunaCompanion tips={TIPS} voice={realtimeEnabled()} />}
    </div>
  );
}
