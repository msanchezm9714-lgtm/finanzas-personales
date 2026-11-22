import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { aiEnabled } from "@/lib/walleto-ai";
import { GuidedChat } from "./guided-chat";

export const metadata: Metadata = {
  title: "Registrar movimiento — Walleto",
  description: "Anota gastos e ingresos en una conversación privada.",
  appleWebApp: { capable: true, title: "Walleto", statusBarStyle: "default" },
};

type RecentMovement = {
  id: string;
  type: "income" | "expense" | "transfer";
  amount: number;
  category: string;
  description: string | null;
  created_at: string;
};

export default async function Registrar() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/?next=registrar");

  const { data, error: historyError } = await supabase.from("transactions")
    .select("id,type,amount,category,description,created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(12);
  const movements = (data ?? []) as RecentMovement[];
  const dateParts = new Intl.DateTimeFormat("en-US", { timeZone: "America/Cancun", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const dateValues = Object.fromEntries(dateParts.map(({ type, value }) => [type, value]));
  const today = `${dateValues.year}-${dateValues.month}-${dateValues.day}`;
  return <GuidedChat movements={movements} historyError={Boolean(historyError)} today={today} aiOn={aiEnabled()} />;
}
