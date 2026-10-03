import { notFound, redirect } from "next/navigation";
import { AppHeader } from "@/app/components/app-header";
import { createClient } from "@/lib/supabase/server";
import { formatDate, formatMoney } from "@/lib/money";
import { adjustMoneyPot, createDebt, createMoneyPot, createPlannedPayment, recordDebtPayment } from "../actions";
import { PaymentRow } from "../payment-row";

type Payment = { id: string; title: string; amount: number; due_date: string; category: string; paid_at: string | null };
type Debt = { id: string; title: string; original_amount: number; remaining_amount: number; due_date: string | null };
type Pot = { id: string; title: string; kind: "envelope" | "goal"; allocated: number; target_amount: number | null };
type Section = "pagos" | "deudas" | "apartados" | "metas";

const sectionCopy: Record<Section, { eyebrow: string; title: string; intro: string }> = {
  pagos: { eyebrow: "TU CALENDARIO", title: "Próximos pagos", intro: "Anota lo que debes pagar, mira cuándo vence y márcalo cuando esté listo." },
  deudas: { eyebrow: "PASO A PASO", title: "Tus deudas", intro: "Ten claro lo que falta y registra cada abono sin perder el hilo." },
  apartados: { eyebrow: "DINERO CON DESTINO", title: "Apartados", intro: "Separa mentalmente dinero para renta, servicios, transporte o lo que viene." },
  metas: { eyebrow: "LO QUE VIENE", title: "Metas de ahorro", intro: "Dale nombre a lo que quieres lograr y mira cómo avanzas." },
};

