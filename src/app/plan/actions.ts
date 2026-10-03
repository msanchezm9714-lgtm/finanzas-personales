"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const paymentCategories = ["Vivienda", "Servicios", "Transporte", "Salud", "Educación", "Alimentación", "Deudas", "Otros"];

function money(value: FormDataEntryValue | null, allowZero = false) {
  const text = String(value ?? "").trim();
  const amount = Number(text);
  return /^\d+(?:\.\d{1,2})?$/.test(text) && Number.isFinite(amount) &&
    amount <= 999999999999.99 && (allowZero ? amount >= 0 : amount > 0) ? amount : null;
}

function validDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function title(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  return text.length >= 2 && text.length <= 100 ? text : null;
}

function goError(path: string, message: string): never {
  redirect(`${path}?error=${encodeURIComponent(message)}`);
}

function refreshPlanning() {
  for (const path of ["/dashboard", "/plan/pagos", "/plan/deudas", "/plan/apartados", "/plan/metas"]) {
    revalidatePath(path);
  }
}

export async function createPlannedPayment(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/");
  const name = title(formData.get("title"));
  const amount = money(formData.get("amount"));
  const dueDate = String(formData.get("due_date") ?? "");
  const category = String(formData.get("category") ?? "Servicios");
  const debtId = String(formData.get("debt_id") ?? "");
  if (!name || amount === null || !validDate(dueDate) || !paymentCategories.includes(category)) {
    goError("/plan/pagos", "Revisa el concepto, monto y fecha del pago.");
  }
  if (debtId && !uuidPattern.test(debtId)) goError("/plan/pagos", "Deuda vinculada inválida.");
  if (debtId) {
    const { data: debt, error: debtError } = await supabase.from("debts").select("remaining_amount").eq("id", debtId).eq("user_id", user.id).maybeSingle();
    if (debtError || !debt || amount > Number(debt.remaining_amount)) goError("/plan/pagos", "El pago supera el saldo de la deuda vinculada.");
  }
  const { error } = await supabase.from("planned_payments").insert({ user_id: user.id, title: name, amount, due_date: dueDate, category: debtId ? "Deudas" : category, debt_id: debtId || null });
  if (error) goError("/plan/pagos", "No se pudo guardar el pago. Revisa la configuración de la base de datos.");
  refreshPlanning();
  redirect("/plan/pagos?saved=1");
}

export async function completePlannedPayment(id: string, alreadyRecorded: boolean): Promise<{ ok: boolean; message?: string }> {
  if (!uuidPattern.test(id)) return { ok: false, message: "Pago inválido." };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Vuelve a iniciar sesión." };
  const { error } = await supabase.rpc("complete_planned_payment", { p_id: id, p_already_recorded: alreadyRecorded });
  if (error) return { ok: false, message: "No se pudo marcar el pago. Intenta de nuevo." };
  refreshPlanning();
  return { ok: true };
}

export async function createDebt(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/");
  const name = title(formData.get("title"));
  const amount = money(formData.get("amount"));
  const date = String(formData.get("due_date") ?? "");
  if (!name || amount === null || (date && !validDate(date))) goError("/plan/deudas", "Revisa el nombre, monto y fecha de la deuda.");
  const { error } = await supabase.from("debts").insert({ user_id: user.id, title: name, original_amount: amount, remaining_amount: amount, due_date: date || null });
  if (error) goError("/plan/deudas", "No se pudo guardar la deuda. Revisa la configuración de la base de datos.");
  refreshPlanning();
  redirect("/plan/deudas?saved=1");
}

export async function recordDebtPayment(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/");
  const id = String(formData.get("id") ?? "");
  const amount = money(formData.get("amount"));
  if (!uuidPattern.test(id) || amount === null) goError("/plan/deudas", "Revisa el monto del abono.");
  const { error } = await supabase.rpc("record_debt_payment", { p_id: id, p_amount: amount, p_already_recorded: formData.get("already_recorded") === "on" });
  if (error) goError("/plan/deudas", "No se pudo registrar el abono. Revisa que no supere lo pendiente.");
  refreshPlanning();
  redirect("/plan/deudas?saved=abono");
}

export async function createMoneyPot(formData: FormData) {
  const kind = String(formData.get("kind") ?? "");
  const path = kind === "goal" ? "/plan/metas" : "/plan/apartados";
  if (kind !== "goal" && kind !== "envelope") goError(path, "Tipo de espacio inválido.");
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/");
  const name = title(formData.get("title"));
  const initial = money(formData.get("initial") || "0", true);
  const target = kind === "goal" ? money(formData.get("target_amount")) : null;
  if (!name || initial === null || (kind === "goal" && target === null)) goError(path, "Revisa el nombre y los montos.");
  const { error } = await supabase.from("money_pots").insert({ user_id: user.id, kind, title: name, allocated: initial, target_amount: target });
  if (error) goError(path, "No se pudo crear el espacio. Revisa la configuración de la base de datos.");
  refreshPlanning();
  redirect(`${path}?saved=1`);
}

export async function adjustMoneyPot(formData: FormData) {
  const kind = String(formData.get("kind") ?? "");
  const path = kind === "goal" ? "/plan/metas" : "/plan/apartados";
  if (kind !== "goal" && kind !== "envelope") goError(path, "Tipo de espacio inválido.");
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/");
  const id = String(formData.get("id") ?? "");
  const amount = money(formData.get("amount"));
  const direction = String(formData.get("direction") ?? "add");
  if (!uuidPattern.test(id) || amount === null || !["add", "release"].includes(direction)) goError(path, "Revisa el monto.");
  const { error } = await supabase.rpc("adjust_money_pot", { p_id: id, p_delta: direction === "release" ? -amount : amount });
  if (error) goError(path, "No se pudo mover el dinero. Revisa el monto disponible en este espacio.");
  refreshPlanning();
  redirect(`${path}?saved=movimiento`);
}
