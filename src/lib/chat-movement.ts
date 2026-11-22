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

export function normalize(value: string) {
  return value.toLocaleLowerCase("es-MX").normalize("NFD").replace(/[̀-ͯ]/g, "");
}

const categoryRules: Record<"expense" | "income", [string, RegExp][]> = {
  income: [
    ["Salario", /nomina|salario|sueldo|quincena|paga\b|pago de (?:la )?(?:empresa|chamba|trabajo)|aguinaldo|bono/],
    ["Ventas", /venta|vendi|cliente|freelance|gig|proyecto|servicio|negocio|factura|cobre|honorario|comision|landing|sitio web|diseno/],
    ["Reembolso", /reembolso|devolucion|me devolvieron|regresaron|cashback/],
    ["Regalo", /regalo|donacion|me regalaron|cumple/],
  ],
  expense: [
    ["Alimentación", /cafe|latte|capuchino|frappe|comida|desayun|almuerz|comi\b|cena|super|mercado|oxxo|seven|7-?eleven|restaurante|taco|pizza|hamburguesa|sushi|pan\b|panaderia|verdura|fruta|antojo|botana|cerveza|chela|bebida|agua mineral|rappi|didi food|uber eats|despensa|walmart|soriana|chedraui|costco/],
    ["Transporte", /uber|didi(?! food)|taxi|gasolina|gas(?:olinera)?\b|combustible|bus\b|autobus|camion|colectivo|metro|transporte|estacionamiento|caseta|peaje|ado\b|vuelo|avion|moto|bici/],
    ["Servicios", /internet|luz|cfe|agua\b|telefono|celular|recarga|telcel|electricidad|gas natural|suscripcion|spotify|icloud|google one|chatgpt|claude|hosting|dominio|vercel|canva|adobe|figma|plan de datos/],
    ["Salud", /farmacia|medicina|medicamento|medico|doctor|consulta|dentista|hospital|analisis|laboratorio|terapia|psicolog|gym|gimnasio|vitamina/],
    ["Vivienda", /renta|alquiler|hipoteca|casa|departamento|depa|mantenimiento|mueble|limpieza/],
    ["Educación", /libro|curso|escuela|colegiatura|universidad|clase|taller|udemy|platzi|domestika|certificacion/],
    ["Entretenimiento", /cine|concierto|juego|videojuego|steam|playstation|xbox|fiesta|antro|bar\b|streaming|netflix|disney|hbo|max\b|prime video|evento|boleto|museo/],
    ["Compras", /ropa|zapato|tenis|regalo|tienda|amazon|mercado ?libre|shein|liverpool|compra|accesorio|audifono|cargador|gadget/],
  ],
};

export function suggestCategory(description: string, type: "expense" | "income") {
  const text = normalize(description);
  return categoryRules[type].find(([, pattern]) => pattern.test(text))?.[0] ?? "Otros";
}

export function nextStep(movement: ChatMovement): ChatStep {
  if (!movement.type) return "type";
  if (!movement.amount) return "amount";
  if (!movement.description) return "description";
  if (!movement.category) return "category";
  if (!movement.date) return "date";
  return "review";
}

const units: Record<string, number> = {
  un: 1, uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10,
  once: 11, doce: 12, trece: 13, catorce: 14, quince: 15, dieciseis: 16, diecisiete: 17, dieciocho: 18, diecinueve: 19,
  veinte: 20, veintiuno: 21, veintiun: 21, veintidos: 22, veintitres: 23, veinticuatro: 24, veinticinco: 25, veintiseis: 26,
  veintisiete: 27, veintiocho: 28, veintinueve: 29, treinta: 30, cuarenta: 40, cincuenta: 50, sesenta: 60, setenta: 70,
  ochenta: 80, noventa: 90, cien: 100, ciento: 100, doscientos: 200, doscientas: 200, trescientos: 300, trescientas: 300,
  cuatrocientos: 400, cuatrocientas: 400, quinientos: 500, quinientas: 500, seiscientos: 600, seiscientas: 600,
  setecientos: 700, setecientas: 700, ochocientos: 800, ochocientas: 800, novecientos: 900, novecientas: 900,
};

/** Convierte «mil quinientos», «dos mil», «trescientos cincuenta» en número. */
function wordsToNumber(text: string): number | null {
  const words = normalize(text).replace(/[^a-z\s]/g, " ").split(/\s+/).filter(Boolean);
  let best: number | null = null;
  let total = 0; let current = 0; let active = false;
  const flush = () => { const value = total + current; if (active && value > 0) best = Math.max(best ?? 0, value); total = 0; current = 0; active = false; };
  for (const word of words) {
    if (word === "y" && active) continue;
    if (word in units) { current += units[word]; active = true; continue; }
    if (word === "mil") { total += (current || 1) * 1000; current = 0; active = true; continue; }
    if (word === "millon" || word === "millones") { total = (total + (current || 1)) * 1_000_000; current = 0; active = true; continue; }
    flush();
  }
  flush();
  return best;
}

