"use client";

import { useRef } from "react";
import { createDebt } from "./actions";
import { DateField } from "./date-field";
import { Icon } from "@/app/components/icons";

export function DebtCreateDialog({ today }: { today: string }) {
  const dialog = useRef<HTMLDialogElement>(null);

  return <>
    <button className="debt-fab" type="button" aria-label="Agregar deuda" onClick={() => dialog.current?.showModal()}><Icon name="plus" size={26} /></button>
    <dialog ref={dialog} className="debt-dialog" onClick={(event) => { if (event.target === dialog.current) dialog.current.close(); }}>
      <div className="debt-dialog-head">
        <div><p className="eyebrow">UN NUEVO COMPROMISO</p><h2>Agregar deuda</h2></div>
        <button className="debt-dialog-close" type="button" aria-label="Cerrar" onClick={() => dialog.current?.close()}><Icon name="close" size={18} /></button>
      </div>
      <p className="debt-dialog-intro">Anota el saldo que debes hoy. Luego podrás planear abonos y ver cómo disminuye.</p>
      <form action={createDebt} className="plan-form debt-create-form">
        <label className="plan-field"><span>Nombre</span><input name="title" placeholder="Ej. Préstamo de Manuel" maxLength={100} required /></label>
        <label className="plan-field"><span>Valor pendiente</span><input name="amount" type="number" inputMode="decimal" min="0.01" step="0.01" placeholder="0.00" required /></label>
        <label className="plan-field"><span>Tasa anual % (opcional)</span><input name="annual_rate" type="number" inputMode="decimal" min="0" max="500" step="0.01" placeholder="Ej. 54.9" /></label>
        <label className="plan-field"><span>Pago mínimo mensual (opcional)</span><input name="min_payment" type="number" inputMode="decimal" min="0.01" step="0.01" placeholder="0.00" /></label>
        <DateField label="Fecha objetivo (opcional)" today={today} optional />
        <label className="plan-field"><span>Etiqueta</span><input name="category" list="debt-labels" placeholder="Ej. Personal o tarjeta" maxLength={40} required /><datalist id="debt-labels"><option value="Personal" /><option value="Tarjeta" /><option value="Préstamo" /><option value="Servicios" /><option value="Otros" /></datalist></label>
        <button className="button button-primary" type="submit">Guardar deuda <Icon name="check" size={16} /></button>
      </form>
      <p className="debt-dialog-note">Agregar una deuda no registra un gasto. Cada abono se registrará cuando confirmes que lo pagaste.</p>
    </dialog>
  </>;
}
