type ParsedMovement = {
  type: "income" | "expense";
  amount: number;
  category: string;
  description: string;
};

const categoryAliases: Record<string, string> = {
  comida: "Alimentación",
  alimentacion: "Alimentación",
  supermercado: "Alimentación",
  cafe: "Alimentación",
  restaurante: "Alimentación",
  vivienda: "Vivienda",
  renta: "Vivienda",
  transporte: "Transporte",
  taxi: "Transporte",
  gasolina: "Transporte",
  salud: "Salud",
  entretenimiento: "Entretenimiento",
  servicios: "Servicios",
  recarga: "Servicios",
  educacion: "Educación",
  salario: "Salario",
};

export function parseMovement(message: string): ParsedMovement | null {
  const match = message.trim().match(/^(?:me\s+)?(gasto|gast[eé]|pagu[eé]|compr[eé]|ingreso|recib[ií]|cobr[eé])\s+(\d+(?:[.,]\d{1,2})?)\s+(.+)$/i);
  if (!match) return null;

  const amount = Number(match[2].replace(",", "."));
  if (!Number.isFinite(amount) || amount <= 0 || amount > 999999999999.99) return null;

  const remainder = match[3].trim().replace(/^(?:en|por|de|para)\s+/i, "").slice(0, 300);
  if (!remainder) return null;
  const [firstWord, ...rest] = remainder.split(/\s+/);
  const normalized = firstWord.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const category = categoryAliases[normalized] ?? "Otros";
  const description = categoryAliases[normalized] ? rest.join(" ") || firstWord : remainder;

  return {
    type: /^(ingreso|recib[ií]|cobr[eé])$/i.test(match[1]) ? "income" : "expense",
    amount,
    category,
    description,
  };
}
