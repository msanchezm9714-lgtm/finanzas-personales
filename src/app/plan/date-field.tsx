"use client";

import { useId, useState } from "react";
import { Icon } from "@/app/components/icons";

const weekdays = ["L", "M", "X", "J", "V", "S", "D"];
const displayDate = new Intl.DateTimeFormat("es", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
const displayMonth = new Intl.DateTimeFormat("es", { month: "long", year: "numeric", timeZone: "UTC" });

function utcDate(year: number, month: number, day: number) {
  return new Date(Date.UTC(year, month, day, 12));
}

function isoDate(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function DateField({ label, today, optional = false }: { label: string; today: string; optional?: boolean }) {
  const id = useId();
  const [selected, setSelected] = useState(optional ? "" : today);
  const [open, setOpen] = useState(false);
  const [visibleMonth, setVisibleMonth] = useState(() => {
    const [year, month] = today.split("-").map(Number);
    return { year, month: month - 1 };
  });
  const { year, month } = visibleMonth;
  const firstWeekday = (utcDate(year, month, 1).getUTCDay() + 6) % 7;
  const daysInMonth = utcDate(year, month + 1, 0).getUTCDate();

  function moveMonth(offset: number) {
    const next = utcDate(year, month + offset, 1);
    setVisibleMonth({ year: next.getUTCFullYear(), month: next.getUTCMonth() });
  }

  function choose(value: string) {
    setSelected(value);
    setOpen(false);
  }

  function toggleCalendar() {
    if (!open) {
      const [selectedYear, selectedMonth] = (selected || today).split("-").map(Number);
      setVisibleMonth({ year: selectedYear, month: selectedMonth - 1 });
    }
    setOpen(!open);
  }

  return <div className="plan-field plan-date-field">
    <span id={`${id}-label`}>{label}</span>
    <input type="hidden" name="due_date" value={selected} />
    <button
      type="button"
      className="plan-date-trigger"
      aria-labelledby={`${id}-label ${id}-value`}
      aria-expanded={open}
      aria-controls={`${id}-calendar`}
      onClick={toggleCalendar}
    >
      <span id={`${id}-value`}>{selected ? displayDate.format(new Date(`${selected}T12:00:00Z`)) : "Seleccionar fecha"}</span>
      <span aria-hidden="true" className="plan-date-icon"><Icon name="calendar" size={19} /></span>
    </button>
    {open && <div className="plan-calendar" id={`${id}-calendar`} role="group" aria-label={`Calendario para ${label.toLowerCase()}`}>
      <div className="plan-calendar-head">
        <button type="button" aria-label="Mes anterior" onClick={() => moveMonth(-1)}><Icon name="back" size={16} /></button>
        <strong>{displayMonth.format(utcDate(year, month, 1))}</strong>
        <button type="button" aria-label="Mes siguiente" onClick={() => moveMonth(1)}><Icon name="next" size={16} /></button>
      </div>
      <div className="plan-calendar-grid plan-calendar-weekdays">
        {weekdays.map((day, index) => <span key={index} aria-hidden="true">{day}</span>)}
      </div>
      <div className="plan-calendar-grid plan-calendar-days">
        {Array.from({ length: firstWeekday }, (_, index) => <span key={`empty-${index}`} />)}
        {Array.from({ length: daysInMonth }, (_, index) => {
          const day = index + 1;
          const value = isoDate(year, month, day);
          return <button key={day} type="button" aria-label={displayDate.format(utcDate(year, month, day))} aria-pressed={value === selected} className={value === today ? "is-today" : ""} onClick={() => choose(value)}>{day}</button>;
        })}
      </div>
      <div className="plan-calendar-actions">
        {optional && <button type="button" onClick={() => choose("")}>Sin fecha</button>}
        <button type="button" onClick={() => choose(today)}>Hoy</button>
      </div>
    </div>}
  </div>;
}
