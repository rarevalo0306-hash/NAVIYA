import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/lib/database.types";

const PRIVATE_PREFIXES = ["/onboarding", "/panel", "/manual-de-marca", "/vista-previa"];
const OWN_HOSTS = ["orbusiness.app", "vercel.app", "localhost", "127.0.0.1"];

// Refresca la sesión de Supabase en cada visita y manda al login
// a quien intente entrar a una parte privada sin sesión.
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
          Object.entries(headers ?? {}).forEach(([key, value]) =>
            response.headers.set(key, value),
          );
        },
      },
    },
  );

  const path = request.nextUrl.pathname;

  // Dominio propio de un negocio (ya verificado): se muestra su página.
  const host = (request.headers.get("host") ?? "").split(":")[0].toLowerCase();
  if (host && !OWN_HOSTS.some((h) => host === h || host.endsWith(`.${h}`)) && !path.startsWith("/sitio/")) {
    const { data: slug } = await supabase.rpc("site_for_domain", { p_host: host });
    if (slug) {
      const url = request.nextUrl.clone();
      url.pathname = `/sitio/${slug}${path === "/" ? "" : path}`;
      return NextResponse.rewrite(url);
    }
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && PRIVATE_PREFIXES.some((p) => path.startsWith(p))) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
