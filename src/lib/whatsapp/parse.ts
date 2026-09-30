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
  vivienda: "Vivienda",
  renta: "Vivienda",
  transporte: "Transporte",
  taxi: "Transporte",
  salud: "Salud",
  entretenimiento: "Entretenimiento",
  servicios: "Servicios",
  educacion: "Educación",
  salario: "Salario",
};

export function parseMovement(message: string): ParsedMovement | null {
  const match = message.trim().match(/^(gasto|ingreso)\s+(\d+(?:[.,]\d{1,2})?)\s+(.+)$/i);
  if (!match) return null;

  const amount = Number(match[2].replace(",", "."));
  if (!Number.isFinite(amount) || amount <= 0 || amount > 999999999999.99) return null;

  const remainder = match[3].trim().slice(0, 300);
  const [firstWord, ...rest] = remainder.split(/\s+/);
  const normalized = firstWord.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const category = categoryAliases[normalized] ?? "Otros";
  const description = categoryAliases[normalized] ? rest.join(" ") || firstWord : remainder;

  return {
    type: match[1].toLowerCase() === "ingreso" ? "income" : "expense",
    amount,
    category,
    description,
  };
}
