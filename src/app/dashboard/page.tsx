import type { CSSProperties } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createTransaction, saveOpeningBalance } from "@/app/actions";
import { AppHeader } from "@/app/components/app-header";
import { Icon, categoryIcon } from "@/app/components/icons";
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

const categories = ["Alimentación", "Vivienda", "Transporte", "Salud", "Entretenimiento", "Servicios", "Educación", "Compras", "Salario", "Ventas", "Otros"];

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ error?: string; saved?: string }> }) {
  const { error, saved } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/");

  const [{ data, error: dataError }, { data: settings, error: settingsError }, { data: planned, error: paymentsError }, { data: pots, error: potsError }] = await Promise.all([
    supabase.from("transactions")
      .select("id,date,type,amount,category,description,payment_method,necessity,scope")
      .eq("user_id", user.id)
      .order("date", { ascending: false })
      .order("created_at", { ascending: false }),
    supabase.from("user_settings")
      .select("opening_balance")
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase.from("planned_payments")
      .select("id,title,amount,due_date,paid_at")
      .eq("user_id", user.id)
      .is("paid_at", null)
      .order("due_date", { ascending: true }),
    supabase.from("money_pots")
      .select("id,kind,allocated")
      .eq("user_id", user.id),
  ]);
  const transactions = (data ?? []) as Transaction[];
  const openingBalance = Number(settings?.opening_balance ?? 0);

  const today = new Date();
  const todayParts = new Intl.DateTimeFormat("en-US", { timeZone: "America/Cancun", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(today);
  const dateValues = Object.fromEntries(todayParts.map(({ type, value }) => [type, value]));
  const todayKey = `${dateValues.year}-${dateValues.month}-${dateValues.day}`;
  const monthStart = `${dateValues.year}-${dateValues.month}-01`;
  const monthTransactions = transactions.filter((item) => item.date >= monthStart);
  const total = transactions.reduce((sum, item) => sum + (item.type === "income" ? Number(item.amount) : item.type === "expense" ? -Number(item.amount) : 0), openingBalance);
  const income = monthTransactions.filter((item) => item.type === "income").reduce((sum, item) => sum + Number(item.amount), 0);
  const expenses = monthTransactions.filter((item) => item.type === "expense").reduce((sum, item) => sum + Number(item.amount), 0);
  const inThirtyDays = new Date(`${todayKey}T12:00:00Z`);
  inThirtyDays.setUTCDate(inThirtyDays.getUTCDate() + 30);
  const cutoff = inThirtyDays.toISOString().slice(0, 10);
  const upcoming = (planned ?? []).filter((item) => item.due_date <= cutoff);
  const upcomingAmount = upcoming.reduce((sum, item) => sum + Number(item.amount), 0);
  const reservedAmount = (pots ?? []).reduce((sum, item) => sum + Number(item.allocated), 0);
  const planningReady = !paymentsError && !potsError;
  const availableForUse = total - upcomingAmount - reservedAmount;
  const categoryTotals = Object.entries(monthTransactions.filter((item) => item.type === "expense").reduce<Record<string, number>>((totals, item) => {
    totals[item.category] = (totals[item.category] ?? 0) + Number(item.amount);
    return totals;
  }, {})).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const maxCategory = categoryTotals[0]?.[1] ?? 1;
  const monthName = new Intl.DateTimeFormat("es-MX", { month: "long", year: "numeric" }).format(today);

  // Pulso de gasto de los últimos 12 días para la gráfica del saldo
  const pulse = Array.from({ length: 12 }, (_, index) => {
    const day = new Date(`${todayKey}T12:00:00Z`);
    day.setUTCDate(day.getUTCDate() - (11 - index));
    const key = day.toISOString().slice(0, 10);
    return transactions.filter((item) => item.date === key && item.type === "expense").reduce((sum, item) => sum + Number(item.amount), 0);
  });
  const pulseMax = Math.max(...pulse, 1);

  return (
    <main className="app-shell">
      <AppHeader email={user.email} current="dashboard" />
      <div className="dashboard-wrap">
        <div className="welcome-row"><div data-reveal="left"><p className="eyebrow">Resumen personal · {todayKey}</p><h1>Tu dinero, <em>en perspectiva.</em></h1><p className="muted">Cada movimiento cuenta una parte de tu historia.</p></div><div className="welcome-actions" data-reveal="right"><a className="button button-primary" href="/registrar"><Icon name="chat" size={17} />Hablar con Walleto</a><div className="month-pill"><span className="status-dot"/> {monthName}</div></div></div>
        {error && <div className="notice error-notice">{error}</div>}{saved && <div className="notice success-notice">{saved === "opening" ? "Saldo inicial guardado correctamente." : "Movimiento guardado correctamente."}</div>}{dataError && <div className="notice error-notice">No se pudieron cargar los movimientos. Revisa la configuración de Supabase.</div>}{settingsError && <div className="notice error-notice">Falta crear la tabla de saldo inicial en Supabase.</div>}{!planningReady && <div className="notice error-notice">Falta activar las nuevas secciones de planificación en Supabase.</div>}
        <section className="summary-grid" aria-label="Resumen financiero">
          <article className="summary-card balance-card hud-card" data-reveal data-tilt><div className="card-top"><span>Saldo disponible</span><span className="card-icon"><Icon name="wallet" size={18} /></span></div><strong data-count={total}>{formatMoney(total)}</strong><p>Saldo inicial + ingresos − gastos</p><div className="balance-line" aria-hidden="true">{pulse.map((value, index) => <span key={index} style={{ height: `${Math.max(8, value / pulseMax * 100)}%`, "--b": index } as CSSProperties} />)}</div></article>
          <article className="summary-card hud-card" data-reveal data-tilt><div className="card-top"><span>Ingresos del mes</span><span className="metric-icon income-icon"><Icon name="income" size={17} /></span></div><strong data-count={income}>{formatMoney(income)}</strong><p className="metric-hint"><i className="positive-dot"/> {monthName}</p></article>
          <article className="summary-card hud-card" data-reveal data-tilt><div className="card-top"><span>Gastos del mes</span><span className="metric-icon expense-icon"><Icon name="expense" size={17} /></span></div><strong data-count={expenses}>{formatMoney(expenses)}</strong><p className="metric-hint"><i className="negative-dot"/> {monthName}</p></article>
          <article className={`summary-card free-card hud-card ${availableForUse < 0 ? "deficit-card" : ""}`} data-reveal data-tilt><div className="card-top"><span>Disponible para usar</span><span className="metric-icon free-icon"><Icon name="pulse" size={17} /></span></div><strong data-count={planningReady ? availableForUse : undefined}>{planningReady ? formatMoney(availableForUse) : "—"}</strong><p>Saldo registrado − pagos próximos − dinero apartado</p></article>
        </section>
        {planningReady && <details className="available-breakdown" data-reveal><summary>¿De dónde sale el disponible? <span>Ver cálculo ↗</span></summary><div className="breakdown-content"><div><span>Saldo registrado</span><strong>{formatMoney(total)}</strong></div><div><span>Pagos pendientes hasta dentro de 30 días</span><strong>− {formatMoney(upcomingAmount)}</strong></div><div><span>Apartados y metas de ahorro</span><strong>− {formatMoney(reservedAmount)}</strong></div><div className="breakdown-total"><span>Disponible para usar</span><strong>{formatMoney(availableForUse)}</strong></div><p>Es una estimación basada en lo que anotas en Walleto. Los abonos a deudas cuentan al pagarlos; el saldo completo de una deuda no se descuenta aquí.</p></div></details>}
        <nav className="planning-shortcuts" aria-label="Planifica tu dinero">
          <Link href="/plan/pagos" className="hud-card" data-reveal><span><Icon name="calendar" size={20} /></span><Icon name="arrow" size={14} className="shortcut-arrow" /><strong>Próximos pagos</strong><small>{planningReady ? `${(planned ?? []).length} pendientes` : "Organiza tus fechas"}</small></Link>
          <Link href="/plan/deudas" className="hud-card" data-reveal><span><Icon name="debt" size={20} /></span><Icon name="arrow" size={14} className="shortcut-arrow" /><strong>Tus deudas</strong><small>Avanza con cada abono</small></Link>
          <Link href="/plan/apartados" className="hud-card" data-reveal><span><Icon name="vault" size={20} /></span><Icon name="arrow" size={14} className="shortcut-arrow" /><strong>Apartados</strong><small>Dinero con destino</small></Link>
          <Link href="/plan/metas" className="hud-card" data-reveal><span><Icon name="target" size={20} /></span><Icon name="arrow" size={14} className="shortcut-arrow" /><strong>Metas de ahorro</strong><small>Ve tu progreso</small></Link>
        </nav>
        {!settingsError && <section className="opening-panel" data-reveal>
          <details open={!settings}>
            <summary>{settings ? "Editar saldo inicial" : "Configura tu saldo inicial"}</summary>
            <div className="opening-content">
              <p>Es el dinero que tenías antes del primer movimiento que registrarás aquí. Se suma al saldo disponible y no cuenta como ingreso del mes.</p>
              <form action={saveOpeningBalance} className="opening-form">
                <label>Saldo inicial<input name="opening_balance" type="number" step="0.01" defaultValue={settings ? String(settings.opening_balance) : ""} placeholder="0.00" required /></label>
                <button className="button button-primary" type="submit">Guardar saldo <Icon name="check" size={16} /></button>
              </form>
            </div>
          </details>
        </section>}
        <div className="content-grid">
          <section className="panel transactions-panel hud-card" data-reveal>
            <div className="panel-heading"><div><p className="eyebrow">Actividad</p><h2>Movimientos recientes</h2></div><span className="count-pill">{transactions.length} total</span></div>
            {transactions.length === 0 ? <div className="empty-state"><div className="empty-icon"><Icon name="spark" size={22} /></div><h3>Tu historia empieza aquí</h3><p>Cuando registres un movimiento, aparecerá en esta lista.</p></div> : <div className="transaction-list">{transactions.slice(0, 10).map((item) => <article className="transaction-row" key={item.id}><div className={`transaction-symbol ${item.type}`}><Icon name={item.type === "transfer" ? "transfer" : categoryIcon(item.category)} size={18} /></div><div className="transaction-info"><strong>{item.description || item.category}</strong><span>{item.category} · {formatDate(item.date)}{item.payment_method ? ` · ${item.payment_method}` : ""}</span></div><span className={`transaction-amount ${item.type}`}>{item.type === "income" ? "+" : item.type === "expense" ? "−" : ""}{formatMoney(Number(item.amount))}</span></article>)}</div>}
          </section>
          <section className="panel categories-panel hud-card" data-reveal><div className="panel-heading"><div><p className="eyebrow">En qué se va</p><h2>Gastos por categoría</h2></div><span className="subtle-period">Este mes</span></div>{categoryTotals.length === 0 ? <div className="empty-compact"><div className="category-placeholder"><Icon name="grid" size={22} /></div><p>Aún no hay gastos este mes.</p></div> : <div className="category-list">{categoryTotals.map(([category, amount], index) => <div className="category-item" key={category}><div className="category-line"><span><Icon name={categoryIcon(category)} size={15} />{category}</span><strong>{formatMoney(amount)}</strong></div><div className="bar-track"><i className={`bar-fill fill-${index}`} style={{ width: `${Math.max(5, amount / maxCategory * 100)}%`, "--i": index } as CSSProperties} /></div></div>)}</div>}<div className="category-footer"><span>Total de gastos</span><strong>{formatMoney(expenses)}</strong></div></section>
        </div>
        <section className="guided-entry-card" aria-label="Registro conversacional" data-reveal="zoom"><div><p className="eyebrow">Copiloto financiero</p><h2>Cuéntaselo a Walleto.</h2><p>Escríbele como le hablarías a alguien: varios gastos de una, correcciones o preguntas como «¿en qué gasto más?». Él arma los movimientos y tú confirmas.</p></div><a className="button button-primary" href="/registrar">Abrir el chat <Icon name="arrow" size={16} /></a></section>
        <details className="advanced-entry" id="nuevo-movimiento" data-reveal><summary>¿Necesitas registrar una transferencia o más detalles? <strong>Abrir registro avanzado <Icon name="next" size={13} /></strong></summary><section className="panel form-panel"><div className="panel-heading"><div><p className="eyebrow">Registro avanzado</p><h2>Nuevo movimiento</h2></div></div><form action={createTransaction} className="transaction-form">
          <label>Tipo de movimiento<select name="type" defaultValue="expense"><option value="expense">Gasto</option><option value="income">Ingreso</option><option value="transfer">Transferencia</option></select></label>
          <label>Monto<input name="amount" type="number" min="0.01" step="0.01" placeholder="0.00" required /></label>
          <label>Fecha<input name="date" type="date" defaultValue={todayKey} required /></label>
          <label>Categoría<select name="category" defaultValue="Alimentación">{categories.map((category) => <option key={category}>{category}</option>)}</select></label>
          <label>Descripción<input name="description" type="text" placeholder="¿En qué consistió?" /></label>
          <label>Método de pago<select name="payment_method" defaultValue=""><option value="">Seleccionar</option><option>Efectivo</option><option>Débito</option><option>Crédito</option><option>Transferencia</option><option>Otro</option></select></label>
          <fieldset><legend>¿Cómo lo clasificarías?</legend><div className="choice-row"><label><input type="radio" name="necessity" value="necessary" defaultChecked /><span>Necesario</span></label><label><input type="radio" name="necessity" value="luxury" /><span>Lujo</span></label></div></fieldset>
          <fieldset><legend>Ámbito</legend><div className="choice-row"><label><input type="radio" name="scope" value="personal" defaultChecked /><span>Personal</span></label><label><input type="radio" name="scope" value="work" /><span>Trabajo</span></label></div></fieldset>
          <div className="form-actions"><p>Tu información se guarda de forma privada en tu cuenta.</p><button className="button button-primary" type="submit">Guardar movimiento <Icon name="check" size={16} /></button></div>
        </form></section></details>
        <footer className="app-footer"><span>WALLETO <i>{"//"}</i> claridad financiera, a tu ritmo.</span><nav className="login-legal-links" aria-label="Información legal"><a href="/privacidad">Privacidad</a><a href="/condiciones">Condiciones</a><a href="/eliminar-datos">Eliminar datos</a></nav></footer>
      </div>
      <a className="quick-entry-fab" href="/registrar" aria-label="Registrar un movimiento"><Icon name="plus" size={16} />Anotar</a>
    </main>
  );
}
