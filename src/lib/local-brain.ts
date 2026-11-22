import type { BrainResult, DraftMovement, Insight, MoneySnapshot } from "@/lib/brain-types";
import { draftIsComplete } from "@/lib/brain-types";
import { dateFromText, detectType, expenseCategories, extractDescription, incomeCategories, normalize, parseAmount, suggestCategory } from "@/lib/chat-movement";
import { formatMoney } from "@/lib/money";
import { persona } from "@/lib/walleto-persona";

/**
 * Motor de respaldo sin IA: entiende varios movimientos en una frase,
 * correcciones («no, eran 300»), fechas relativas y preguntas sobre el mes.
 */

let counter = 0;
const newId = () => `d${Date.now().toString(36)}${(counter++).toString(36)}`;

const missingQuestion = (draft: DraftMovement) => persona.missing(draft);

function snapshotInsights(snapshot: MoneySnapshot | null): Insight[] {
  if (!snapshot) return [];
  return [
    { label: "Gastado este mes", value: formatMoney(snapshot.monthExpenses), tone: "down" },
    { label: "Ingresos del mes", value: formatMoney(snapshot.monthIncome), tone: "up" },
    { label: "Saldo registrado", value: formatMoney(snapshot.balance), tone: "neutral" },
  ];
}

function answerQuestion(text: string, snapshot: MoneySnapshot | null): BrainResult | null {
  const isQuestion = /[¿?]|\b(cuanto|cuantos|en que|resumen|como voy|como van|balance|saldo|llevo|top|mas gasto|gaste mas)\b/.test(text);
  if (!isQuestion || parseAmount(text) && detectType(text)) return null;
  if (!snapshot) return { reply: persona.noSnapshot(), drafts: [], suggestions: [], insights: [], mode: "local" };
  const top = snapshot.topCategories[0];
  if (/\bhoy\b/.test(text)) return { reply: persona.today(snapshot.todayExpenses), drafts: [], suggestions: ["¿Y esta semana?", "Resumen del mes"], insights: [], mode: "local" };
  if (/semana/.test(text)) return { reply: persona.week(snapshot.weekExpenses), drafts: [], suggestions: ["Resumen del mes", "¿En qué gasto más?"], insights: [], mode: "local" };
  if (/(en que|mas gasto|gaste mas|categoria|top)/.test(text)) {
    if (!top) return { reply: persona.noTop(), drafts: [], suggestions: [], insights: [], mode: "local" };
    const share = snapshot.monthExpenses ? Math.round(top.amount / snapshot.monthExpenses * 100) : 0;
    return { reply: persona.top(top.category, top.amount, share, snapshot.topCategories[1]), drafts: [], suggestions: ["Resumen del mes", "¿Cuánto llevo hoy?"], insights: snapshot.topCategories.slice(0, 3).map((item) => ({ label: item.category, value: formatMoney(item.amount), tone: "down" as const })), mode: "local" };
  }
    return {
    reply: persona.month(snapshot.monthLabel, snapshot.monthIncome, snapshot.monthExpenses, top?.category),
    drafts: [], suggestions: ["¿En qué gasto más?", "¿Cuánto llevo hoy?"], insights: snapshotInsights(snapshot), mode: "local",
  };
}

function findCategory(text: string, type: DraftMovement["type"]) {
  const options = type === "income" ? incomeCategories : expenseCategories;
  return options.find((item) => text.includes(normalize(item)));
}

function applyCorrection(text: string, drafts: DraftMovement[], today: string): BrainResult | null {
  if (!drafts.length) return null;
  const looksLikeFix = /^(no\b|mejor|cambia|corrige|eran|era|fueron|fue|en realidad|perdon|ponlo|ponle|pon\b|que sea|la categoria|categoria)/.test(text) || /\b(no eran|no era|en vez de)\b/.test(text);
  if (!looksLikeFix) return null;
  const index = drafts.length - 1;
  const target = { ...drafts[index] };
  const changes: string[] = [];
  const amount = parseAmount(text);
  if (amount && !/\bel\s+\d{1,2}\b/.test(text)) { target.amount = amount; changes.push(`monto a ${formatMoney(amount)}`); }
  const category = findCategory(text, target.type);
  if (category) { target.category = category; changes.push(`categoría a ${category}`); }
  const date = dateFromText(text, today);
  if (date && date !== target.date) { target.date = date; changes.push("la fecha"); }
  if (/\bingreso\b/.test(text) && target.type !== "income") { target.type = "income"; target.category = suggestCategory(target.description, "income"); changes.push("a ingreso"); }
  if (/\bgasto\b/.test(text) && target.type !== "expense") { target.type = "expense"; target.category = suggestCategory(target.description, "expense"); changes.push("a gasto"); }
  if (!changes.length && /categoria/.test(text)) {
    const options = (target.type === "income" ? incomeCategories : expenseCategories).filter((item) => item !== target.category);
    return { reply: persona.whichCategory(target.description || "este movimiento"), drafts, suggestions: options.slice(0, 3).map((item) => `Ponlo en ${item}`), insights: [], mode: "local" };
  }
  if (!changes.length) return null;
  const onlyDate = changes.length === 1 && changes[0] === "la fecha";
  if (onlyDate && drafts.length > 1) {
    const next = drafts.map((item) => ({ ...item, date: target.date }));
    return { reply: persona.movedDates(drafts.length), drafts: next, suggestions: ["Guardar todo"], insights: [], mode: "local" };
  }
  const next = drafts.map((item, position) => position === index ? target : item);
  return { reply: persona.fixed(changes.join(", "), target), drafts: next, suggestions: ["Guardar todo", "Otro cambio"], insights: [], mode: "local" };
}

