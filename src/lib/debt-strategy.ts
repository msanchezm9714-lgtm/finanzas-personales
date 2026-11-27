// Motor "Plan para salir de deudas": bola de nieve vs avalancha.
// Se paga el mínimo de cada deuda y todo lo que sobra del presupuesto va a una deuda prioritaria.
// Cuando una deuda se liquida, su mínimo queda libre y se suma al siguiente objetivo (efecto bola de nieve).
// Supuestos: tasa anual nominal (la del estado de cuenta) ÷ 12, pagos mínimos fijos y sin deudas nuevas.

export type Strategy = "avalanche" | "snowball" | "minimum";

export type StrategyDebt = {
  id: string;
  title: string;
  balance: number;
  annualRate: number;
  minPayment: number;
  rateEstimated: boolean;
  minEstimated: boolean;
};

export type StrategyResult = {
  strategy: Strategy;
  finished: boolean;
  months: number;
  totalInterest: number;
  totalPaid: number;
  order: string[];
  payoffMonth: Record<string, number>;
  balances: number[];
  firstMonth: Record<string, number>;
};

export const MAX_MONTHS = 600;
const cents = (value: number) => Math.round(value * 100) / 100;

export function monthlyRate(annualRate: number) {
  return annualRate / 100 / 12;
}

/** Pago mínimo estimado cuando el usuario no lo registró: intereses del mes + 3% del capital. */
export function estimatedMinPayment(balance: number, annualRate: number) {
  return Math.max(1, Math.ceil(balance * (monthlyRate(annualRate) + 0.03)));
}

export function priorityOrder(debts: StrategyDebt[], strategy: Strategy) {
  const list = [...debts];
  if (strategy === "snowball") list.sort((a, b) => a.balance - b.balance || b.annualRate - a.annualRate);
  else list.sort((a, b) => b.annualRate - a.annualRate || a.balance - b.balance);
  return list.map((debt) => debt.id);
}

export function minimumTotal(debts: StrategyDebt[]) {
  return cents(debts.reduce((sum, debt) => sum + Math.min(debt.minPayment, debt.balance * (1 + monthlyRate(debt.annualRate))), 0));
}

export function simulate(debts: StrategyDebt[], budget: number, strategy: Strategy): StrategyResult {
  const order = priorityOrder(debts, strategy);
  const byId = new Map(debts.map((debt) => [debt.id, debt]));
  const balance = new Map(debts.map((debt) => [debt.id, debt.balance]));
  const payoffMonth: Record<string, number> = {};
  const firstMonth: Record<string, number> = {};
  const balances = [cents(debts.reduce((sum, debt) => sum + debt.balance, 0))];
  let totalInterest = 0;
  let totalPaid = 0;
  let month = 0;

  const remaining = () => [...balance.values()].reduce((sum, value) => sum + value, 0);

  while (remaining() > 0.004 && month < MAX_MONTHS) {
    month += 1;
    const paidThisMonth = new Map<string, number>();
    // 1. Intereses del mes.
    for (const [id, value] of balance) {
      if (value <= 0) continue;
      const interest = cents(value * monthlyRate(byId.get(id)!.annualRate));
      totalInterest += interest;
      balance.set(id, cents(value + interest));
    }
    // 2. Pago mínimo en todas.
    let spent = 0;
    for (const [id, value] of balance) {
      if (value <= 0) continue;
      const pay = cents(Math.min(byId.get(id)!.minPayment, value));
      balance.set(id, cents(value - pay));
      paidThisMonth.set(id, pay);
      spent += pay;
    }
    // 3. Lo que sobra va a la deuda prioritaria (y si se liquida, a la siguiente).
    let extra = strategy === "minimum" ? 0 : cents(budget - spent);
    for (const id of order) {
      if (extra <= 0) break;
      const value = balance.get(id)!;
      if (value <= 0) continue;
      const pay = cents(Math.min(extra, value));
      balance.set(id, cents(value - pay));
      paidThisMonth.set(id, cents((paidThisMonth.get(id) ?? 0) + pay));
      extra = cents(extra - pay);
    }
    for (const [id, pay] of paidThisMonth) {
      totalPaid += pay;
      if (month === 1) firstMonth[id] = pay;
      if (balance.get(id)! <= 0.004 && payoffMonth[id] === undefined) payoffMonth[id] = month;
    }
    balances.push(cents(remaining()));
  }

  return {
    strategy,
    finished: remaining() <= 0.004,
    months: month,
    totalInterest: cents(totalInterest),
    totalPaid: cents(totalPaid),
    order,
    payoffMonth,
    balances,
    firstMonth,
  };
}
