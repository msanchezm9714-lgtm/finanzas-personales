"use client";

import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { createChatMovement } from "@/app/actions";
import { dateFromText, expenseCategories, incomeCategories, nextStep, readChatMessage, suggestCategory, type ChatMovement, type ChatStep } from "@/lib/chat-movement";
import { formatMoney } from "@/lib/money";

type Movement = { id: string; type: "income" | "expense" | "transfer"; amount: number; category: string; description: string | null; created_at: string };
type Message = { id: number; role: "user" | "assistant"; text: string };
const emptyMovement: ChatMovement = { type: null, amount: null, description: "", category: "", date: "" };
const intro = "Hola, soy Walleto. Cuéntame qué movimiento quieres anotar. Por ejemplo: «Gasté 25 en café» o «Recibí 500 de salario».";

function showDate(date: string) {
  return new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`));
}
function yesterday(today: string) {
  const date = new Date(`${today}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}
function promptFor(movement: ChatMovement) {
  const step = nextStep(movement);
  if (step === "type") return "¿Fue un gasto o un ingreso?";
  if (step === "amount") return `¿Cuánto ${movement.type === "income" ? "recibiste" : "gastaste"}?`;
  if (step === "description") return movement.type === "income" ? "¿De dónde vino ese ingreso?" : "¿En qué lo gastaste?";
  if (step === "category") return `Yo lo pondría en «${suggestCategory(movement.description, movement.type ?? "expense")}». ¿Te parece?`;
  if (step === "date") return "¿Fue hoy, ayer o en otra fecha?";
  return `Tengo un ${movement.type === "income" ? "ingreso" : "gasto"} listo. Revisa los datos y dime si lo guardamos.`;
}

