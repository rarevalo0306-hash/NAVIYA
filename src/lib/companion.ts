import "server-only";
import { z } from "zod";
import { brandKitPrice } from "@/lib/brand-store";
import { ORBUSINESS_PITCH, ownerForm, type BusinessRow } from "@/lib/interview";
import { INTERVIEW_TOOLS } from "@/lib/interview-tools";
import { FactsSchema, NUNA_PERSONA, VOICE_STYLE, aiJson } from "@/lib/nuna";

// Nuna como acompañante después de la entrevista: está en cada paso (marca, página web, CRM y activar),
// explica qué toca hacer, contesta dudas por escrito o por voz y corrige los datos del negocio.

export const COMPANION_STEPS = ["marca", "web", "crm", "activar"] as const;
export type CompanionStep = (typeof COMPANION_STEPS)[number];
export const isCompanionStep = (s: unknown): s is CompanionStep => COMPANION_STEPS.includes(s as CompanionStep);

// tip: el globito al llegar al paso. context: lo que Nuna sabe de la pantalla para contestar dudas.
export const STEP_GUIDE: Record<CompanionStep, { tip: string; context: () => string }> = {
  marca: {
    tip: "Aquí eliges la marca de tu negocio. Mira las propuestas, ajusta lo que quieras y, cuando te guste, compra tu kit para descargarlo todo. ¿Dudas? Pregúntame.",
    context: () =>
      "Paso «Marca». En esta pantalla el dueño ve propuestas de identidad de marca hechas para su negocio (logo, colores, letras, eslogan e historia). " +
      "Puede elegir una, pedir más símbolos, ajustar colores, letras o el símbolo, y subir su propio logo, fotos o su página actual " +
      "La «base de marca» (historia, promesa, misión, visión, valores, cliente ideal) es una PROPUESTA que Nuna escribió con lo que el dueño contó en la entrevista: " +
      "si la menciona, preséntala así («con lo que me contaste te propongo esto; si algo no es así, lo cambias») y dile que puede editarla ahí mismo o escribir qué cambiar y tocar «Escribir otra versión». " +
      "(si sube su logo, su página usa ese). Ver las propuestas es gratis. " +
      `El kit de marca completo cuesta ${brandKitPrice()} (pago único) e incluye: tablero de marca, logo en todas sus versiones (horizontal, vertical, blanco, un color, símbolo y sello) ` +
      "en SVG, PNG en 4 tamaños, JPG, PDF para Illustrator y PSD, favicon e íconos web; manual de marca en PDF; textos de marca en Word; firma de correo; " +
      "todas las plantillas de cada red (Facebook, Instagram, WhatsApp, TikTok, Google, LinkedIn, YouTube y X) en su tamaño exacto y editables en Photoshop; " +
      "papelería (tarjeta, membrete en PDF y Word, cotización y volante) y mockups. Después de comprar, se descarga todo en un .zip (tarda unos 30 segundos). " +
      "Al guardar la marca pasa al siguiente paso: la página web.",
  },
  web: {
    tip: "Aquí armas tu página web. Revisa lo que vendes, elige el diseño que más te guste y publícala. Después seguimos con tu CRM.",
    context: () =>
      "Paso «Página web». En esta pantalla el dueño revisa «Lo que vendes» (agrega o quita productos o servicios; el precio es opcional; se ve mejor con 4 a 8), " +
      "elige un diseño entre varias plantillas con vista previa en celular y publica su página con su propia dirección. " +
      "La página trae un formulario que manda a los clientes interesados directo a su CRM, y se actualiza sola si cambia algo de su marca. " +
      "Al publicar la primera vez pasa al siguiente paso: el CRM.",
  },
  crm: {
    tip: "Este es tu CRM: el camino de tus clientes, sus datos y lo que yo haré en cada etapa. Si te parece bien, apruébalo.",
    context: () =>
      "Paso «CRM». Nuna convirtió lo que el dueño contó en la entrevista en: las etapas del camino de sus clientes, los datos que se guardan de cada cliente " +
      "y lo que Nuna hará en cada etapa. Si algo no cuadra, se corrige la respuesta en la entrevista y se vuelve aquí. " +
      "El botón «Aprobar y crear mi CRM» lo crea y pasa al último paso: activar.",
  },
  activar: {
    tip: "¡Ya casi terminamos! Aquí ves lo que ya funciona y lo que sigue. Cuando quieras, entra a tu panel.",
    context: () =>
      "Paso «Activar», el último. La pantalla muestra lo que ya funciona hoy y lo que Orbusiness va armando por el dueño, sin que tenga que conectar nada. " +
      "El botón «Ir a mi panel» lo lleva a su panel, donde ve a sus clientes.",
  },
};

