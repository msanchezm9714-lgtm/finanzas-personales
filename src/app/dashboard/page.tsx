import { redirect } from "next/navigation";
import { createTransaction, saveOpeningBalance, signOut } from "@/app/actions";
import { createClient } from "@/lib/supabase/server";
import { formatDate, formatMoney } from "@/lib/money";

type Transaction = {
  id: string;
  date: string;
  type: "income" | "expense" | "transfer";
  amount: number;
  category: string;
  description: string | null;
  payment_method: string | null;
  necessity: "necessary" | "luxury";
  scope: "personal" | "work";
};

const categories = ["Alimentación", "Vivienda", "Transporte", "Salud", "Entretenimiento", "Servicios", "Educación", "Salario", "Otros"];

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ error?: string; saved?: string }> }) {
  const { error, saved } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/");

  const [{ data, error: dataError }, { data: settings, error: settingsError }] = await Promise.all([
    supabase.from("transactions")
      .select("id,date,type,amount,category,description,payment_method,necessity,scope")
      .order("date", { ascending: false })
      .order("created_at", { ascending: false }),
    supabase.from("user_settings")
      .select("opening_balance")
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);
  const transactions = (data ?? []) as Transaction[];
  const openingBalance = Number(settings?.opening_balance ?? 0);

  const today = new Date();
  const monthStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1)).toISOString().slice(0, 10);
  const monthTransactions = transactions.filter((item) => item.date >= monthStart);
  const total = transactions.reduce((sum, item) => sum + (item.type === "income" ? Number(item.amount) : item.type === "expense" ? -Number(item.amount) : 0), openingBalance);
  const income = monthTransactions.filter((item) => item.type === "income").reduce((sum, item) => sum + Number(item.amount), 0);
  const expenses = monthTransactions.filter((item) => item.type === "expense").reduce((sum, item) => sum + Number(item.amount), 0);
  const freeMoney = income - expenses;
  const categoryTotals = Object.entries(monthTransactions.filter((item) => item.type === "expense").reduce<Record<string, number>>((totals, item) => {
    totals[item.category] = (totals[item.category] ?? 0) + Number(item.amount);
    return totals;
  }, {})).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const maxCategory = categoryTotals[0]?.[1] ?? 1;
  const monthName = new Intl.DateTimeFormat("es-MX", { month: "long", year: "numeric" }).format(today);

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="/dashboard"><span className="brand-mark small" aria-hidden="true"/><span>Walleto</span></a>
        <div className="topbar-right"><span className="avatar">{(user.email?.[0] ?? "T").toUpperCase()}</span><span className="user-email">{user.email}</span><form action={signOut}><button className="text-button" type="submit">Salir</button></form></div>
      </header>
      <div className="dashboard-wrap">
        <div className="welcome-row"><div><p className="eyebrow">TU RESUMEN PERSONAL</p><h1>Tu dinero, en perspectiva.</h1><p className="muted">Cada movimiento cuenta una parte de tu historia.</p></div><div className="welcome-actions"><a className="button button-primary" href="/registrar">+ Registrar gasto</a><div className="month-pill"><span className="status-dot"/> {monthName}</div></div></div>
        {error && <div className="notice error-notice">{error}</div>}{saved && <div className="notice success-notice">{saved === "opening" ? "Saldo inicial guardado correctamente." : "Movimiento guardado correctamente."}</div>}{dataError && <div className="notice error-notice">No se pudieron cargar los movimientos. Revisa la configuración de Supabase.</div>}{settingsError && <div className="notice error-notice">Falta crear la tabla de saldo inicial en Supabase.</div>}
        <section className="summary-grid" aria-label="Resumen financiero">
          <article className="summary-card balance-card"><div className="card-top"><span>Saldo disponible</span><span className="card-icon">◉</span></div><strong>{formatMoney(total)}</strong><p>Saldo inicial + ingresos − gastos</p><div className="balance-line"><span/><span/><span/><span/><span/><span/><span/><span/><span/><span/></div></article>
          <article className="summary-card"><div className="card-top"><span>Ingresos del mes</span><span className="metric-icon income-icon">↗</span></div><strong>{formatMoney(income)}</strong><p className="metric-hint"><i className="positive-dot"/> {monthName}</p></article>
          <article className="summary-card"><div className="card-top"><span>Gastos del mes</span><span className="metric-icon expense-icon">↘</span></div><strong>{formatMoney(expenses)}</strong><p className="metric-hint"><i className="negative-dot"/> {monthName}</p></article>
          <article className="summary-card free-card"><div className="card-top"><span>Dinero libre estimado</span><span className="metric-icon free-icon">✳</span></div><strong>{formatMoney(freeMoney)}</strong><p>Ingresos menos gastos de este mes</p></article>
        </section>
        {!settingsError && <section className="opening-panel">
          <details open={!settings}>
            <summary>{settings ? "Editar saldo inicial" : "Configura tu saldo inicial"}</summary>
            <div className="opening-content">
              <p>Es el dinero que tenías antes del primer movimiento que registrarás aquí. Se suma al saldo disponible y no cuenta como ingreso del mes.</p>
              <form action={saveOpeningBalance} className="opening-form">
                <label>Saldo inicial<input name="opening_balance" type="number" step="0.01" defaultValue={settings ? String(settings.opening_balance) : ""} placeholder="0.00" required /></label>
                <button className="button button-primary" type="submit">Guardar saldo <span>↗</span></button>
              </form>
            </div>
          </details>
        </section>}
        <div className="content-grid">
          <section className="panel transactions-panel">
            <div className="panel-heading"><div><p className="eyebrow">ACTIVIDAD</p><h2>Movimientos recientes</h2></div><span className="count-pill">{transactions.length} total</span></div>
            {transactions.length === 0 ? <div className="empty-state"><div className="empty-icon">↗</div><h3>Tu historia empieza aquí</h3><p>Cuando registres un movimiento, aparecerá en esta lista.</p></div> : <div className="transaction-list">{transactions.slice(0, 10).map((item) => <article className="transaction-row" key={item.id}><div className={`transaction-symbol ${item.type}`}>{item.type === "income" ? "↙" : item.type === "transfer" ? "⇄" : "↗"}</div><div className="transaction-info"><strong>{item.description || item.category}</strong><span>{item.category} · {formatDate(item.date)}{item.payment_method ? ` · ${item.payment_method}` : ""}</span></div><span className={`transaction-amount ${item.type}`}>{item.type === "income" ? "+" : item.type === "expense" ? "−" : ""}{formatMoney(Number(item.amount))}</span></article>)}</div>}
          </section>
          <section className="panel categories-panel"><div className="panel-heading"><div><p className="eyebrow">EN QUÉ SE VA</p><h2>Gastos por categoría</h2></div><span className="subtle-period">Este mes</span></div>{categoryTotals.length === 0 ? <div className="empty-compact"><div className="category-placeholder">◌</div><p>Aún no hay gastos este mes.</p></div> : <div className="category-list">{categoryTotals.map(([category, amount], index) => <div className="category-item" key={category}><div className="category-line"><span><i className={`category-dot dot-${index}`} />{category}</span><strong>{formatMoney(amount)}</strong></div><div className="bar-track"><i className={`bar-fill fill-${index}`} style={{ width: `${Math.max(5, amount / maxCategory * 100)}%` }} /></div></div>)}</div>}<div className="category-footer"><span>Total de gastos</span><strong>{formatMoney(expenses)}</strong></div></section>
        </div>
        <section className="guided-entry-card" aria-label="Registro conversacional"><div><p className="eyebrow">UN GASTO, CUATRO RESPUESTAS</p><h2>Cuéntaselo a Walleto.</h2><p>Te pregunta cuánto fue, en qué lo gastaste y cuándo pasó. También te propone una categoría.</p></div><a className="button button-primary" href="/registrar">Empezar conversación ↗</a></section>
        <details className="advanced-entry" id="nuevo-movimiento"><summary>¿Necesitas registrar un ingreso, transferencia o más detalles? <strong>Abrir registro avanzado ↗</strong></summary><section className="panel form-panel"><div className="panel-heading"><div><p className="eyebrow">REGISTRO AVANZADO</p><h2>Nuevo movimiento</h2></div></div><form action={createTransaction} className="transaction-form">
          <label>Tipo de movimiento<select name="type" defaultValue="expense"><option value="expense">Gasto</option><option value="income">Ingreso</option><option value="transfer">Transferencia</option></select></label>
          <label>Monto<input name="amount" type="number" min="0.01" step="0.01" placeholder="0.00" required /></label>
          <label>Fecha<input name="date" type="date" defaultValue={today.toISOString().slice(0, 10)} required /></label>
          <label>Categoría<select name="category" defaultValue="Alimentación">{categories.map((category) => <option key={category}>{category}</option>)}</select></label>
          <label>Descripción<input name="description" type="text" placeholder="¿En qué consistió?" /></label>
          <label>Método de pago<select name="payment_method" defaultValue=""><option value="">Seleccionar</option><option>Efectivo</option><option>Débito</option><option>Crédito</option><option>Transferencia</option><option>Otro</option></select></label>
          <fieldset><legend>¿Cómo lo clasificarías?</legend><div className="choice-row"><label><input type="radio" name="necessity" value="necessary" defaultChecked /><span>Necesario</span></label><label><input type="radio" name="necessity" value="luxury" /><span>Lujo</span></label></div></fieldset>
          <fieldset><legend>Ámbito</legend><div className="choice-row"><label><input type="radio" name="scope" value="personal" defaultChecked /><span>Personal</span></label><label><input type="radio" name="scope" value="work" /><span>Trabajo</span></label></div></fieldset>
          <div className="form-actions"><p>Tu información se guarda de forma privada en tu cuenta.</p><button className="button button-primary" type="submit">Guardar movimiento <span>↗</span></button></div>
        </form></section></details>
        <footer className="app-footer"><span>Walleto <i>·</i> claridad financiera, a tu ritmo.</span><nav className="login-legal-links" aria-label="Información legal"><a href="/privacidad">Privacidad</a><a href="/condiciones">Condiciones</a><a href="/eliminar-datos">Eliminar datos</a></nav></footer>
      </div>
      <a className="quick-entry-fab" href="/registrar" aria-label="Registrar un gasto">+ Anotar gasto</a>
    </main>
  );
}
