// Herramientas de Nuna en la entrevista por voz (las usa la IA de voz que lleva la plática:
// OpenAI Realtime o Gemini Live). Lo que hacen está en entrevista/actions.ts (voiceSave, voiceLog).

const str = { type: "string" };
const bool = { type: "boolean" };

export const INTERVIEW_TOOLS = [
  {
    name: "anotar",
    description:
      "Guarda los datos del negocio que el dueño acaba de decir o corregir. Llámala cada vez que diga algo nuevo; " +
      "manda solo lo nuevo. Devuelve qué datos faltan todavía.",
    parameters: {
      type: "object",
      properties: {
        owner_name: { ...str, description: "Nombre de pila del dueño" },
        business_name: { ...str, description: "Nombre del negocio tal cual (puede estar en inglés)" },
        country: str,
        city: str,
        business_type: { type: "string", enum: ["products", "services", "both"] },
        industry: { ...str, description: "A qué se dedica" },
        services: {
          type: "array",
          description: "Lista completa de productos o servicios (precio solo si lo dijo)",
          items: { type: "object", properties: { name: str, price: { type: ["number", "null"] } }, required: ["name"] },
        },
        currency_choice: { type: "string", enum: ["local", "other", "both"] },
        hours: str,
        phone: str,
        address: str,
        lead_sources: { ...str, description: "Cómo le llegan los clientes" },
        visit_before_quote: bool,
        payment_timing: { type: "string", enum: ["before", "deposit", "after", "at_sale", "credit"] },
        payment_methods: { type: "array", items: str },
        offers_delivery: bool,
        has_recurring_clients: bool,
        address_form: { type: "string", enum: ["tu", "usted", "vos"] },
        quote_requires_approval: bool,
      },
    },
  },
  {
    name: "terminar_entrevista",
    description:
      "Termina la entrevista. Úsala solo cuando ya no falte ningún dato, ya le preguntaste si quiere agregar algo más y te dijo que no " +
      "(o ya lo anotaste), y ya te despediste.",
    parameters: { type: "object", properties: {} },
  },
];