// Lo que el dueño puede corregir con Nuna en cualquier paso: los mismos datos de la entrevista,
// menos los productos y servicios (esos se cambian en «Lo que vendes», con fotos y precios).
export const COMPANION_TOOLS = [
  {
    ...INTERVIEW_TOOLS[0],
    description:
      "Guarda un dato del negocio que el dueño corrige o agrega ahora (su nombre, el del negocio, teléfono, horario, dirección, " +
      "formas de pago, entrega, etc.). Manda solo lo que cambió. Los productos y servicios no se cambian aquí.",
    parameters: {
      ...INTERVIEW_TOOLS[0].parameters,
      properties: Object.fromEntries(Object.entries(INTERVIEW_TOOLS[0].parameters.properties ?? {}).filter(([k]) => k !== "services")),
    },
  },
];

const CORRECTIONS =
  "Puedes corregir los datos del negocio en cualquier momento, como lo haría una persona: si el dueño dice que algo está mal o cambió " +
  "(por ejemplo «no me llamo José, me llamo Juan», otro teléfono, otro horario), guárdalo y confírmale con naturalidad que ya quedó (por ejemplo «¡Listo, Juan! Ya lo cambié»). " +
  "Si no está claro qué quiere cambiar, pregúntale. Los productos y servicios no los cambias tú: dile que los cambie en «Lo que vendes» (o en la lista de esta página). " +
  "Otras cosas (colores, publicar, comprar) todavía no las haces tú: dile qué botón tocar. ";

function companionSystem(b: BusinessRow, step: CompanionStep, known: string[]) {
  const form = { tu: "tú", usted: "usted", vos: "vos" }[ownerForm(b)];
  return (
    NUNA_PERSONA +
    `Qué hace Orbusiness: ${ORBUSINESS_PITCH} ` +
    "La entrevista ya terminó: ahora acompañas al dueño en el resto del proceso (marca, página web, CRM y activar), como una guía amable que está a su lado " +
    "y que ya lo conoce: no vuelvas a presentarte ni a preguntar lo que ya sabes. " +
    `Ahora está aquí: ${STEP_GUIDE[step].context()} ` +
    `Lo que sabes de su negocio (vale esto, aunque antes se haya dicho otra cosa): ${known.join("; ") || "poco todavía"}. ` +
    "Contesta sus dudas sobre esta pantalla, su negocio u Orbusiness en 1 a 3 oraciones, y dile qué botón tocar cuando ayude. " +
    CORRECTIONS +
    "Si no sabes algo de la pantalla, dilo con honestidad en vez de inventar. " +
    `Háblale de ${form}. `
  );
}

// Respuesta por escrito (con el cerebro de siempre). facts: solo los datos que el dueño corrigió o agregó en su último mensaje.
export async function companionReply(b: BusinessRow, step: CompanionStep, known: string[], history: { role: "owner" | "nuna"; text: string }[], question: string) {
  return aiJson({
    system: companionSystem(b, step, known),
    user: [...history.map((m) => `${m.role === "owner" ? "Dueño" : "Nuna"}: ${m.text}`), `Dueño: ${question}`].join("\n"),
    schema: z.object({ reply: z.string(), facts: FactsSchema.catch(FactsSchema.parse({})) }),
    jsonHint:
      'Formato: {"reply": "lo que le contestas", "facts": {solo los datos que el dueño corrigió o agregó en su ÚLTIMO mensaje, con las claves ' +
      "owner_name, business_name, country, city, business_type, industry, currency_choice, hours, phone, address, lead_sources, visit_before_quote, " +
      'payment_timing, payment_methods, offers_delivery, has_recurring_clients, address_form, quote_requires_approval; las demás en null}}',
    maxTokens: 800,
    temperature: 0.5,
  });
}

// Instrucciones para platicar por voz en este paso.
export function companionVoiceInstructions(b: BusinessRow, step: CompanionStep, known: string[]) {
  return (
    companionSystem(b, step, known) +
    VOICE_STYLE +
    "Para guardar una corrección usa la herramienta «anotar» y después confírmale en una frase. " +
    "Cuando el dueño te diga «hola», salúdalo por su nombre en una frase y pregúntale en qué le ayudas con este paso (sin volver a presentarte). " +
    "Los mensajes entre paréntesis son avisos de la app, no del dueño (por ejemplo, que pasó a otro paso): sigue la plática con naturalidad, sin saludar de nuevo."
  );
}
