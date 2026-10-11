import type { BrandKit } from "@/lib/brand";
import { emailSignatureHtml } from "@/lib/brand-signature";
import { EmailSignature } from "./email-signature";

// Visor del manual de marca: las páginas del libro (tipo presentación), el PDF para descargar
// y la firma de email lista para copiar.
export function BrandManual({
  name,
  owner,
  phone,
  address,
  kit,
  siteUrl,
  logoPngUrl,
  pages,
  img,
  pdfUrl,
}: {
  name: string;
  owner: string | null;
  phone: string | null;
  address: string | null;
  kit: BrandKit;
  siteUrl: string | null;
  logoPngUrl: string | null;
  pages: number;
  img: (n: number) => string;
  pdfUrl: string;
}) {
  const signature = emailSignatureHtml({ name, owner, phone, address, siteUrl, logoUrl: logoPngUrl, kit });

  return (
    <div className="min-h-full bg-[#151515] text-white">
      <style>{`@page { size: landscape; margin: 0; } @media print { .page { break-after: page; border-radius: 0 !important; box-shadow: none !important; } }`}</style>
      <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-[#151515]/90 px-4 py-3 backdrop-blur print:hidden sm:px-8">
        <a href="/onboarding/marca#kit" className="min-h-11 content-center text-sm text-white/80 underline underline-offset-4 hover:text-white">
          ← Volver
        </a>
        <span className="hidden font-semibold sm:inline">Manual de marca · {name}</span>
        <a href={pdfUrl} className="inline-flex min-h-11 items-center rounded-full bg-white px-5 font-semibold text-[#151515]">
          Descargar PDF
        </a>
      </div>

      <main className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8 sm:px-8 print:max-w-none print:gap-0 print:p-0">
        {Array.from({ length: pages }, (_, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={i}
            src={img(i + 1)}
            alt={`Página ${i + 1} del manual de marca`}
            loading={i < 2 ? "eager" : "lazy"}
            width={1920}
            height={1080}
            className="page aspect-video w-full rounded-2xl bg-white/5 shadow-2xl"
          />
        ))}

        <section className="flex flex-col gap-4 rounded-2xl bg-white p-6 text-neutral-900 print:hidden" aria-labelledby="firma">
          <h2 id="firma" className="text-2xl font-bold">
            Firma de email
          </h2>
          <p className="text-neutral-600">Cópiala y pégala en la configuración de firma de Gmail u Outlook.</p>
          <EmailSignature html={signature} />
        </section>
      </main>
    </div>
  );
}
