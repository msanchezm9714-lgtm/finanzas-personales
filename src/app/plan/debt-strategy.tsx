"use client";

import { useEffect, useMemo, useState } from "react";
import { Icon } from "@/app/components/icons";
import { formatMoney } from "@/lib/money";
import { estimatedMinPayment, minimumTotal, simulate, type Strategy, type StrategyDebt, type StrategyResult } from "@/lib/debt-strategy";
import { scheduleDebtPlan } from "./actions";
import { DateField } from "./date-field";

export type StrategyInput = { id: string; title: string; category: string; remaining: number; reserved: number; annualRate: number | null; minPayment: number | null };

const BUDGET_KEY = "walleto:debt-plan-budget";
const METHOD_KEY = "walleto:debt-plan-method";

const methodCopy: Record<Exclude<Strategy, "minimum">, { name: string; rule: string; pro: string; icon: "bolt" | "target" }> = {
  avalanche: { name: "Avalancha", rule: "Primero la de interés más alto", pro: "Pagas menos intereses", icon: "bolt" },
  snowball: { name: "Bola de nieve", rule: "Primero la más pequeña", pro: "Primera victoria más rápida", icon: "target" },
};

function monthLabel(today: string, offset: number) {
  const [year, month] = today.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1 + offset, 15));
  return new Intl.DateTimeFormat("es-MX", { month: "short", year: "numeric", timeZone: "UTC" }).format(date).replace(".", "");
}

function duration(months: number) {
  if (months < 12) return `${months} ${months === 1 ? "mes" : "meses"}`;
  const years = Math.floor(months / 12);
  const rest = months % 12;
  return `${years} ${years === 1 ? "año" : "años"}${rest ? ` ${rest} m` : ""}`;
}

