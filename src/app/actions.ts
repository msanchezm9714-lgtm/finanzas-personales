"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function signIn(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) redirect("/?error=Completa+tu+correo+y+contraseña");

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) redirect(`/?error=${encodeURIComponent("No se pudo iniciar sesión. Revisa tus datos.")}`);
  redirect("/dashboard");
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
