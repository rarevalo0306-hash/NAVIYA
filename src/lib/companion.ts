import "server-only";
import { z } from "zod";
import { brandKitPrice } from "@/lib/brand-store";
import { ORBUSINESS_PITCH, ownerForm, type BusinessRow } from "@/lib/interview";
import { NUNA_PERSONA, VOICE_STYLE, aiJson } from "@/lib/nuna";

// Nuna como acompañante después de la entrevista: está en cada paso (marca, página web, CRM y activar),
// explica qué toca hacer y contesta dudas por escrito o por voz. Todavía no hace cambios por el dueño.

export const COMPANION_STEPS = ["marca", "web", "crm", "activar"] as const;
export type CompanionStep = (typeof COMPANION_STEPS)[number];
export const isCompanionStep = (s: unknown): s is CompanionStep => COMPANION_STEPS.includes(s as CompanionStep);

// tip: el globito al llegar al paso. context: lo que Nuna sabe de la pantalla para contestar dudas.
export const STEP_GUIDE: Record<CompanionStep, { tip: string; context: () => string }> = {
  marca: {
    tip: "Aquí eliges la marca de tu negocio. Mira las propuestas, ajusta lo que quieras y, cuando te guste, compra tu kit para descargarlo todo. ¿Dudas? Pregúntame.",
    context: () =>
      "Paso «Marca». En esta pantalla el dueño ve propuestas de identidad de marca hechas para su negocio (logo, colores, letras, eslogan e historia). " +
      "Puede elegir una, pedir más símbolos, ajustar colores, letras o el símbolo, reescribir la base de marca, y subir su propio logo, fotos o su página actual " +
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

function companionSystem(b: BusinessRow, step: CompanionStep) {
  const form = { tu: "tú", usted: "usted", vos: "vos" }[ownerForm(b)];
  const facts = [
    b.owner_name && `Dueño: ${b.owner_name}`,
    b.name && b.name !== "Mi negocio" && `Negocio: ${b.name}`,
    b.industry && `Giro: ${b.industry}`,
    b.zone && `Zona: ${b.zone}`,
  ].filter(Boolean);
  return (
    NUNA_PERSONA +
    `Qué hace Orbusiness: ${ORBUSINESS_PITCH} ` +
    "La entrevista ya terminó: ahora acompañas al dueño en el resto del proceso (marca, página web, CRM y activar), como una guía amable que está a su lado. " +
    `Ahora está aquí: ${STEP_GUIDE[step].context()} ` +
    `Lo que sabes de su negocio: ${facts.join("; ") || "poco todavía"}. ` +
    "Contesta sus dudas sobre esta pantalla, su negocio u Orbusiness en 1 a 3 oraciones, y dile qué botón tocar cuando ayude. " +
    "Todavía no puedes hacer cambios por él (no cambias colores, no publicas ni compras): dile cómo hacerlo él en la pantalla. " +
    "Si no sabes algo de la pantalla, dilo con honestidad en vez de inventar. " +
    `Háblale de ${form}. `
  );
}

// Respuesta por escrito (con el cerebro de siempre).
export async function companionReply(b: BusinessRow, step: CompanionStep, history: { role: "owner" | "nuna"; text: string }[], question: string) {
  const out = await aiJson({
    system: companionSystem(b, step),
    user: [...history.map((m) => `${m.role === "owner" ? "Dueño" : "Nuna"}: ${m.text}`), `Dueño: ${question}`].join("\n"),
    schema: z.object({ reply: z.string() }),
    jsonHint: 'Formato: {"reply": "lo que le contestas"}',
    maxTokens: 600,
    temperature: 0.6,
  });
  return out?.reply.trim() || null;
}

// Instrucciones para platicar por voz en este paso.
export function companionVoiceInstructions(b: BusinessRow, step: CompanionStep) {
  return (
    companionSystem(b, step) +
    VOICE_STYLE +
    "Cuando el dueño te diga «hola», salúdalo por su nombre en una frase y pregúntale en qué le ayudas con este paso (sin volver a presentarte)."
  );
}
