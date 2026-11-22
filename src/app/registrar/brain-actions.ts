"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { BrainResult, ChatTurn, DraftMovement, MoneySnapshot } from "@/lib/brain-types";
import { draftIsComplete } from "@/lib/brain-types";
import { expenseCategories, incomeCategories } from "@/lib/chat-movement";
import { localBrain } from "@/lib/local-brain";
import { askClaude } from "@/lib/walleto-ai";

function cancunToday() {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/Cancun", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function shift(day: string, offset: number) {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

type Row = { date: string; type: string; amount: number; category: string; description: string | null };

async function loadSnapshot(today: string): Promise<{ userId: string | null; snapshot: MoneySnapshot | null }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { userId: null, snapshot: null };
  const [{ data }, { data: settings }] = await Promise.all([
    supabase.from("transactions").select("date,type,amount,category,description").eq("user_id", user.id).order("date", { ascending: false }).order("created_at", { ascending: false }).limit(1500),
    supabase.from("user_settings").select("opening_balance").eq("user_id", user.id).maybeSingle(),
  ]);
  const rows = (data ?? []) as Row[];
  const monthStart = `${today.slice(0, 8)}01`;
  const weekStart = shift(today, -6);
  const month = rows.filter((row) => row.date >= monthStart);
  const sum = (items: Row[], type: string) => items.filter((row) => row.type === type).reduce((total, row) => total + Number(row.amount), 0);
  const byCategory = month.filter((row) => row.type === "expense").reduce<Record<string, number>>((totals, row) => { totals[row.category] = (totals[row.category] ?? 0) + Number(row.amount); return totals; }, {});
  return {
    userId: user.id,
    snapshot: {
      monthLabel: new Intl.DateTimeFormat("es-MX", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${today}T12:00:00Z`)),
      monthIncome: sum(month, "income"),
      monthExpenses: sum(month, "expense"),
      balance: rows.reduce((total, row) => total + (row.type === "income" ? Number(row.amount) : row.type === "expense" ? -Number(row.amount) : 0), Number(settings?.opening_balance ?? 0)),
      topCategories: Object.entries(byCategory).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([category, amount]) => ({ category, amount })),
      recent: rows.slice(0, 15).map((row) => ({ ...row, amount: Number(row.amount) })),
      todayExpenses: sum(rows.filter((row) => row.date === today), "expense"),
      weekExpenses: sum(rows.filter((row) => row.date >= weekStart), "expense"),
    },
  };
}

export async function askWalleto(message: string, history: ChatTurn[], drafts: DraftMovement[]): Promise<BrainResult> {
  const today = cancunToday();
  const text = String(message ?? "").slice(0, 600);
  const safeDrafts = Array.isArray(drafts) ? drafts.slice(0, 12) : [];
  const safeHistory = Array.isArray(history) ? history.filter((turn) => turn && (turn.role === "user" || turn.role === "assistant") && typeof turn.text === "string").slice(-14) : [];
  const { userId, snapshot } = await loadSnapshot(today);
  if (!userId) return { reply: "Tu sesión expiró. Vuelve a entrar para seguir.", drafts: safeDrafts, suggestions: [], insights: [], mode: "local" };
  const ai = await askClaude(text, safeHistory, safeDrafts, today, snapshot);
  return ai ?? localBrain(text, safeDrafts, today, snapshot);
}

export async function saveChatMovements(drafts: DraftMovement[]): Promise<{ ok: boolean; count: number; message?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, count: 0, message: "Tu sesión expiró. Vuelve a entrar." };
  const today = cancunToday();
  const list = Array.isArray(drafts) ? drafts.slice(0, 12) : [];
  const valid = list.filter((draft) => {
    if (!draftIsComplete(draft)) return false;
    const options = draft.type === "income" ? incomeCategories : expenseCategories;
    const parsed = new Date(`${draft.date}T12:00:00Z`);
    return ["income", "expense"].includes(draft.type) && Number.isFinite(draft.amount) && (draft.amount ?? 0) <= 999999999999.99 && draft.description.length <= 160 && options.includes(draft.category) && draft.date <= today && parsed.toISOString().slice(0, 10) === draft.date;
  });
  if (!valid.length || valid.length !== list.length) return { ok: false, count: 0, message: "Revisa los datos: hay un movimiento incompleto." };
  const { error } = await supabase.from("transactions").insert(valid.map((draft) => ({
    user_id: user.id,
    date: draft.date,
    type: draft.type,
    amount: Math.round((draft.amount ?? 0) * 100) / 100,
    category: draft.category,
    description: draft.description.trim(),
    necessity: "necessary",
    scope: "personal",
  })));
  if (error) return { ok: false, count: 0, message: "No pude guardarlo. Inténtalo de nuevo." };
  revalidatePath("/dashboard");
  revalidatePath("/registrar");
  return { ok: true, count: valid.length };
}
