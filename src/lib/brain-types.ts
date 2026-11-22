export type MovementType = "expense" | "income";

/** Movimiento en borrador dentro del chat: aún no se guarda. */
export type DraftMovement = {
  id: string;
  type: MovementType;
  amount: number | null;
  description: string;
  category: string;
  date: string;
};

export type ChatTurn = { role: "user" | "assistant"; text: string };

export type MoneySnapshot = {
  monthLabel: string;
  monthIncome: number;
  monthExpenses: number;
  balance: number;
  topCategories: { category: string; amount: number }[];
  recent: { date: string; type: string; amount: number; category: string; description: string | null }[];
  todayExpenses: number;
  weekExpenses: number;
};

export type Insight = { label: string; value: string; tone?: "up" | "down" | "neutral" };

export type BrainResult = {
  reply: string;
  drafts: DraftMovement[];
  suggestions: string[];
  insights: Insight[];
  mode: "ai" | "local";
};

export function draftIsComplete(draft: DraftMovement) {
  return Boolean(draft.type && draft.amount && draft.amount > 0 && draft.description.trim() && draft.category && /^\d{4}-\d{2}-\d{2}$/.test(draft.date));
}