function splitSegments(message: string) {
  return message.split(/\s*(?:;|\n|,\s*(?=\S)|\s+y\s+(?=(?:\$?\d|un|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|cien|mil|me\s|gast|pagu|compr|recib|cobr)))/i).map((part) => part.trim()).filter(Boolean);
}

export function localBrain(message: string, drafts: DraftMovement[], today: string, snapshot: MoneySnapshot | null): BrainResult {
  const text = normalize(message.trim());
  if (!text) return { reply: persona.greet(), drafts, suggestions: [], insights: [], mode: "local" };

  if (/^(hola|hey|buenas|que onda|buen dia|buenos dias|buenas tardes|buenas noches)\b/.test(text) && !parseAmount(text)) {
    return { reply: persona.greet(), drafts, suggestions: ["Resumen del mes", "Gasté 120 en comida"], insights: [], mode: "local" };
  }
  if (/^(gracias|grax|thx|perfecto|genial|chido|va|ok|vale)\b/.test(text) && !drafts.length) {
    return { reply: persona.thanks(), drafts, suggestions: [], insights: [], mode: "local" };
  }
  if (/^(borra|cancela|olvidalo|elimina|quitalo|descarta)/.test(text) && drafts.length) {
    const next = /todo|todos/.test(text) ? [] : drafts.slice(0, -1);
    return { reply: persona.cleared(next.length), drafts: next, suggestions: [], insights: [], mode: "local" };
  }
  if (/^(si|sip|dale|guardalo|guarda|confirmo|listo|asi esta bien|correcto)\b/.test(text) && drafts.length) {
    const ready = drafts.every(draftIsComplete);
    return { reply: ready ? persona.readyToSave() : missingQuestion(drafts.find((item) => !draftIsComplete(item))!) || "Falta un dato antes de guardar.", drafts, suggestions: ready ? ["Guardar todo"] : [], insights: [], mode: "local" };
  }

  const question = answerQuestion(text, snapshot);
  if (question) return { ...question, drafts };

  const correction = applyCorrection(text, drafts, today);
  if (correction) return correction;

  const pending = drafts.find((item) => !draftIsComplete(item));
  if (pending) {
    const amount = parseAmount(message);
    const filled = { ...pending };
    if (!filled.amount && amount) filled.amount = amount;
    else if (!filled.description) { filled.description = extractDescription(message) || message.trim().slice(0, 160); filled.category = suggestCategory(filled.description, filled.type); }
    if (filled !== pending && (filled.amount !== pending.amount || filled.description !== pending.description)) {
      const next = drafts.map((item) => item.id === pending.id ? filled : item);
      const question2 = missingQuestion(filled);
      return { reply: question2 ? persona.partial(question2) : persona.single(filled), drafts: next, suggestions: question2 ? [] : ["Guardar todo", "Cambia la categoría"], insights: [], mode: "local" };
    }
  }

  const globalType = detectType(text);
  const globalDate = dateFromText(message, today) || today;
  const created: DraftMovement[] = [];
  for (const segment of splitSegments(message)) {
    const amount = parseAmount(segment);
    const description = extractDescription(segment);
    if (!amount && !description) continue;
    if (!amount && created.length === 0 && !globalType) continue;
    const type = detectType(segment) ?? globalType ?? "expense";
    created.push({ id: newId(), type, amount, description, category: suggestCategory(description, type), date: dateFromText(segment, today) || globalDate });
  }
  const useful = created.filter((item) => item.amount || item.description);
  if (useful.length) {
    const next = [...drafts, ...useful];
    const incomplete = useful.find((item) => !draftIsComplete(item));
    const total = useful.reduce((sum, item) => sum + (item.amount ?? 0), 0);
    const reply = incomplete ? persona.partial(missingQuestion(incomplete))
      : useful.length > 1 ? persona.multi(useful.length, total)
        : persona.single(useful[0]);
    return { reply, drafts: next, suggestions: incomplete ? [] : ["Guardar todo", "Fue ayer", "Cambia la categoría"], insights: [], mode: "local" };
  }

  return {
    reply: persona.confused(),
    drafts, suggestions: ["Resumen del mes", "Gasté 80 en café"], insights: [], mode: "local",
  };
}
