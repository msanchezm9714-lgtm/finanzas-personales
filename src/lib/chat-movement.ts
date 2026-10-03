export type ChatMovement = {
  type: "expense" | "income" | null;
  amount: number | null;
  description: string;
  category: string;
  date: string;
};

export type ChatStep = "type" | "amount" | "description" | "category" | "date" | "review";

export const expenseCategories = ["Alimentación", "Transporte", "Compras", "Servicios", "Salud", "Entretenimiento", "Vivienda", "Educación", "Otros"];
export const incomeCategories = ["Salario", "Ventas", "Reembolso", "Regalo", "Otros"];

function normalize(value: string) {
  return value.toLocaleLowerCase("es-MX").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export function suggestCategory(description: string, type: "expense" | "income") {
  const text = normalize(description);
  const rules: [string, RegExp][] = type === "income" ? [
    ["Salario", /nomina|salario|sueldo|quincena|paga/],
    ["Ventas", /venta|cliente|servicio|negocio/],
    ["Reembolso", /reembolso|devolucion|me devolvieron/],
    ["Regalo", /regalo|donacion/],
  ] : [
    ["Alimentación", /cafe|comida|desayuno|almuerzo|cena|super|mercado|restaurante|taco|pizza|pan|verdura|fruta/],
    ["Transporte", /uber|didi|taxi|gasolina|combustible|bus|camion|metro|transporte|estacionamiento/],
    ["Servicios", /internet|luz|agua|telefono|celular|recarga|electricidad|gas|suscripcion/],
    ["Salud", /farmacia|medicina|medico|doctor|consulta|dentista|hospital/],
    ["Vivienda", /renta|alquiler|hipoteca|casa|departamento/],
    ["Educación", /libro|curso|escuela|colegiatura|universidad/],
    ["Entretenimiento", /cine|concierto|juego|fiesta|streaming|netflix/],
    ["Compras", /ropa|zapatos|regalo|tienda|amazon|compra/],
  ];
  return rules.find(([, pattern]) => pattern.test(text))?.[0] ?? "Otros";
}

export function nextStep(movement: ChatMovement): ChatStep {
  if (!movement.type) return "type";
  if (!movement.amount) return "amount";
  if (!movement.description) return "description";
  if (!movement.category) return "category";
  if (!movement.date) return "date";
  return "review";
}

export function parseAmount(value: string) {
  const match = value.match(/(?:\$\s*)?(\d{1,3}(?:[.,]\d{3})+(?:[.,]\d{2})?|\d+(?:[.,]\d{1,2})?)/);
  if (!match) return null;
  const raw = match[1];
  const separator = Math.max(raw.lastIndexOf("."), raw.lastIndexOf(","));
  const decimals = separator >= 0 && raw.length - separator - 1 <= 2;
  const amount = Number(decimals ? `${raw.slice(0, separator).replace(/[.,]/g, "")}.${raw.slice(separator + 1)}` : raw.replace(/[.,]/g, ""));
  return Number.isFinite(amount) && amount > 0 && amount <= 999999999999.99 ? amount : null;
}

function detectType(text: string): ChatMovement["type"] {
  if (/\bme\s+(?:pagaron|depositaron|reembolsaron)\b/.test(text)) return "income";
  if (/\b(gast\w*|pagu\w*|compr\w*|egreso|salida)\b/.test(text)) return "expense";
  if (/\b(ingres\w*|recib\w*|cobr\w*|gan\w*|deposit\w*)\b/.test(text)) return "income";
  return null;
}

function extractDescription(value: string) {
  return value
    .replace(/(?:\$\s*)?\d{1,3}(?:[.,]\d{3})+(?:[.,]\d{2})?|(?:\$\s*)?\d+(?:[.,]\d{1,2})?/, " ")
    .replace(/\b(?:gast\w*|pagu\w*|compr\w*|egreso|salida|ingres\w*|recib\w*|cobr\w*|gan\w*|deposit\w*)\b/i, " ")
    .replace(/\b(?:hoy|ayer)\b/gi, " ")
    .replace(/\b\d{4}-\d{2}-\d{2}\b|\b\d{1,2}[/-]\d{1,2}[/-]\d{4}\b/g, " ")
    .replace(/^\s*(?:en|por|de|para|un|una|el|la)\s+/i, "")
    .trim().replace(/\s+/g, " ").slice(0, 160);
}

function previousDay(today: string) {
  const date = new Date(`${today}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

export function dateFromText(value: string, today: string) {
  const text = normalize(value);
  if (/\bayer\b/.test(text)) return previousDay(today);
  if (/\bhoy\b/.test(text)) return today;
  const iso = text.match(/\b(\d{4}-\d{2}-\d{2})\b/);
  if (iso && validDay(iso[1], today)) return iso[1];
  const local = text.match(/\b(\d{1,2})[/-](\d{1,2})[/-](\d{4})\b/);
  if (local) {
    const date = `${local[3]}-${local[2].padStart(2, "0")}-${local[1].padStart(2, "0")}`;
    if (validDay(date, today)) return date;
  }
  return "";
}

function validDay(value: string, today: string) {
  const parsed = new Date(`${value}T12:00:00Z`);
  return value <= today && !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export function readChatMessage(value: string, current: ChatMovement, today: string): ChatMovement {
  const message = value.trim().slice(0, 300);
  const normalized = normalize(message);
  const stage = nextStep(current);
  const detectedType = detectType(normalized);
  const type = detectedType ?? current.type ?? (stage === "type" && /^(gasto|gastos)$/.test(normalized) ? "expense" : /^(ingreso|ingresos)$/.test(normalized) ? "income" : null);
  const possibleAmount = parseAmount(message);
  const isFullMessage = Boolean(detectedType && possibleAmount);
  const amount = (stage === "amount" || isFullMessage ? possibleAmount : null) ?? current.amount;
  let description = current.description;
  if (!description && (stage === "description" || isFullMessage)) {
    const candidate = isFullMessage ? extractDescription(message) : message;
    if (candidate && !/^\d+(?:[.,]\d{1,2})?$/.test(candidate)) description = candidate.slice(0, 160);
  }
  const date = current.date || dateFromText(message, today);
  let category = current.category;
  if (stage === "category" && !isFullMessage) {
    const options = type === "income" ? incomeCategories : expenseCategories;
    if (/^(si|sí|ok|vale|correcto|esta bien)$/.test(normalized)) category = suggestCategory(description, type ?? "expense");
    else category = options.find((item) => normalize(item) === normalized) ?? "";
  }
  return { type, amount, description, category, date };
}
