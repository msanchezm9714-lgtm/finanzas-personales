"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { parseMovement } from "@/lib/whatsapp/parse";

export async function signIn(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const destination = formData.get("next") === "registrar" ? "/registrar" : "/dashboard";
  const nextParam = destination === "/registrar" ? "&next=registrar" : "";
  if (!email || !password) redirect(`/?error=${encodeURIComponent("Completa tu correo y contraseña")}${nextParam}`);

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) redirect(`/?error=${encodeURIComponent("No se pudo iniciar sesión. Revisa tus datos.")}${nextParam}`);
  redirect(destination);
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}

export async function saveOpeningBalance(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/");

  const openingBalance = Number(formData.get("opening_balance"));
  if (!Number.isFinite(openingBalance) || Math.abs(openingBalance) > 999999999999.99) {
    redirect("/dashboard?error=Revisa+el+saldo+inicial");
  }

  const { error } = await supabase.from("user_settings").upsert({
    user_id: user.id,
    opening_balance: openingBalance,
    updated_at: new Date().toISOString(),
  }, { onConflict: "user_id" });

  if (error) redirect("/dashboard?error=No+se+pudo+guardar+el+saldo+inicial");
  revalidatePath("/dashboard");
  redirect("/dashboard?saved=opening");
}

export async function createTransaction(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/");

  const amount = Number(formData.get("amount"));
  const date = String(formData.get("date") ?? "");
  const type = String(formData.get("type") ?? "");
  if (!Number.isFinite(amount) || amount <= 0 || !date || !["income", "expense", "transfer"].includes(type)) {
    redirect("/dashboard?error=Revisa+la+fecha%2C+el+tipo+y+el+monto");
  }

  const { error } = await supabase.from("transactions").insert({
    user_id: user.id,
    date,
    type,
    amount,
    category: String(formData.get("category") ?? "Otros"),
    description: String(formData.get("description") ?? "").trim() || null,
    payment_method: String(formData.get("payment_method") ?? "").trim() || null,
    necessity: String(formData.get("necessity") ?? "necessary"),
    scope: String(formData.get("scope") ?? "personal"),
  });

  if (error) redirect("/dashboard?error=No+se+pudo+guardar+el+movimiento");
  revalidatePath("/dashboard");
  redirect("/dashboard?saved=1");
}

export async function createQuickMovement(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/?next=registrar");

  const message = String(formData.get("message") ?? "").trim();
  const movement = message.length <= 300 ? parseMovement(message) : null;
  if (!movement) redirect("/registrar?error=formato");

  const dateParts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Cancun",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const dateValues = Object.fromEntries(dateParts.map(({ type, value }) => [type, value]));
  const date = `${dateValues.year}-${dateValues.month}-${dateValues.day}`;

  const { error } = await supabase.from("transactions").insert({
    user_id: user.id,
    date,
    type: movement.type,
    amount: movement.amount,
    category: movement.category,
    description: movement.description,
    necessity: "necessary",
    scope: "personal",
  });

  if (error) redirect("/registrar?error=guardar");
  revalidatePath("/dashboard");
  revalidatePath("/registrar");
  redirect("/registrar?guardado=1");
}

export async function createGuidedExpense(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/?next=registrar");

  const amountText = String(formData.get("amount") ?? "");
  const amount = Number(amountText);
  const description = String(formData.get("description") ?? "").trim();
  const category = String(formData.get("category") ?? "");
  const date = String(formData.get("date") ?? "");
  const categories = ["Alimentación", "Vivienda", "Transporte", "Salud", "Entretenimiento", "Servicios", "Educación", "Compras", "Otros"];
  const dateParts = new Intl.DateTimeFormat("en-US", { timeZone: "America/Cancun", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const dateValues = Object.fromEntries(dateParts.map(({ type, value }) => [type, value]));
  const today = `${dateValues.year}-${dateValues.month}-${dateValues.day}`;
  const parsedDate = new Date(`${date}T12:00:00Z`);
  const validDate = /^\d{4}-\d{2}-\d{2}$/.test(date) && !Number.isNaN(parsedDate.getTime()) && parsedDate.toISOString().slice(0, 10) === date && date <= today;

  if (!/^\d+(?:\.\d{1,2})?$/.test(amountText) || !Number.isFinite(amount) || amount <= 0 || amount > 999999999999.99 || !description || description.length > 160 || !categories.includes(category) || !validDate) {
    redirect("/registrar?error=datos");
  }

  const { error } = await supabase.from("transactions").insert({
    user_id: user.id,
    date,
    type: "expense",
    amount,
    category,
    description,
    necessity: "necessary",
    scope: "personal",
  });
  if (error) redirect("/registrar?error=guardar");
  revalidatePath("/dashboard");
  revalidatePath("/registrar");
  redirect("/registrar?guardado=1");
}
