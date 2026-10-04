const months = [
  "Ene", "Feb", "Mar", "Abr", "May", "Jun",
  "Jul", "Ago", "Sep", "Oct", "Nov", "Dic",
];

export function DateField({ label, today, optional = false }: { label: string; today: string; optional?: boolean }) {
  const [year, month, day] = optional ? ["", "", ""] : today.split("-");
  const currentYear = Number(today.slice(0, 4));

  return <div className="plan-field">
    <span>{label}</span>
    <div className="plan-date-parts">
      <select name="due_day" aria-label="Día" defaultValue={day} required={!optional}>
        <option value="">Día</option>
        {Array.from({ length: 31 }, (_, index) => {
          const value = String(index + 1).padStart(2, "0");
          return <option value={value} key={value}>{index + 1}</option>;
        })}
      </select>
      <select name="due_month" aria-label="Mes" defaultValue={month} required={!optional}>
        <option value="">Mes</option>
        {months.map((name, index) => {
          const value = String(index + 1).padStart(2, "0");
          return <option value={value} key={value}>{name}</option>;
        })}
      </select>
      <select name="due_year" aria-label="Año" defaultValue={year} required={!optional}>
        <option value="">Año</option>
        {Array.from({ length: 31 }, (_, index) => currentYear - 10 + index).map((value) => <option value={value} key={value}>{value}</option>)}
      </select>
    </div>
  </div>;
}
