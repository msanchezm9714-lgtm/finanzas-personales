import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import type { BrainResult, ChatTurn, DraftMovement, MoneySnapshot } from "@/lib/brain-types";
import { expenseCategories, incomeCategories, suggestCategory } from "@/lib/chat-movement";
import { PERSONA_PROMPT } from "@/lib/walleto-persona";

const MODEL = process.env.WALLETO_MODEL || "claude-opus-5-5";

export function aiEnabled() {
  return Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
}

const BrainSchema = z.object({
  reply: z.string().describe("Respuesta a Miguel en la voz de Walleto (fixer-netrunner), breve (1-3 frases), con criterio financiero."),
  drafts: z.array(z.object({
    id: z.string().describe("Conserva el id de un borrador existente; usa 'new' para uno nuevo."),
    type: z.enum(["expense", "income"]),
    amount: z.number().nullable().describe("Monto positivo en MXN, o null si no lo dijo."),
    description: z.string().describe("Concepto corto y limpio, con mayúscula inicial. Vacío si no se sabe."),
    category: z.string().describe("Una categoría EXACTA de la lista permitida para su tipo."),
    date: z.string().describe("Fecha YYYY-MM-DD, nunca futura. Si no la menciona, usa la fecha de hoy."),
  })).describe("Lista COMPLETA de movimientos pendientes de guardar tras este mensaje (incluye los anteriores que sigan vigentes, con correcciones aplicadas)."),
  suggestions: z.array(z.string()).describe("0 a 3 respuestas rápidas cortas (máx. 4 palabras) que Miguel podría tocar a continuación."),
  insights: z.array(z.object({
    label: z.string(),
    value: z.string(),
    tone: z.enum(["up", "down", "neutral"]),
  })).describe("0 a 3 datos clave cuando responda una pregunta sobre su dinero; vacío al anotar movimientos."),
});

const SYSTEM = `Eres Walleto, el copiloto de finanzas personales de Miguel (freelancer en Playa del Carmen, México; moneda MXN).
Tu trabajo en este chat:
1. Convertir lo que dice en movimientos (gastos o ingresos) listos para guardar. Puede mencionar varios en una sola frase ("café 45 y uber 120") — sepáralos. Entiende montos coloquiales ("2k", "mil quinientos", "unos 300 varos"), fechas relativas ("antier", "el martes", "hace 3 días") y jerga mexicana.
2. Aplicar correcciones sobre los borradores ("no, eran 350", "ponlo en transporte", "ese fue ayer", "quita el último").
3. Responder preguntas sobre su dinero usando SOLO los datos del contexto (no inventes cifras). Si piden algo que no está en los datos, dilo.
4. Dar un comentario útil cuando aporte valor (p. ej. si una categoría se está disparando), sin sermonear.

Reglas:
- Nunca guardas nada tú: Miguel confirma con el botón Guardar. No digas "ya lo guardé".
- Si falta el monto o el concepto, deja el campo vacío/null y pregunta solo por eso.
- Categorías de gasto permitidas: ${expenseCategories.join(", ")}.
- Categorías de ingreso permitidas: ${incomeCategories.join(", ")}.
- Transferencias entre cuentas propias no son gasto ni ingreso: explícalo y no crees borrador.
- Si el mensaje es una pregunta o charla, devuelve los borradores existentes sin cambios.
- Nunca inventes datos ni digas que ya guardaste algo.

${PERSONA_PROMPT}`;

function cleanDrafts(raw: z.infer<typeof BrainSchema>["drafts"], previous: DraftMovement[], today: string): DraftMovement[] {
  const known = new Set(previous.map((item) => item.id));
  return raw.slice(0, 12).map((item, index) => {
    const options = item.type === "income" ? incomeCategories : expenseCategories;
    const amount = typeof item.amount === "number" && item.amount > 0 && item.amount <= 999999999999.99 ? Math.round(item.amount * 100) / 100 : null;
    const description = item.description.trim().slice(0, 160);
    const date = /^\d{4}-\d{2}-\d{2}$/.test(item.date) && item.date <= today ? item.date : today;
    return {
      id: known.has(item.id) ? item.id : `a${Date.now().toString(36)}${index}`,
      type: item.type,
      amount,
      description,
      category: options.includes(item.category) ? item.category : suggestCategory(description, item.type),
      date,
    };
  });
}

export async function askClaude(message: string, history: ChatTurn[], drafts: DraftMovement[], today: string, snapshot: MoneySnapshot | null): Promise<BrainResult | null> {
  if (!aiEnabled()) return null;
  const client = new Anthropic();
  const context = {
    hoy: today,
    borradores_actuales: drafts,
    finanzas: snapshot,
  };
  const messages: Anthropic.Beta.BetaMessageParam[] = [];
  for (const turn of history.slice(-14)) {
    const role = turn.role;
    if (!messages.length && role === "assistant") continue;
    messages.push({ role, content: turn.text.slice(0, 1200) });
  }
  messages.push({ role: "user", content: `<contexto>${JSON.stringify(context)}</contexto>\n\n${message.slice(0, 600)}` });

  try {
    const response = await client.beta.messages.parse({
      model: MODEL,
      max_tokens: 8000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: SYSTEM,
      messages,
      output_config: { effort: "low", format: betaZodOutputFormat(BrainSchema) },
    });
    if (response.stop_reason === "refusal" || !response.parsed_output) return null;
    const output = response.parsed_output;
    return {
      reply: output.reply.trim() || "Listo.",
      drafts: cleanDrafts(output.drafts, drafts, today),
      suggestions: output.suggestions.slice(0, 3).map((item) => item.slice(0, 40)),
      insights: output.insights.slice(0, 3),
      mode: "ai",
    };
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) console.error("Walleto IA: clave de Anthropic inválida");
    else if (error instanceof Anthropic.RateLimitError) console.error("Walleto IA: límite de uso alcanzado");
    else if (error instanceof Anthropic.APIError) console.error(`Walleto IA: error ${error.status}`, error.message);
    else console.error("Walleto IA: fallo inesperado", error);
    return null;
  }
}
