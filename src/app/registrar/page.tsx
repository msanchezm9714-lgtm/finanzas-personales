import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createQuickMovement } from "@/app/actions";
import { createClient } from "@/lib/supabase/server";
import { formatMoney } from "@/lib/money";

export const metadata: Metadata = {
  title: "Registrar movimiento — balance",
  description: "Anota gastos e ingresos en una conversación privada.",
  appleWebApp: { capable: true, title: "balance", statusBarStyle: "default" },
};

type RecentMovement = {
  id: string;
  type: "income" | "expense" | "transfer";
  amount: number;
  category: string;
  description: string | null;
  created_at: string;
};

function movementTime(value: string) {
  return new Intl.DateTimeFormat("es-MX", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Cancun",
  }).format(new Date(value));
}

export default async function Registrar({ searchParams }: {
  searchParams: Promise<{ error?: string; guardado?: string }>;
}) {
  const { error, guardado } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/?next=registrar");

  const { data, error: historyError } = await supabase.from("transactions")
    .select("id,type,amount,category,description,created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(12);
  const movements = (data ?? []) as RecentMovement[];

  return (
    <main className="chat-page">
      <section className="chat-shell" aria-label="Registro de movimientos">
        <header className="chat-header">
          <div className="chat-identity">
            <span className="chat-avatar" aria-hidden="true">b<span>✦</span></span>
            <div><strong>balance</strong><small><i /> Tu espacio privado</small></div>
          </div>
          <a className="chat-dashboard-link" href="/dashboard" aria-label="Ver panel financiero">Mi panel <span aria-hidden="true">↗</span></a>
        </header>

        <div className="chat-scroll">
          <div className="chat-flow">
            <div className="chat-day">Tu cuaderno de dinero</div>
            <div className="chat-message assistant-message">
              <span className="chat-sparkle" aria-hidden="true">✦</span>
              <p>Hola. Aquí puedes apuntar tus gastos e ingresos tan fácil como enviar un mensaje.</p>
              <p className="chat-example">Prueba con <strong>Gasto 25 comida café</strong> o <strong>Gasté 25 en café</strong></p>
            </div>

            {historyError && <div className="chat-alert" role="alert">No pude cargar tus movimientos. Inténtalo más tarde.</div>}
            {movements.length > 0 && <div className="chat-day">Movimientos recientes</div>}
            {[...movements].reverse().map((item) => (
              <div className="chat-entry" key={item.id}>
                <div className="chat-message user-message">
                  <span className="chat-entry-kind">{item.type === "income" ? "Ingreso" : item.type === "expense" ? "Gasto" : "Transferencia"}</span>
                  <strong>{formatMoney(Number(item.amount))}</strong>
                  <span className="chat-entry-detail">{item.category}{item.description ? ` · ${item.description}` : ""}</span>
                  <small>{movementTime(item.created_at)} <span aria-hidden="true">✓</span></small>
                </div>
              </div>
            ))}

            {guardado && <div className="chat-message assistant-message chat-confirmation" role="status"><span className="chat-sparkle" aria-hidden="true">✦</span><p>Listo, lo guardé. Ya puedes verlo en tu panel.</p></div>}
            {error === "formato" && <div className="chat-message assistant-message chat-error" role="alert"><span className="chat-sparkle" aria-hidden="true">✦</span><p>No entendí ese mensaje. Prueba con «Gasto 25 comida café» o «Gasté 25 en café».</p></div>}
            {error === "guardar" && <div className="chat-message assistant-message chat-error" role="alert"><span className="chat-sparkle" aria-hidden="true">✦</span><p>No pude guardarlo. Inténtalo de nuevo.</p></div>}
          </div>
        </div>

        <div className="chat-composer-wrap">
          <p className="chat-composer-hint">También puedes escribir: Ingreso 500 salario pago</p>
          <form action={createQuickMovement} className="chat-composer">
            <label className="sr-only" htmlFor="chat-message-input">Escribe un gasto o ingreso</label>
            <input id="chat-message-input" name="message" type="text" inputMode="text" autoCapitalize="sentences" autoComplete="off" maxLength={300} placeholder="Escribe un gasto o ingreso…" required />
            <button type="submit" aria-label="Guardar movimiento"><span aria-hidden="true">↑</span></button>
          </form>
          <p className="chat-privacy">Solo tú puedes ver los movimientos de tu cuenta.</p>
        </div>
      </section>
    </main>
  );
}
