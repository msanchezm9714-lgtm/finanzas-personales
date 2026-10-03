import { dateFromText, parseAmount } from "@/lib/chat-movement";

export type ReceiptSuggestion = { amount: number | null; description: string; date: string };

export function interpretReceipt(text: string, today: string): ReceiptSuggestion {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const totalLines = lines.filter((line) => /\b(total|total a pagar|importe|monto pagado)\b/i.test(line) && !/\b(subtotal|sub total|cambio|iva|propina)\b/i.test(line));
  const moneyInLine = (line: string) => {
    const values = [...line.matchAll(/(?:\$\s*)?\d{1,3}(?:[.,]\d{3})+(?:[.,]\d{2})?|\$\s*\d+(?:[.,]\d{2})?|\b\d+[.,]\d{2}\b/g)]
      .map((match) => parseAmount(match[0]))
      .filter((value): value is number => value !== null);
    return values.at(-1) ?? null;
  };
  const amount = totalLines.map(moneyInLine).find((value) => value !== null) ?? null;
  const date = lines.map((line) => dateFromText(line, today)).find(Boolean) ?? "";
  const description = lines.find((line) => /[a-záéíóúñ]{3,}/i.test(line) && !/\b(ticket|folio|rfc|fecha|hora|total|subtotal|iva|importe|tarjeta|efectivo|gracias)\b/i.test(line))?.slice(0, 160) ?? "";
  return { amount, description, date };
}
