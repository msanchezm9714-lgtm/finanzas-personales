"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { createGuidedExpense, createQuickMovement } from "@/app/actions";
import { formatMoney } from "@/lib/money";

type Movement = {
  id: string;
  type: "income" | "expense" | "transfer";
  amount: number;
  category: string;
  description: string | null;
  created_at: string;
};
type Step = "amount" | "description" | "category" | "date" | "review";
const categories = ["Alimentación", "Transporte", "Compras", "Servicios", "Salud", "Entretenimiento", "Vivienda", "Educación", "Otros"];

function suggestCategory(value: string) {
  const text = value.toLocaleLowerCase("es-MX").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const rules: [string, RegExp][] = [
    ["Alimentación", /cafe|comida|desayuno|almuerzo|cena|super|mercado|restaurante|taco|pizza|pan|verdura|fruta/],
    ["Transporte", /uber|didi|taxi|gasolina|combustible|bus|camion|metro|transporte|estacionamiento/],
    ["Servicios", /internet|luz|agua|telefono|celular|recarga|electricidad|gas|suscripcion/],
    ["Salud", /farmacia|medicina|medico|doctor|consulta|dentista|hospital/],
    ["Vivienda", /renta|alquiler|hipoteca|casa|departamento/],
    ["Educación", /libro|curso|escuela|colegiatura|universidad/],
    ["Entretenimiento", /cine|concierto|juego|fiesta|streaming|netflix/],
    ["Compras", /ropa|zapatos|regalo|tienda|amazon|compra/],
  ];
  return rules.find(([, pattern]) => pattern.test(text))?.[0] ?? "Otros";
}