const quantityPattern = /\b(\d{1,2})\s+([a-z\u00e1\u00e9\u00ed\u00f3\u00fa\u00f1]{3,}(?:\s+[a-z\u00e1\u00e9\u00ed\u00f3\u00fa\u00f1]{3,})?)\s+(?:de|a|por)\s+\$?\s*(\d+(?:[.,]\d{1,2})?)(?!\s*(?:k|mil)\b)/i;

export function parseAmount(value: string) {
  const text = normalize(value);
  const quantity = text.match(quantityPattern);
  if (quantity) {
    const total = Number(quantity[1]) * Number(quantity[3].replace(",", "."));
    if (Number.isFinite(total) && total > 0) return Math.round(total * 100) / 100;
  }
  const withSuffix = text.match(/(\d+(?:[.,]\d+)?)\s*(k|mil|lukas?)\b/);
  if (withSuffix) {
    const amount = Number(withSuffix[1].replace(",", ".")) * 1000;
    if (Number.isFinite(amount) && amount > 0) return Math.round(amount * 100) / 100;
  }
  const match = value.match(/(?:\$\s*)?(\d{1,3}(?:[.,]\d{3})+(?:[.,]\d{2})?|\d+(?:[.,]\d{1,2})?)/);
  if (match) {
    const raw = match[1];
    const separator = Math.max(raw.lastIndexOf("."), raw.lastIndexOf(","));
    const decimals = separator >= 0 && raw.length - separator - 1 <= 2;
    const amount = Number(decimals ? `${raw.slice(0, separator).replace(/[.,]/g, "")}.${raw.slice(separator + 1)}` : raw.replace(/[.,]/g, ""));
    if (Number.isFinite(amount) && amount > 0 && amount <= 999999999999.99) return amount;
  }
  const spoken = wordsToNumber(value);
  return spoken && spoken <= 999999999999.99 ? spoken : null;
}

export function detectType(value: string): ChatMovement["type"] {
  const text = normalize(value);
  if (/\bme\s+(?:pagaron|depositaron|reembolsaron|transfirieron|regalaron|devolvieron|cayo|cayeron)\b/.test(text)) return "income";
  if (/\b(gast\w*|pagu\w*|pague|compr\w*|egreso|salida|se me fue|se fueron|invert\w*|saque|cargo|cobraron)\b/.test(text)) return "expense";
  if (/\b(ingres\w*|recib\w*|cobr\w*|gan\w*|deposit\w*|entr(?:o|aron)|vendi|facture|llego)\b/.test(text)) return "income";
  return null;
}

const amountPattern = /(?:\$\s*)?\d{1,3}(?:[.,]\d{3})+(?:[.,]\d{2})?\s*(?:k|mil|pesos|mxn|varos|baros)?|(?:\$\s*)?\d+(?:[.,]\d{1,2})?\s*(?:k|mil|pesos|mxn|varos|baros)?/i;
const W = "[a-z\u00e1\u00e9\u00ed\u00f3\u00fa\u00fc\u00f1]*";
const verbPattern = new RegExp(`(?<![a-z\u00e1\u00e9\u00ed\u00f3\u00fa\u00f1])(?:me\\s+(?:pagaron|depositaron|reembolsaron|transfirieron|regalaron|devolvieron)|gast${W}|pagu${W}|pag\u00e9|compr${W}|egreso|salida|ingres${W}|recib${W}|cobr${W}|gan${W}|deposit${W}|vend\u00ed|vendi|factur\u00e9|facture)(?![a-z\u00e1\u00e9\u00ed\u00f3\u00fa\u00f1])`, "gi");
const numberWords = new RegExp(`(?<![a-z])(?:(?:${Object.keys({un:1,uno:1,una:1,dos:1,tres:1,cuatro:1,cinco:1,seis:1,siete:1,ocho:1,nueve:1,diez:1,once:1,doce:1,trece:1,catorce:1,quince:1,veinte:1,treinta:1,cuarenta:1,cincuenta:1,sesenta:1,setenta:1,ochenta:1,noventa:1,cien:1,ciento:1,doscientos:1,trescientos:1,cuatrocientos:1,quinientos:1,seiscientos:1,setecientos:1,ochocientos:1,novecientos:1,mil:1}).join("|")})(?:\\s+(?:y\\s+)?)?)+(?![a-z])`, "gi");
const dateWords = /\b(?:hoy|ayer|anteayer|antier|hace\s+\w+\s+dias?|el\s+(?:lunes|martes|miercoles|miércoles|jueves|viernes|sabado|sábado|domingo)(?:\s+pasado)?|(?:el\s+)?\d{1,2}\s+de\s+\w+|el\s+\d{1,2}\b)/gi;