export function GuidedChat({ movements, historyError, saved, error, today }: { movements: Movement[]; historyError: boolean; saved: boolean; error?: string; today: string }) {
  const [movement, setMovement] = useState<ChatMovement>(emptyMovement);
  const [messages, setMessages] = useState<Message[]>([{ id: 0, role: "assistant", text: intro }]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState("");
  const [inlineError, setInlineError] = useState("");
  const [otherDate, setOtherDate] = useState(false);
  const [pickedDate, setPickedDate] = useState(today);
  const [recording, setRecording] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recordingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nextId = useRef(1);
  const step = nextStep(movement);
  const categories = movement.type === "income" ? incomeCategories : expenseCategories;

  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }); }, [messages, movement, busy, otherDate]);
  useEffect(() => () => { if (recordingTimerRef.current) clearTimeout(recordingTimerRef.current); streamRef.current?.getTracks().forEach((track) => track.stop()); }, []);

  function addMessage(role: Message["role"], text: string) { setMessages((current) => [...current, { id: nextId.current++, role, text }]); }
  function applyMovement(next: ChatMovement, answer: string, prefix = "") {
    setInlineError("");
    setMovement(next);
    addMessage("user", answer);
    addMessage("assistant", `${prefix}${promptFor(next)}`);
  }
  function sendText(value: string) {
    const text = value.trim();
    if (!text || recording) return;
    setDraft("");
    if (nextStep(movement) === "review") {
      addMessage("user", text);
      addMessage("assistant", "Puedes guardar el resumen o tocar «Corregir» para cambiar algo.");
      return;
    }
    const next = readChatMessage(text, movement, today);
    if (JSON.stringify(next) === JSON.stringify(movement)) {
      addMessage("user", text);
      addMessage("assistant", `No alcancé a entender ese dato. ${promptFor(movement)}`);
      return;
    }
    applyMovement(next, text);
  }
  function chooseDate(value: string, label: string) {
    if (!dateFromText(value, today)) { setInlineError("Elige una fecha válida que no sea futura."); return; }
    setOtherDate(false);
    applyMovement({ ...movement, date: value }, label);
  }
  function reset() {
    setMovement(emptyMovement);
    setMessages([{ id: nextId.current++, role: "assistant", text: intro }]);
    setDraft(""); setInlineError(""); setOtherDate(false);
  }
  function edit(field: ChatStep) {
    const next = { ...movement };
    if (field === "type") { next.type = null; next.category = ""; }
    if (field === "amount") next.amount = null;
    if (field === "description") { next.description = ""; next.category = ""; }
    if (field === "category") next.category = "";
    if (field === "date") next.date = "";
    setMovement(next);
    addMessage("assistant", `Claro, lo cambiamos. ${promptFor(next)}`);
  }

  async function selectPhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; event.target.value = "";
    if (!file) return;
    setInlineError(""); setBusy("Leyendo el recibo en tu celular…");
    try {
      const { readReceiptOnDevice } = await import("@/lib/local-media");
      const receipt = await readReceiptOnDevice(file, today);
      if (!receipt.text.trim()) throw new Error("No pude leer texto en esa foto. Prueba con una imagen más nítida o escríbeme el gasto.");
      const next: ChatMovement = { type: "expense", amount: receipt.amount, description: receipt.description, category: "", date: receipt.date };
      const details = [receipt.amount ? `monto ${formatMoney(receipt.amount)}` : "monto sin identificar", receipt.description ? `concepto «${receipt.description}»` : "concepto sin identificar", receipt.date ? `fecha ${showDate(receipt.date)}` : "fecha sin identificar"].join(", ");
      applyMovement(next, `📷 ${file.name}`, `Leí la foto en este dispositivo: ${details}. `);
    } catch (cause) { setInlineError(cause instanceof Error ? cause.message : "No pude leer la foto. Inténtalo con otra imagen."); }
    finally { setBusy(""); }
  }
  async function processAudio(file: Blob) {
    setInlineError(""); setBusy("Transcribiendo en tu celular. La primera vez puede tardar mientras descarga el modelo…");
    try {
      const { transcribeOnDevice } = await import("@/lib/local-media");
      const text = await transcribeOnDevice(file);
      if (!text) throw new Error("No distinguí palabras en el audio. Puedes repetirlo o escribirlo.");
      sendText(text);
    } catch (cause) { setInlineError(cause instanceof Error ? cause.message : "No pude transcribir el audio en este dispositivo. Puedes escribirlo."); }
    finally { setBusy(""); }
  }
  async function selectAudio(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; event.target.value = "";
    if (file) await processAudio(file);
  }
  async function toggleRecording() {
    if (recording) {
      recorderRef.current?.stop();
      if (recordingTimerRef.current) clearTimeout(recordingTimerRef.current);
      setRecording(false); return;
    }
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setInlineError("Este navegador no permite grabar aquí. Prueba «Subir audio» o escribe el movimiento."); return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mimeType = ["audio/mp4", "audio/webm", "audio/ogg"].find((type) => MediaRecorder.isTypeSupported(type));
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      const chunks: Blob[] = [];
      recorder.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data); };
      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop()); streamRef.current = null; setRecording(false);
        if (chunks.length) void processAudio(new Blob(chunks, { type: recorder.mimeType }));
      };
      recorder.onerror = () => setInlineError("La grabación se interrumpió. Prueba de nuevo.");
      recorderRef.current = recorder; recorder.start(); setRecording(true); setInlineError("");
      recordingTimerRef.current = setTimeout(() => { if (recorder.state === "recording") recorder.stop(); }, 20_000);
    } catch { setInlineError("No pude acceder al micrófono. Revisa el permiso de Chrome o usa «Subir audio»."); }
  }

  return <main className="chat-page"><section className="chat-shell" aria-label="Chat de movimientos con Walleto">
    <header className="chat-header"><div className="chat-identity"><span className="chat-avatar" aria-hidden="true"/><div><strong>Walleto</strong><small><i /> Tu espacio privado</small></div></div><a className="chat-dashboard-link" href="/dashboard">Mi panel <span aria-hidden="true">↗</span></a></header>
    <div className="chat-scroll guided-scroll" ref={scrollRef}><div className="chat-flow">
      <div className="chat-day">Una cosa a la vez ✦</div>
      {historyError && <div className="chat-alert" role="alert">No pude cargar tus movimientos recientes.</div>}
      {movements.length > 0 && <details className="chat-history"><summary>Ver mis últimos movimientos</summary><div className="chat-history-list">{movements.slice(0, 3).map((item) => <div className="chat-history-item" key={item.id}><span>{item.description || item.category}</span><strong>{item.type === "expense" ? "−" : item.type === "income" ? "+" : ""}{formatMoney(Number(item.amount))}</strong></div>)}</div></details>}
      {saved && <div className="chat-message assistant-message chat-confirmation" role="status"><span className="chat-sparkle">✦</span><p>¡Listo! Ya quedó guardado. ¿Anotamos otro?</p></div>}
      {error && <div className="chat-message assistant-message chat-error" role="alert"><p>{error === "datos" ? "Revisa los datos del movimiento e inténtalo otra vez." : "No pude guardarlo. Inténtalo de nuevo."}</p></div>}
      {messages.map((message) => <div className={`chat-message ${message.role === "assistant" ? "assistant-message" : "user-message guided-answer"}`} key={message.id}>{message.role === "assistant" && <span className="chat-sparkle">✦</span>}<p>{message.text}</p></div>)}
      {step === "type" && <div className="guided-options"><button className="guided-chip recommended" type="button" onClick={() => applyMovement({ ...movement, type: "expense" }, "Gasto")}>Gasto</button><button className="guided-chip" type="button" onClick={() => applyMovement({ ...movement, type: "income" }, "Ingreso")}>Ingreso</button></div>}
      {step === "category" && <div className="guided-options" aria-label="Elegir categoría"><button className="guided-chip recommended" type="button" onClick={() => applyMovement({ ...movement, category: suggestCategory(movement.description, movement.type ?? "expense") }, "Sí")}>Sí, {suggestCategory(movement.description, movement.type ?? "expense")} ↗</button><details className="category-picker"><summary>Elegir otra</summary><div className="guided-options">{categories.filter((item) => item !== suggestCategory(movement.description, movement.type ?? "expense")).map((item) => <button className="guided-chip" key={item} type="button" onClick={() => applyMovement({ ...movement, category: item }, item)}>{item}</button>)}</div></details></div>}
      {step === "date" && <div className="guided-options"><button className="guided-chip recommended" type="button" onClick={() => chooseDate(today, "Hoy")}>Hoy</button><button className="guided-chip" type="button" onClick={() => chooseDate(yesterday(today), "Ayer")}>Ayer</button><button className="guided-chip" type="button" onClick={() => setOtherDate(true)}>Otra fecha</button>{otherDate && <div className="guided-date"><label htmlFor="movement-date">Elige el día</label><input id="movement-date" type="date" max={today} value={pickedDate} onChange={(event) => setPickedDate(event.target.value)} /><button className="guided-chip recommended" type="button" disabled={!pickedDate || pickedDate > today} onClick={() => chooseDate(pickedDate, showDate(pickedDate))}>Continuar ↗</button></div>}</div>}
      {step === "review" && <div className="guided-review"><span>{movement.type === "income" ? "INGRESO" : "GASTO"}</span><strong>{formatMoney(movement.amount ?? 0)}</strong><p>{movement.description}</p><small>{movement.category} · {showDate(movement.date)}</small><form action={createChatMovement}><input type="hidden" name="type" value={movement.type ?? ""} /><input type="hidden" name="amount" value={movement.amount ?? ""} /><input type="hidden" name="description" value={movement.description} /><input type="hidden" name="category" value={movement.category} /><input type="hidden" name="date" value={movement.date} /><button className="guided-save" type="submit">Guardar {movement.type === "income" ? "ingreso" : "gasto"} ↗</button></form><div className="chat-edit-row"><button type="button" onClick={() => edit("amount")}>Monto</button><button type="button" onClick={() => edit("description")}>Concepto</button><button type="button" onClick={() => edit("category")}>Categoría</button><button type="button" onClick={() => edit("date")}>Fecha</button></div><button className="guided-edit" type="button" onClick={reset}>Empezar de nuevo</button></div>}
      {busy && <div className="chat-message assistant-message" role="status"><span className="chat-sparkle">✦</span><p>{busy}</p></div>}
      {inlineError && <div className="chat-alert" role="alert">{inlineError}</div>}
    </div></div>
    <div className="chat-composer-wrap guided-composer-wrap"><div className="chat-media-actions"><button type="button" disabled={Boolean(busy) || recording} onClick={() => imageInputRef.current?.click()} aria-label="Adjuntar foto">▧ <span>Foto</span></button><button type="button" className={recording ? "is-recording" : ""} disabled={Boolean(busy)} onClick={() => void toggleRecording()} aria-label={recording ? "Detener grabación" : "Grabar audio"}>{recording ? "■" : "◉"} <span>{recording ? "Detener" : "Grabar"}</span></button><button type="button" disabled={Boolean(busy) || recording} onClick={() => audioInputRef.current?.click()}>＋ <span>Subir audio</span></button></div>
      <input ref={imageInputRef} className="sr-only" type="file" accept="image/*" onChange={(event) => void selectPhoto(event)} aria-label="Elegir foto de recibo" />
      <input ref={audioInputRef} className="sr-only" type="file" accept="audio/*" onChange={(event) => void selectAudio(event)} aria-label="Elegir audio" />
      <form className="chat-composer" onSubmit={(event: FormEvent<HTMLFormElement>) => { event.preventDefault(); sendText(draft); }}><label className="sr-only" htmlFor="chat-input">Mensaje para Walleto</label><input id="chat-input" type="text" autoComplete="off" maxLength={300} placeholder={step === "review" ? "Corrige arriba o guarda el movimiento" : "Escribe tu movimiento…"} value={draft} disabled={Boolean(busy) || recording} onChange={(event) => setDraft(event.target.value)} /><button type="submit" disabled={!draft.trim() || Boolean(busy) || recording} aria-label="Enviar mensaje">↑</button></form>
      <p className="chat-privacy">Audio y foto se procesan en tu dispositivo y se descartan. Primera descarga: voz ~65 MB, foto ~18 MB. Solo se guarda el movimiento que confirmes.</p>
    </div>
  </section></main>;
}