function showDate(date: string) {
  return new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`));
}

function yesterday(today: string) {
  const date = new Date(`${today}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

export function GuidedChat({ movements, historyError, saved, error, today }: { movements: Movement[]; historyError: boolean; saved: boolean; error?: string; today: string }) {
  const [step, setStep] = useState<Step>("amount");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [date, setDate] = useState(today);
  const [otherDate, setOtherDate] = useState(false);
  const [draft, setDraft] = useState("");
  const [inlineError, setInlineError] = useState("");
  const [quickMode, setQuickMode] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    if (step === "amount" || step === "description") inputRef.current?.focus();
  }, [step, quickMode, otherDate]);

  function advance(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setInlineError("");
    if (step === "amount") {
      const value = Number(draft.replace(",", ".").replace(/[^\d.]/g, ""));
      if (!Number.isFinite(value) || value <= 0 || value > 999999999999.99 || !/^\d+(?:[.,]\d{1,2})?$/.test(draft.trim())) {
        setInlineError("Escribe un monto válido, por ejemplo 25 o 25.50.");
        return;
      }
      setAmount(String(value));
      setDraft("");
      setStep("description");
    } else if (step === "description") {
      const value = draft.trim();
      if (!value || value.length > 160) {
        setInlineError("Cuéntame en pocas palabras en qué lo gastaste.");
        return;
      }
      setDescription(value);
      setCategory(suggestCategory(value));
      setDraft("");
      setStep("category");
    }
  }

  function pickDate(value: string) {
    setDate(value);
    setOtherDate(false);
    setInlineError("");
    setStep("review");
  }

  return (
    <main className="chat-page">
      <section className="chat-shell" aria-label="Registrar un gasto con Walleto">
        <header className="chat-header">
          <div className="chat-identity"><span className="chat-avatar" aria-hidden="true"/><div><strong>Walleto</strong><small><i /> Tu espacio privado</small></div></div>
          <a className="chat-dashboard-link" href="/dashboard">Mi panel <span aria-hidden="true">↗</span></a>
        </header>

        <div className="chat-scroll guided-scroll" ref={scrollRef}>
          <div className="chat-flow">
            <div className="chat-day">Un gasto a la vez ✦</div>
            {historyError && <div className="chat-alert" role="alert">No pude cargar tus movimientos recientes.</div>}
            {movements.length > 0 && <details className="chat-history"><summary>Ver mis últimos movimientos</summary><div className="chat-history-list">{movements.slice(0, 3).map((item) => <div className="chat-history-item" key={item.id}><span>{item.description || item.category}</span><strong>{item.type === "expense" ? "−" : item.type === "income" ? "+" : ""}{formatMoney(Number(item.amount))}</strong></div>)}</div></details>}
            {saved && <div className="chat-message assistant-message chat-confirmation" role="status"><span className="chat-sparkle">✦</span><p>¡Listo! Ya quedó guardado. ¿Anotamos otro?</p></div>}
            {error && <div className="chat-message assistant-message chat-error" role="alert"><p>{error === "formato" ? "No entendí el atajo. Prueba con «Gasto 25 comida café»." : error === "datos" ? "Revisa los datos del gasto e inténtalo de nuevo." : "No pude guardarlo. Inténtalo otra vez."}</p></div>}
            <div className="chat-message assistant-message"><span className="chat-sparkle">✦</span><p>Te ayudo a apuntarlo en un momento.</p><p>¿Cuánto gastaste?</p></div>
            {amount && <><div className="chat-message user-message guided-answer">{formatMoney(Number(amount))}</div><div className="chat-message assistant-message"><p>¿En qué te lo gastaste?</p></div></>}
            {description && <><div className="chat-message user-message guided-answer">{description}</div><div className="chat-message assistant-message"><p>Yo lo pondría en <strong>{category}</strong>. ¿Te parece?</p></div></>}
            {step === "category" && <div className="guided-options" aria-label="Elegir categoría"><button className="guided-chip recommended" type="button" onClick={() => setStep("date")}>Sí, {category} ↗</button><details className="category-picker"><summary>Elegir otra</summary><div className="guided-options">{categories.filter((item) => item !== category).map((item) => <button className="guided-chip" key={item} type="button" onClick={() => { setCategory(item); setStep("date"); }}>{item}</button>)}</div></details></div>}
            {(step === "date" || step === "review") && <><div className="chat-message user-message guided-answer">{category}</div><div className="chat-message assistant-message"><p>¿Fue hoy o algún día anterior?</p></div></>}
            {step === "date" && <div className="guided-options"><button className="guided-chip recommended" type="button" onClick={() => pickDate(today)}>Hoy</button><button className="guided-chip" type="button" onClick={() => pickDate(yesterday(today))}>Ayer</button><button className="guided-chip" type="button" onClick={() => setOtherDate(true)}>Otra fecha</button>{otherDate && <div className="guided-date"><label htmlFor="expense-date">Elige el día</label><input id="expense-date" type="date" max={today} value={date} onChange={(event) => setDate(event.target.value)} /><button className="guided-chip recommended" type="button" disabled={!date || date > today} onClick={() => pickDate(date)}>Continuar ↗</button></div>}</div>}
            {step === "review" && <><div className="chat-message user-message guided-answer">{date === today ? "Hoy" : date === yesterday(today) ? "Ayer" : showDate(date)}</div><div className="chat-message assistant-message"><p>Así queda tu gasto. ¿Lo guardo?</p></div><div className="guided-review"><span>GASTO</span><strong>{formatMoney(Number(amount))}</strong><p>{description}</p><small>{category} · {showDate(date)}</small><form action={createGuidedExpense}><input type="hidden" name="amount" value={amount} /><input type="hidden" name="description" value={description} /><input type="hidden" name="category" value={category} /><input type="hidden" name="date" value={date} /><button className="guided-save" type="submit">Guardar gasto ↗</button></form><button className="guided-edit" type="button" onClick={() => { setStep("amount"); setAmount(""); setDescription(""); setCategory(""); setDate(today); }}>Empezar de nuevo</button></div></>}
            {inlineError && <div className="chat-alert" role="alert">{inlineError}</div>}
          </div>
        </div>

        <div className="chat-composer-wrap guided-composer-wrap">
          {quickMode ? <><p className="chat-composer-hint">Atajo: «Gasto 25 comida café» o «Ingreso 500 salario»</p><form action={createQuickMovement} className="chat-composer"><label className="sr-only" htmlFor="quick-message">Escribe tu movimiento</label><input id="quick-message" name="message" type="text" maxLength={300} placeholder="Escribe todo en una línea…" required /><button type="submit" aria-label="Guardar movimiento">↑</button></form></> : (step === "amount" || step === "description") ? <form className="chat-composer" onSubmit={advance}><label className="sr-only" htmlFor="guided-input">{step === "amount" ? "¿Cuánto gastaste?" : "¿En qué lo gastaste?"}</label><input ref={inputRef} id="guided-input" type="text" inputMode={step === "amount" ? "decimal" : "text"} autoComplete="off" maxLength={step === "amount" ? 18 : 160} placeholder={step === "amount" ? "Ej. 25" : "Ej. comida y café"} value={draft} onChange={(event) => setDraft(event.target.value)} /><button type="submit" aria-label="Continuar">↑</button></form> : <p className="guided-next-hint">{step === "review" ? "Confirma el resumen para guardarlo." : "Toca una opción para continuar."}</p>}
          <button className="quick-mode-toggle" type="button" onClick={() => { setQuickMode(!quickMode); setInlineError(""); }}>{quickMode ? "← Volver a la conversación" : "⚡ Prefiero escribirlo en una línea"}</button>
          <p className="chat-privacy">Solo tú puedes ver los movimientos de tu cuenta.</p>
        </div>
      </section>
    </main>
  );
}
