import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

// Cliente con la llave secreta de Supabase: se salta RLS. Solo para webhooks que llegan sin sesión
// (WhatsApp); cada consulta debe filtrar por el negocio que corresponde.
export const adminEnabled = () => Boolean(process.env.SUPABASE_SECRET_KEY?.trim());

export function createAdminClient() {
  return createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!.trim(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