function compact(value: number) {
  return new Intl.NumberFormat("es-MX", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

function BalanceChart({ series, today }: { series: { key: string; label: string; result: StrategyResult; tone: string; dashed?: boolean }[]; today: string }) {
  const plans = series.filter((item) => item.key !== "minimum");
  const longestPlan = Math.max(...plans.map((item) => item.result.months), 1);
  const span = Math.max(6, Math.ceil(longestPlan * 1.5));
  const top = Math.max(...series.map((item) => Math.max(...item.result.balances.slice(0, span + 1))), 1);
  const width = 640, height = 220, left = 46, right = 10, topPad = 12, bottom = 26;
  const x = (month: number) => left + (month / span) * (width - left - right);
  const y = (value: number) => topPad + (1 - value / top) * (height - topPad - bottom);
  const ticks = [0, Math.round(span / 3), Math.round((span * 2) / 3), span];
  return <figure className="strategy-chart">
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Saldo total de tus deudas mes a mes con cada método">
      {[0, 0.5, 1].map((part) => <g key={part}><line x1={left} x2={width - right} y1={y(top * part)} y2={y(top * part)} className="strategy-grid" /><text x={left - 8} y={y(top * part) + 4} textAnchor="end" className="strategy-axis">{compact(top * part)}</text></g>)}
      {ticks.map((month) => <text key={month} x={x(month)} y={height - 6} textAnchor={month === 0 ? "start" : month === span ? "end" : "middle"} className="strategy-axis">{month === 0 ? "Hoy" : monthLabel(today, month)}</text>)}
      {series.map((item) => {
        const points = item.result.balances.slice(0, span + 1).map((value, month) => `${x(month).toFixed(1)},${y(value).toFixed(1)}`).join(" ");
        return <polyline key={item.key} points={points} fill="none" stroke={item.tone} strokeWidth={item.dashed ? 1.6 : 2.4} strokeDasharray={item.dashed ? "5 5" : undefined} strokeLinejoin="round" className="strategy-line" />;
      })}
      {plans.map((item) => item.result.finished && item.result.months <= span && <circle key={item.key} cx={x(item.result.months)} cy={y(0)} r="4" fill={item.tone} />)}
    </svg>
    <figcaption className="strategy-legend">{series.map((item) => <span key={item.key}><i style={{ background: item.tone, opacity: item.dashed ? 0.7 : 1 }} />{item.label}</span>)}</figcaption>
  </figure>;
}

export function DebtStrategy({ debts, today, termsReady }: { debts: StrategyInput[]; today: string; termsReady: boolean }) {
  const active = useMemo(() => debts.filter((debt) => debt.remaining > 0), [debts]);
  const planDebts: StrategyDebt[] = useMemo(() => active.map((debt) => {
    const annualRate = debt.annualRate ?? 0;
    return {
      id: debt.id,
      title: debt.title,
      balance: debt.remaining,
      annualRate,
      minPayment: debt.minPayment ?? estimatedMinPayment(debt.remaining, annualRate),
      rateEstimated: debt.annualRate === null,
      minEstimated: debt.minPayment === null,
    };
  }), [active]);
  const minimums = minimumTotal(planDebts);
  const suggested = Math.ceil((minimums * 1.25) / 100) * 100;
  const [budgetText, setBudgetText] = useState("");
  const [method, setMethod] = useState<Exclude<Strategy, "minimum">>("avalanche");

  useEffect(() => {
    const savedBudget = window.localStorage.getItem(BUDGET_KEY);
    const savedMethod = window.localStorage.getItem(METHOD_KEY);
    // Restaurar lo que el usuario dejó la última vez (solo existe en el navegador).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (savedBudget) setBudgetText(savedBudget);
    if (savedMethod === "snowball" || savedMethod === "avalanche") setMethod(savedMethod);
  }, []);

  const budget = Number(budgetText || suggested);
  const enough = budget >= minimums;
  const results = useMemo(() => ({
    avalanche: simulate(planDebts, budget, "avalanche"),
    snowball: simulate(planDebts, budget, "snowball"),
    minimum: simulate(planDebts, minimums, "minimum"),
  }), [planDebts, budget, minimums]);

  if (!active.length) return null;

  const chosen = results[method];
  const other = results[method === "avalanche" ? "snowball" : "avalanche"];
  const cheaper = results.avalanche.totalInterest <= results.snowball.totalInterest ? "avalanche" : "snowball";
  const byId = new Map(planDebts.map((debt) => [debt.id, debt]));
  const inputById = new Map(active.map((debt) => [debt.id, debt]));
  const estimated = planDebts.filter((debt) => debt.rateEstimated || debt.minEstimated);
  const savedVsMinimum = results.minimum.finished ? results.minimum.totalInterest - chosen.totalInterest : null;
  const firstTarget = chosen.order.find((id) => (chosen.firstMonth[id] ?? 0) > byId.get(id)!.minPayment + 0.004) ?? chosen.order[0];

  const thisMonth = chosen.order.map((id) => {
    const debt = inputById.get(id)!;
    const planned = chosen.firstMonth[id] ?? 0;
    const free = Math.max(0, Math.round((debt.remaining - debt.reserved) * 100) / 100);
    return { id, title: debt.title, planned, amount: Math.min(planned, free), reserved: debt.reserved, isTarget: id === firstTarget };
  }).filter((row) => row.planned > 0);
  const toSchedule = thisMonth.filter((row) => row.amount > 0);
  const scheduleTotal = toSchedule.reduce((sum, row) => sum + row.amount, 0);

  function chooseMethod(next: Exclude<Strategy, "minimum">) {
    setMethod(next);
    window.localStorage.setItem(METHOD_KEY, next);
  }

  return <section className="plan-card strategy-card" id="plan-deudas" data-reveal>
    <div className="plan-card-head"><div><p className="eyebrow">PLAN PARA SALIR DE DEUDAS</p><h2>Tu ruta para quedar libre</h2></div><span className="count-pill">{active.length} {active.length === 1 ? "deuda" : "deudas"}</span></div>
    <p className="strategy-intro">Pagas el mínimo en todas y todo lo extra va a una sola deuda. Cuando la terminas, lo que pagabas pasa a la siguiente y la cuota crece como bola de nieve.</p>

    <div className="strategy-budget">
      <label className="plan-field"><span>¿Cuánto puedes pagar al mes en total?</span>
        <input type="number" inputMode="decimal" min={0} step="100" value={budgetText} placeholder={String(suggested)} onChange={(event) => { setBudgetText(event.target.value); window.localStorage.setItem(BUDGET_KEY, event.target.value); }} />
      </label>
      <div className="strategy-budget-meta">
        <span>Mínimos: <strong>{formatMoney(minimums)}</strong></span>
        <span className={enough ? "is-extra" : "is-short"}>{enough ? <>Extra para el plan: <strong>{formatMoney(budget - minimums)}</strong></> : <>Te faltan <strong>{formatMoney(minimums - budget)}</strong> para cubrir los mínimos</>}</span>
      </div>
    </div>

    {!enough ? <div className="notice error-notice strategy-warning" role="alert">Con ese presupuesto no alcanzas a cubrir los pagos mínimos. Sube el monto o revisa los mínimos de tus deudas.</div> : <>
      <div className="strategy-methods" role="radiogroup" aria-label="Método para pagar tus deudas">
        {(["avalanche", "snowball"] as const).map((key) => {
          const result = results[key];
          return <button key={key} type="button" role="radio" aria-checked={method === key} className={`strategy-method hud-card ${method === key ? "is-selected" : ""}`} onClick={() => chooseMethod(key)}>
            <span className="strategy-method-head"><Icon name={methodCopy[key].icon} size={18} /> {methodCopy[key].name}{cheaper === key && results.avalanche.totalInterest !== results.snowball.totalInterest && <em>Menos intereses</em>}</span>
            <small>{methodCopy[key].rule} · {methodCopy[key].pro}</small>
            <strong>{result.finished ? `Libre en ${duration(result.months)}` : "Más de 50 años"}</strong>
            <span className="strategy-method-meta">Intereses {formatMoney(Math.round(result.totalInterest))} · {result.finished ? monthLabel(today, result.months) : "—"}</span>
          </button>;
        })}
      </div>

      <div className="plan-stat-row strategy-stats">
        <div className="plan-stat featured hud-card"><span>{savedVsMinimum !== null ? "Te ahorras vs. pagar solo mínimos" : "Pagando solo mínimos"}</span><strong>{savedVsMinimum !== null ? formatMoney(Math.round(Math.max(0, savedVsMinimum))) : "Nunca acabas"}</strong><small>{savedVsMinimum !== null ? `Y terminas ${duration(Math.max(0, results.minimum.months - chosen.months))} antes (solo mínimos: ${duration(results.minimum.months)}).` : "Algún mínimo no cubre ni los intereses del mes: la deuda crece. El plan sí la liquida."}</small></div>
        <div className="plan-stat hud-card"><span>{methodCopy[method].name} vs. {methodCopy[method === "avalanche" ? "snowball" : "avalanche"].name}</span><strong>{formatMoney(Math.round(Math.abs(other.totalInterest - chosen.totalInterest)))}</strong><small>{other.totalInterest > chosen.totalInterest ? "menos de intereses con tu método." : other.totalInterest < chosen.totalInterest ? "más de intereses, a cambio de saldar una deuda antes." : "Misma cantidad de intereses con los dos."}</small></div>
      </div>

      <BalanceChart today={today} series={[
        { key: "minimum", label: "Solo mínimos", result: results.minimum, tone: "var(--magenta)", dashed: true },
        ...[
          { key: "avalanche", label: "Avalancha", result: results.avalanche, tone: "var(--lime)" },
          { key: "snowball", label: "Bola de nieve", result: results.snowball, tone: "var(--cyan)" },
        ].sort((a) => (a.key === method ? 1 : -1)),
      ]} />

      <div className="strategy-route">
        <p className="eyebrow">ORDEN DE ATAQUE · {methodCopy[method].name.toUpperCase()}</p>
        <ol>{chosen.order.map((id, index) => {
          const debt = byId.get(id)!;
          const month = chosen.payoffMonth[id];
          return <li key={id} className={id === firstTarget ? "is-target" : ""}>
            <span className="strategy-step">{String(index + 1).padStart(2, "0")}</span>
            <span className="strategy-route-name"><strong>{debt.title}</strong><small>{formatMoney(debt.balance)} · {debt.rateEstimated ? "tasa sin registrar" : `${debt.annualRate}% anual`} · mínimo {formatMoney(debt.minPayment)}{debt.minEstimated ? " (estimado)" : ""}</small></span>
            <span className="strategy-route-when">{id === firstTarget && <em>Objetivo</em>}{month ? `Libre en ${monthLabel(today, month)}` : "—"}</span>
          </li>;
        })}</ol>
      </div>

      <div className="strategy-month">
        <div><p className="eyebrow">ESTE MES</p><h3>Abonos del plan</h3><p>Se suman a tus futuros pagos. Cuando confirmes cada uno, baja el saldo de la deuda como siempre.</p></div>
        <div className="strategy-month-list">
          {thisMonth.map((row) => <div key={row.id} className={row.isTarget ? "is-target" : ""}>
            <span>{row.title}{row.isTarget && <em>+ extra</em>}</span>
            <strong>{formatMoney(row.amount)}</strong>
            {row.amount < row.planned ? <small>{row.amount === 0 ? "Ya tiene todo el saldo programado" : `Ajustado al saldo libre: ya tienes ${formatMoney(row.reserved)} programados`}</small> : row.reserved > 0 && <small>Ya tienes {formatMoney(row.reserved)} programados aparte para esta deuda</small>}
          </div>)}
          {toSchedule.length > 0 && termsReady ? <form action={scheduleDebtPlan} className="plan-form strategy-schedule-form">
            <input type="hidden" name="plan" value={JSON.stringify(toSchedule.map((row) => ({ debt_id: row.id, amount: row.amount })))} />
            <DateField label="¿Qué día los pagas?" today={today} />
            <button className="button button-primary" type="submit">Programar {formatMoney(scheduleTotal)} <Icon name="calendar" size={16} /></button>
          </form> : <p className="debt-all-planned">{termsReady ? "Todo el saldo de tus deudas ya tiene pagos programados." : "Aplica la migración del plan en Supabase para programar estos abonos."}</p>}
        </div>
      </div>
    </>}

    {estimated.length > 0 && <p className="strategy-note"><Icon name="spark" size={14} /> {estimated.length === 1 ? "Una deuda no tiene" : `${estimated.length} deudas no tienen`} tasa o pago mínimo. Usamos 0 % y un mínimo estimado; complétalos en cada deuda (abajo, “Tasa y pago mínimo”) para un plan exacto.</p>}
    <p className="strategy-disclaimer">Usa la tasa anual de tu estado de cuenta. El cálculo supone pagos fijos y que no tomas deudas nuevas; en tarjetas el mínimo cambia cada mes, así que tómalo como referencia. Es una guía educativa, no asesoría financiera.</p>
  </section>;
}