export function extractDescription(value: string) {
  return value
    .replace(quantityPattern, (_match, _count: string, item: string) => ` ${item} `)
    .replace(amountPattern, " ")
    .replace(verbPattern, " ")
    .replace(numberWords, (match) => /\b(?:mil|cien|ciento|\w+ientos|veinte|treinta|cuarenta|cincuenta|sesenta|setenta|ochenta|noventa)\b/i.test(match) ? " " : match)
    .replace(dateWords, " ")
    .replace(/\b\d{4}-\d{2}-\d{2}\b|\b\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?\b/g, " ")
    .replace(/\b(?:como|unos|unas|aprox(?:imadamente)?|mas o menos|pesos|varos)\b/gi, " ")
    .replace(/^\s*(?:y|e|en|por|de|del|para|un|una|el|la|los|las|al)\s+/i, "")
    .replace(/\s+(?:en|por|de|para|y)\s*$/i, "")
    .trim().replace(/\s+/g, " ").replace(/^[,.;:\s-]+|[,.;:\s-]+$/g, "").replace(/^(?:de|del|en|por|para)\s+/i, "").replace(/^./, (first) => first.toLocaleUpperCase("es-MX")).slice(0, 160);
}

function shiftDay(today: string, days: number) {
  const date = new Date(`${today}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

const weekdays = ["domingo", "lunes", "martes", "miercoles", "jueves", "viernes", "sabado"];
const months = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

export function dateFromText(value: string, today: string) {
  const text = normalize(value);
  if (/\b(anteayer|antier)\b/.test(text)) return shiftDay(today, -2);
  if (/\bayer\b/.test(text)) return shiftDay(today, -1);
  if (/\bhoy\b/.test(text)) return today;
  const ago = text.match(/\bhace\s+(\w+)\s+dias?\b/);
  if (ago) { const days = Number(ago[1]) || wordsToNumber(ago[1]); if (days && days < 400) return shiftDay(today, -days); }
  const weekday = text.match(/\b(?:el\s+)?(lunes|martes|miercoles|jueves|viernes|sabado|domingo)\b/);
  if (weekday) {
    const target = weekdays.indexOf(weekday[1]);
    const current = new Date(`${today}T12:00:00Z`).getUTCDay();
    let diff = (current - target + 7) % 7;
    if (diff === 0) diff = /pasado/.test(text) ? 7 : 0;
    return shiftDay(today, -diff);
  }
  const iso = text.match(/\b(\d{4}-\d{2}-\d{2})\b/);
  if (iso && validDay(iso[1], today)) return iso[1];
  const local = text.match(/\b(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?\b/);
  if (local) {
    const year = local[3] ? (local[3].length === 2 ? `20${local[3]}` : local[3]) : today.slice(0, 4);
    const date = `${year}-${local[2].padStart(2, "0")}-${local[1].padStart(2, "0")}`;
    if (validDay(date, today)) return date;
  }
  const named = text.match(/\b(\d{1,2})\s+de\s+([a-z]+)/);
  if (named && months.includes(named[2])) {
    let year = Number(today.slice(0, 4));
    const month = String(months.indexOf(named[2]) + 1).padStart(2, "0");
    let date = `${year}-${month}-${named[1].padStart(2, "0")}`;
    if (date > today) { year -= 1; date = `${year}-${month}-${named[1].padStart(2, "0")}`; }
    if (validDay(date, today)) return date;
  }
  const dayOnly = text.match(/\bel\s+(\d{1,2})\b(?!\s*(?:pesos|mil|k|varos|\$))/);
  if (dayOnly) {
    let date = `${today.slice(0, 8)}${dayOnly[1].padStart(2, "0")}`;
    if (date > today) date = `${shiftDay(`${today.slice(0, 8)}01`, -1).slice(0, 8)}${dayOnly[1].padStart(2, "0")}`;
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
  const possibleAmount = parseAmount(message);
  const isFullMessage = Boolean(detectedType && possibleAmount);
  const type = (stage === "type" || isFullMessage ? detectedType : null) ?? current.type ?? (stage === "type" && /^(gasto|gastos)$/.test(normalized) ? "expense" : /^(ingreso|ingresos)$/.test(normalized) ? "income" : null);
  const amount = (stage === "amount" || isFullMessage ? possibleAmount : null) ?? current.amount;
  let description = current.description;
  if (!description && (stage === "description" || isFullMessage || (stage === "type" && possibleAmount))) {
    const candidate = isFullMessage || stage === "type" ? extractDescription(message) : message;
    if (candidate && !/^\d+(?:[.,]\d{1,2})?$/.test(candidate)) description = candidate.slice(0, 160);
  }
  const date = current.date || dateFromText(message, today);
  let category = current.category;
  if (stage === "category" && !isFullMessage) {
    const options = type === "income" ? incomeCategories : expenseCategories;
    if (/^(si|ok|vale|correcto|esta bien)$/.test(normalized)) category = suggestCategory(description, type ?? "expense");
    else category = options.find((item) => normalize(item) === normalized) ?? "";
  }
  return { type, amount, description, category, date };
}