function Empty({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="plan-empty"><span aria-hidden="true">✳</span><h2>{title}</h2><p>{children}</p></div>;
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="plan-field"><span>{label}</span>{children}</label>;
}

function PaymentSection({ items, debts, today }: { items: Payment[]; debts: Debt[]; today: string }) {
  const pending = items.filter((item) => !item.paid_at);
  const paid = items.filter((item) => item.paid_at);
  const soon = new Date(`${today}T12:00:00Z`);
  soon.setUTCDate(soon.getUTCDate() + 30);
  const cutoff = soon.toISOString().slice(0, 10);
  const dueSoon = pending.filter((item) => item.due_date <= cutoff).reduce((sum, item) => sum + Number(item.amount), 0);
  return <>
    <div className="plan-stat-row"><div className="plan-stat featured"><span>Aparta para los próximos 30 días</span><strong>{formatMoney(dueSoon)}</strong><small>Incluye pagos vencidos y los que llegan pronto.</small></div><div className="plan-stat"><span>Pendientes</span><strong>{pending.length}</strong><small>{paid.length} completados</small></div></div>
    <section className="plan-card"><div className="plan-card-head"><div><p className="eyebrow">A LA VISTA</p><h2>Pagos por hacer</h2></div><span className="count-pill">{pending.length}</span></div>
      {pending.length ? <div className="payment-table"><div className="payment-table-head"><span>Concepto</span><span>Vence</span><span>Monto</span><span>Estado</span></div>{pending.map((item) => <PaymentRow key={item.id} payment={item} />)}</div> : <Empty title="Todo al día">Agrega un pago y aparecerá aquí hasta que lo completes.</Empty>}
    </section>
    <section className="plan-card plan-form-card"><div><p className="eyebrow">EN UN MOMENTO</p><h2>Añadir un pago</h2><p>Solo necesitas concepto, monto y fecha. Puedes añadir más después.</p></div><form action={createPlannedPayment} className="plan-form">
      <FormField label="¿Qué vas a pagar?"><input name="title" placeholder="Ej. Internet, renta o luz" maxLength={100} required /></FormField>
      <FormField label="¿Cuánto?"><input name="amount" type="number" min="0.01" step="0.01" placeholder="0.00" required /></FormField>
      <FormField label="¿Cuándo vence?"><input name="due_date" type="date" defaultValue={today} required /></FormField>
      <FormField label="Categoría"><select name="category" defaultValue="Servicios"><option>Servicios</option><option>Vivienda</option><option>Transporte</option><option>Salud</option><option>Educación</option><option>Alimentación</option><option>Deudas</option><option>Otros</option></select></FormField>
      {debts.some((debt) => Number(debt.remaining_amount) > 0) && <FormField label="¿Es un abono a una deuda?"><select name="debt_id" defaultValue=""><option value="">No, es otro pago</option>{debts.filter((debt) => Number(debt.remaining_amount) > 0).map((debt) => <option value={debt.id} key={debt.id}>{debt.title} · {formatMoney(Number(debt.remaining_amount))} restantes</option>)}</select></FormField>}
      <button className="button button-primary" type="submit">Guardar pago ↗</button>
    </form></section>
    {paid.length > 0 && <section className="plan-card"><div className="plan-card-head"><div><p className="eyebrow">BIEN HECHO</p><h2>Ya completados</h2></div><span className="count-pill">{paid.length}</span></div><div className="payment-table">{paid.map((item) => <PaymentRow key={item.id} payment={item} />)}</div></section>}
  </>;
}

function DebtSection({ items }: { items: Debt[] }) {
  const remaining = items.reduce((sum, item) => sum + Number(item.remaining_amount), 0);
  return <>
    <div className="plan-stat-row"><div className="plan-stat featured"><span>Saldo pendiente de tus deudas</span><strong>{formatMoney(remaining)}</strong><small>Esta cifra no se descuenta completa del disponible para usar.</small></div><div className="plan-stat"><span>Deudas activas</span><strong>{items.filter((item) => Number(item.remaining_amount) > 0).length}</strong><small>Un abono reduce tu saldo registrado.</small></div></div>
    <section className="plan-card"><div className="plan-card-head"><div><p className="eyebrow">TU AVANCE</p><h2>Deudas anotadas</h2></div><span className="count-pill">{items.length}</span></div>
      {items.length ? <div className="debt-list">{items.map((item) => { const original = Number(item.original_amount); const left = Number(item.remaining_amount); const progress = Math.max(0, Math.min(100, (original - left) / original * 100)); return <article className="debt-item" key={item.id}><div className="debt-top"><div><h3>{item.title}</h3><small>{item.due_date ? `Fecha objetivo: ${formatDate(item.due_date)}` : "Sin fecha límite"}</small></div><strong>{left === 0 ? "Liquidada ✓" : `${formatMoney(left)} pendientes`}</strong></div><div className="plan-progress"><span style={{ width: `${progress}%` }} /></div><p>{formatMoney(original - left)} abonados de {formatMoney(original)}</p>{left > 0 && <form action={recordDebtPayment} className="inline-plan-form"><input type="hidden" name="id" value={item.id} /><label>Registrar abono<input name="amount" type="number" min="0.01" max={left} step="0.01" placeholder="Monto" required /></label><label className="already-recorded"><input type="checkbox" name="already_recorded" />Ya lo anoté como gasto</label><button className="plan-small-button" type="submit">Abonar ↗</button></form>}</article>; })}</div> : <Empty title="Empieza con una deuda">Anota el monto que queda por pagar. Puedes indicar si un abono ya está registrado como gasto.</Empty>}
    </section>
    <section className="plan-card plan-form-card"><div><p className="eyebrow">TODO CLARO</p><h2>Añadir una deuda</h2><p>Anota cuánto falta por pagar hoy. La fecha es opcional.</p></div><form action={createDebt} className="plan-form"><FormField label="Nombre"><input name="title" placeholder="Ej. Tarjeta o préstamo" maxLength={100} required /></FormField><FormField label="Monto pendiente"><input name="amount" type="number" min="0.01" step="0.01" placeholder="0.00" required /></FormField><FormField label="Fecha objetivo (opcional)"><input name="due_date" type="date" /></FormField><button className="button button-primary" type="submit">Guardar deuda ↗</button></form></section>
  </>;
}

function PotSection({ items, kind }: { items: Pot[]; kind: "envelope" | "goal" }) {
  const total = items.reduce((sum, item) => sum + Number(item.allocated), 0);
  const isGoal = kind === "goal";
  return <>
    <div className="plan-stat-row"><div className="plan-stat featured"><span>{isGoal ? "Ahorro asignado a metas" : "Dinero en apartados"}</span><strong>{formatMoney(total)}</strong><small>Es parte de tu saldo registrado; no es un gasto ni una transferencia bancaria.</small></div><div className="plan-stat"><span>{isGoal ? "Metas" : "Apartados"}</span><strong>{items.length}</strong><small>Muévelos cuando tus planes cambien.</small></div></div>
    <section className="plan-card"><div className="plan-card-head"><div><p className="eyebrow">{isGoal ? "A TU RITMO" : "YA TIENE DESTINO"}</p><h2>{isGoal ? "Tus metas" : "Tus apartados"}</h2></div><span className="count-pill">{items.length}</span></div>
      {items.length ? <div className="pot-grid">{items.map((item) => { const allocated = Number(item.allocated); const target = Number(item.target_amount ?? 0); const progress = target ? Math.min(100, allocated / target * 100) : 0; return <article className="pot-item" key={item.id}><div className="pot-icon" aria-hidden="true">{isGoal ? "✦" : "◈"}</div><h3>{item.title}</h3><strong>{formatMoney(allocated)}</strong>{isGoal && <><small>de {formatMoney(target)}</small><div className="plan-progress"><span style={{ width: `${progress}%` }} /></div><p>{Math.round(progress)}% de tu meta</p></>}<form action={adjustMoneyPot} className="pot-adjust-form"><input type="hidden" name="id" value={item.id} /><input type="hidden" name="kind" value={kind} /><label className="sr-only" htmlFor={`amount-${item.id}`}>Monto para {item.title}</label><input id={`amount-${item.id}`} name="amount" type="number" min="0.01" step="0.01" placeholder="Monto" required /><select name="direction" aria-label="Tipo de movimiento"><option value="add">Apartar</option><option value="release">Liberar</option></select><button className="plan-small-button" type="submit">Mover ↗</button></form></article>; })}</div> : <Empty title={isGoal ? "Una meta empieza con un nombre" : "Dale destino a tu dinero"}>{isGoal ? "Puede ser un viaje, un fondo de emergencia o algo que te entusiasme." : "Crea un apartado para renta, servicios, transporte o cualquier plan."}</Empty>}
    </section>
    <section className="plan-card plan-form-card"><div><p className="eyebrow">{isGoal ? "TU PRÓXIMO LOGRO" : "UN NUEVO ESPACIO"}</p><h2>{isGoal ? "Crear una meta" : "Crear un apartado"}</h2><p>Solo apunta el nombre y, si quieres, una cantidad inicial.</p></div><form action={createMoneyPot} className="plan-form"><input type="hidden" name="kind" value={kind} /><FormField label="¿Para qué es?"><input name="title" list="pot-suggestions" placeholder={isGoal ? "Ej. Viaje o fondo de emergencia" : "Ej. Renta o transporte"} maxLength={100} required /><datalist id="pot-suggestions">{(isGoal ? ["Fondo de emergencia", "Viaje", "Nuevo celular", "Estudios"] : ["Renta", "Servicios", "Transporte", "Comida"]).map((name) => <option value={name} key={name} />)}</datalist></FormField>{isGoal && <FormField label="¿Cuánto quieres reunir?"><input name="target_amount" type="number" min="0.01" step="0.01" placeholder="0.00" required /></FormField>}<FormField label="Cantidad inicial (opcional)"><input name="initial" type="number" min="0" step="0.01" placeholder="0.00" /></FormField><button className="button button-primary" type="submit">{isGoal ? "Crear meta" : "Crear apartado"} ↗</button></form></section>
  </>;
}

export default async function PlanningPage({ params, searchParams }: { params: Promise<{ section: string }>; searchParams: Promise<{ error?: string; saved?: string }> }) {
  const [{ section }, query] = await Promise.all([params, searchParams]);
  if (!Object.prototype.hasOwnProperty.call(sectionCopy, section)) notFound();
  const selected = section as Section;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/");

  const todayParts = new Intl.DateTimeFormat("en-US", { timeZone: "America/Cancun", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const dateValues = Object.fromEntries(todayParts.map(({ type, value }) => [type, value]));
  const today = `${dateValues.year}-${dateValues.month}-${dateValues.day}`;
  let payments: Payment[] = [];
  let debts: Debt[] = [];
  let pots: Pot[] = [];
  let dataError = false;
  if (selected === "pagos") {
    const [{ data, error }, { data: debtData, error: debtError }] = await Promise.all([
      supabase.from("planned_payments").select("id,title,amount,due_date,category,paid_at").eq("user_id", user.id).order("due_date", { ascending: true }),
      supabase.from("debts").select("id,title,original_amount,remaining_amount,due_date").eq("user_id", user.id),
    ]);
    payments = (data ?? []) as Payment[];
    debts = (debtData ?? []) as Debt[];
    dataError = Boolean(error || debtError);
  } else if (selected === "deudas") {
    const { data, error } = await supabase.from("debts").select("id,title,original_amount,remaining_amount,due_date").eq("user_id", user.id).order("created_at", { ascending: false });
    debts = (data ?? []) as Debt[];
    dataError = Boolean(error);
  } else {
    const { data, error } = await supabase.from("money_pots").select("id,title,kind,allocated,target_amount").eq("user_id", user.id).eq("kind", selected === "metas" ? "goal" : "envelope").order("created_at", { ascending: false });
    pots = (data ?? []) as Pot[];
    dataError = Boolean(error);
  }
  const copy = sectionCopy[selected];
  return <main className="app-shell"><AppHeader email={user.email} /><div className="dashboard-wrap plan-wrap"><div className="plan-hero"><a href="/dashboard" className="plan-back">← Mi panel</a><p className="eyebrow">{copy.eyebrow}</p><h1>{copy.title}</h1><p>{copy.intro}</p></div>
    {query.error && <div className="notice error-notice" role="alert">{query.error}</div>}{query.saved && <div className="notice success-notice">{query.saved === "abono" ? "Abono registrado. Tu panel ya refleja el movimiento." : "Listo, los cambios quedaron guardados."}</div>}{dataError && <div className="notice error-notice" role="alert">No pudimos cargar esta sección. Falta aplicar la migración de planificación en Supabase.</div>}
    {!dataError && (selected === "pagos" ? <PaymentSection items={payments} debts={debts} today={today} /> : selected === "deudas" ? <DebtSection items={debts} /> : <PotSection items={pots} kind={selected === "metas" ? "goal" : "envelope"} />)}
    <footer className="app-footer"><span>Walleto <i>·</i> claridad financiera, a tu ritmo.</span><a href="/dashboard">Volver a mi panel ↗</a></footer>
  </div></main>;
}
