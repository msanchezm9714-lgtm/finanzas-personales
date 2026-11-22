"use client";

import { useEffect, useRef, useState, useTransition, type ChangeEvent, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { askWalleto, saveChatMovements } from "./brain-actions";
import { Icon, categoryIcon } from "@/app/components/icons";
import { draftIsComplete, type ChatTurn, type DraftMovement, type Insight } from "@/lib/brain-types";
import { expenseCategories, incomeCategories, suggestCategory } from "@/lib/chat-movement";
import { formatMoney } from "@/lib/money";
import { persona } from "@/lib/walleto-persona";

type Movement = { id: string; type: "income" | "expense" | "transfer"; amount: number; category: string; description: string | null; created_at: string };
type Message = { id: number; role: "user" | "assistant"; text: string; insights?: Insight[]; tone?: "error" | "success" };

const starters = ["Gasté 85 en café y 120 de uber", "¿Cómo voy este mes?", "Me pagaron 4 mil del proyecto", "¿En qué gasto más?"];

function showDate(date: string) {
  return new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`));
}

/** Texto que aparece letra a letra (solo el último mensaje del asistente). */
function TypeText({ text, animate }: { text: string; animate: boolean }) {
  const [shown, setShown] = useState(() => animate && typeof window !== "undefined" && !window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : text.length);
  useEffect(() => {
    if (shown >= text.length) return;
    const step = Math.max(1, Math.round(text.length / 70));
    const timer = window.setTimeout(() => setShown((current) => Math.min(text.length, current + step)), 16);
    return () => window.clearTimeout(timer);
  }, [shown, text]);
  return <p>{text.slice(0, shown)}{shown < text.length && <span className="type-caret" aria-hidden="true" />}</p>;
}

export function GuidedChat({ movements, historyError, today, aiOn }: { movements: Movement[]; historyError: boolean; today: string; aiOn: boolean }) {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([{ id: 0, role: "assistant", text: aiOn ? "¿Qué onda, choom? Soy Walleto, tu fixer de eddies. Suéltame varios gastos de un jalón, corrígeme o pregúntame cómo vas." : "¿Qué onda, choom? Soy Walleto, tu fixer de eddies. Dime gastos o gigs cobrados como te salgan («café 45 y uber 120 ayer») o pregúntame cómo vas este mes." }]);
  const [drafts, setDrafts] = useState<DraftMovement[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [draft, setDraft] = useState("");
  const [thinking, setThinking] = useState(false);
  const [busy, setBusy] = useState("");
  const [recording, setRecording] = useState(false);
  const [mode, setMode] = useState<"ai" | "local">(aiOn ? "ai" : "local");
  const [saving, startSaving] = useTransition();
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recordingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nextId = useRef(1);
  const lastAssistant = [...messages].reverse().find((item) => item.role === "assistant")?.id;
  const readyCount = drafts.filter(draftIsComplete).length;
  const allReady = drafts.length > 0 && readyCount === drafts.length;
  const draftTotal = drafts.reduce((sum, item) => sum + (item.type === "income" ? 1 : -1) * (item.amount ?? 0), 0);
  const locked = thinking || Boolean(busy) || recording || saving;

  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }); }, [messages, drafts, thinking, busy]);
  useEffect(() => () => { if (recordingTimerRef.current) clearTimeout(recordingTimerRef.current); streamRef.current?.getTracks().forEach((track) => track.stop()); }, []);
  useEffect(() => { const input = inputRef.current; if (!input) return; input.style.height = "0px"; input.style.height = `${Math.min(140, input.scrollHeight)}px`; }, [draft]);

  function push(message: Omit<Message, "id">) { setMessages((current) => [...current, { ...message, id: nextId.current++ }]); }

  async function send(value: string, fromVoice = false) {
    const text = value.trim();
    if (!text || thinking || saving || (!fromVoice && (busy || recording))) return;
    if (/^guardar( todo)?$/i.test(text) && drafts.length) { save(); return; }
    setDraft(""); setSuggestions([]);
    const history: ChatTurn[] = messages.slice(-14).map(({ role, text: body }) => ({ role, text: body }));
    push({ role: "user", text });
    setThinking(true);
    try {
      const result = await askWalleto(text, history, drafts);
      setMode(result.mode);
      setDrafts(result.drafts);
      setSuggestions(result.suggestions);
      push({ role: "assistant", text: result.reply, insights: result.insights });
    } catch {
      push({ role: "assistant", text: "Se cayó la señal un segundo, choom. ¿Me lo repites?", tone: "error" });
    } finally {
      setThinking(false);
      inputRef.current?.focus();
    }
  }

  function save() {
    if (!allReady || saving) return;
    startSaving(async () => {
      const result = await saveChatMovements(drafts);
      if (!result.ok) { push({ role: "assistant", text: result.message ?? "No pude guardarlo.", tone: "error" }); return; }
      const total = drafts.reduce((sum, item) => sum + (item.amount ?? 0), 0);
      setDrafts([]); setSuggestions(["¿Cómo voy este mes?", "¿En qué gasto más?"]);
      push({ role: "assistant", text: persona.saved(result.count, total), tone: "success" });
      router.refresh();
    });
  }

  function updateDraft(id: string, patch: Partial<DraftMovement>) {
    setDrafts((current) => current.map((item) => {
      if (item.id !== id) return item;
      const next = { ...item, ...patch };
      if (patch.type && patch.type !== item.type) next.category = suggestCategory(next.description, patch.type);
      return next;
    }));
  }

  function onKey(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); void send(draft); }
  }

  async function selectPhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; event.target.value = "";
    if (!file) return;
    setBusy("Escaneando el recibo en tu dispositivo…");
    try {
      const { readReceiptOnDevice } = await import("@/lib/local-media");
      const receipt = await readReceiptOnDevice(file, today);
      if (!receipt.text.trim()) throw new Error("No pude leer texto en esa foto. Prueba con una imagen más nítida o escríbeme el gasto.");
      const description = receipt.description || "Compra con recibo";
      push({ role: "user", text: `Recibo · ${file.name}` });
      setDrafts((current) => [...current, { id: `r${Date.now().toString(36)}`, type: "expense", amount: receipt.amount, description, category: suggestCategory(description, "expense"), date: receipt.date || today }]);
      push({ role: "assistant", text: receipt.amount ? `Leí ${formatMoney(receipt.amount)} en «${description}». Revisa la tarjeta y ajusta lo que haga falta.` : `Leí el recibo pero no encontré el total. Escríbelo en la tarjeta o dímelo aquí.` });
    } catch (cause) { push({ role: "assistant", text: cause instanceof Error ? cause.message : "No pude leer la foto.", tone: "error" }); }
    finally { setBusy(""); }
  }
  async function processAudio(file: Blob) {
    setBusy("Transcribiendo tu voz en el dispositivo… la primera vez descarga el modelo.");
    try {
      const { transcribeOnDevice } = await import("@/lib/local-media");
      const text = await transcribeOnDevice(file);
      if (!text) throw new Error("No distinguí palabras en el audio. Puedes repetirlo o escribirlo.");
      setBusy("");
      await send(text, true);
    } catch (cause) { push({ role: "assistant", text: cause instanceof Error ? cause.message : "No pude transcribir el audio.", tone: "error" }); }
    finally { setBusy(""); }
  }
  async function selectAudio(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; event.target.value = "";
    if (file) await processAudio(file);
  }
  async function toggleRecording() {
    if (recording) { recorderRef.current?.stop(); if (recordingTimerRef.current) clearTimeout(recordingTimerRef.current); setRecording(false); return; }
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") { push({ role: "assistant", text: "Este navegador no permite grabar aquí. Usa «Subir audio» o escríbelo.", tone: "error" }); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mimeType = ["audio/mp4", "audio/webm", "audio/ogg"].find((type) => MediaRecorder.isTypeSupported(type));
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      const chunks: Blob[] = [];
      recorder.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data); };
      recorder.onstop = () => { stream.getTracks().forEach((track) => track.stop()); streamRef.current = null; setRecording(false); if (chunks.length) void processAudio(new Blob(chunks, { type: recorder.mimeType })); };
      recorderRef.current = recorder; recorder.start(); setRecording(true);
      recordingTimerRef.current = setTimeout(() => { if (recorder.state === "recording") recorder.stop(); }, 20_000);
    } catch { push({ role: "assistant", text: "No pude acceder al micrófono. Revisa el permiso del navegador.", tone: "error" }); }
  }

  return <main className="chat-page">
    <section className="chat-shell hud-frame" aria-label="Chat de movimientos con Walleto">
      <header className="chat-header">
        <div className="chat-identity">
          <span className="chat-avatar" aria-hidden="true"><i /></span>
          <div><strong className="glitch" data-text="WALLETO">WALLETO</strong><small><i className={mode === "ai" ? "is-ai" : ""} /> {mode === "ai" ? "IA activa · razonamiento" : "Modo local · privado"}</small></div>
        </div>
        <a className="chat-dashboard-link" href="/dashboard"><Icon name="grid" size={16} /> <span>Mi panel</span></a>
      </header>

      <div className="chat-scroll guided-scroll" ref={scrollRef}><div className="chat-flow" aria-live="polite">
        <div className="chat-day"><span>SESIÓN</span> {showDate(today)} <span>· CIFRADO</span></div>
        {historyError && <div className="chat-alert" role="alert">No pude cargar tus movimientos recientes.</div>}
        {movements.length > 0 && <details className="chat-history"><summary><Icon name="receipt" size={15} /> Últimos movimientos</summary><div className="chat-history-list">{movements.slice(0, 4).map((item) => <div className="chat-history-item" key={item.id}><span><Icon name={categoryIcon(item.category)} size={15} />{item.description || item.category}</span><strong className={item.type}>{item.type === "expense" ? "−" : item.type === "income" ? "+" : ""}{formatMoney(Number(item.amount))}</strong></div>)}</div></details>}

        {messages.map((message) => <div className={`chat-message ${message.role === "assistant" ? "assistant-message" : "user-message"} ${message.tone ? `is-${message.tone}` : ""}`} key={message.id}>
          {message.role === "assistant" && <span className="chat-sparkle"><Icon name={message.tone === "success" ? "check" : message.tone === "error" ? "bolt" : "spark"} size={14} /></span>}
          {message.role === "assistant" ? <TypeText text={message.text} animate={message.id === lastAssistant && message.id !== 0} /> : <p>{message.text}</p>}
          {message.insights && message.insights.length > 0 && <div className="chat-insights">{message.insights.map((insight) => <div key={insight.label} className={`chat-insight tone-${insight.tone ?? "neutral"}`}><small>{insight.label}</small><strong>{insight.value}</strong></div>)}</div>}
        </div>)}

        {messages.length === 1 && !thinking && <div className="guided-options starter-grid">{starters.map((item) => <button key={item} type="button" className="guided-chip" onClick={() => void send(item)}><Icon name="arrow" size={13} />{item}</button>)}</div>}

        {thinking && <div className="chat-message assistant-message chat-thinking" role="status"><span className="chat-sparkle"><Icon name="spark" size={14} /></span><div className="thinking-bars" aria-hidden="true"><i /><i /><i /><i /><i /></div><span className="sr-only">Walleto está pensando</span><small>{mode === "ai" ? "Razonando" : "Analizando"}</small></div>}
        {busy && <div className="chat-message assistant-message chat-thinking" role="status"><span className="chat-sparkle"><Icon name="bolt" size={14} /></span><p>{busy}</p></div>}

        {drafts.length > 0 && <section className="draft-stack" aria-label="Movimientos por guardar">
          <header><span>BORRADOR · {drafts.length} {drafts.length === 1 ? "movimiento" : "movimientos"}</span><strong className={draftTotal >= 0 ? "income" : "expense"}>{draftTotal >= 0 ? "+" : "−"}{formatMoney(Math.abs(draftTotal))}</strong></header>
          {drafts.map((item) => {
            const options = item.type === "income" ? incomeCategories : expenseCategories;
            return <article className={`draft-card ${draftIsComplete(item) ? "is-ready" : "is-missing"}`} key={item.id}>
              <div className="draft-icon"><Icon name={categoryIcon(item.category)} size={20} /></div>
              <div className="draft-body">
                <div className="draft-row">
                  <div className="draft-type" role="group" aria-label="Tipo">
                    <button type="button" aria-pressed={item.type === "expense"} onClick={() => updateDraft(item.id, { type: "expense" })}>Gasto</button>
                    <button type="button" aria-pressed={item.type === "income"} onClick={() => updateDraft(item.id, { type: "income" })}>Ingreso</button>
                  </div>
                  <button type="button" className="draft-remove" aria-label="Quitar movimiento" onClick={() => setDrafts((current) => current.filter((entry) => entry.id !== item.id))}><Icon name="close" size={15} /></button>
                </div>
                <label className="draft-amount"><span className="sr-only">Monto</span><em>$</em><input inputMode="decimal" type="number" min="0.01" step="0.01" placeholder="0.00" value={item.amount ?? ""} onChange={(event) => updateDraft(item.id, { amount: event.target.value ? Number(event.target.value) : null })} /></label>
                <label className="draft-field"><span className="sr-only">Concepto</span><input type="text" maxLength={160} placeholder="Concepto" value={item.description} onChange={(event) => updateDraft(item.id, { description: event.target.value })} /></label>
                <div className="draft-meta">
                  <label><span className="sr-only">Categoría</span><select value={options.includes(item.category) ? item.category : "Otros"} onChange={(event) => updateDraft(item.id, { category: event.target.value })}>{options.map((option) => <option key={option}>{option}</option>)}</select></label>
                  <label><span className="sr-only">Fecha</span><input type="date" max={today} value={item.date} onChange={(event) => updateDraft(item.id, { date: event.target.value })} /></label>
                </div>
              </div>
            </article>;
          })}
          <button className="guided-save" type="button" disabled={!allReady || saving} onClick={save}>
            <span>{saving ? "Guardando…" : allReady ? `Guardar ${drafts.length > 1 ? `${drafts.length} movimientos` : drafts[0].type === "income" ? "ingreso" : "gasto"}` : "Completa los datos marcados"}</span><Icon name={saving ? "refresh" : "check"} size={18} className={saving ? "spin" : ""} />
          </button>
        </section>}

        {suggestions.length > 0 && !thinking && <div className="guided-options">{suggestions.map((item) => <button key={item} type="button" className={`guided-chip ${/^guardar/i.test(item) ? "recommended" : ""}`} disabled={/^guardar/i.test(item) && !allReady} onClick={() => /^guardar/i.test(item) ? save() : void send(item)}>{item}</button>)}</div>}
      </div></div>

      <div className="chat-composer-wrap">
        <div className="chat-media-actions">
          <button type="button" disabled={locked} onClick={() => imageInputRef.current?.click()}><Icon name="camera" size={16} /><span>Recibo</span></button>
          <button type="button" className={recording ? "is-recording" : ""} disabled={thinking || Boolean(busy) || saving} onClick={() => void toggleRecording()} aria-label={recording ? "Detener grabación" : "Grabar audio"}><Icon name={recording ? "stop" : "mic"} size={16} /><span>{recording ? "Detener" : "Voz"}</span>{recording && <i className="rec-wave" aria-hidden="true"><b /><b /><b /></i>}</button>
          <button type="button" disabled={locked} onClick={() => audioInputRef.current?.click()}><Icon name="upload" size={16} /><span>Audio</span></button>
        </div>
        <input ref={imageInputRef} className="sr-only" type="file" accept="image/*" onChange={(event) => void selectPhoto(event)} aria-label="Elegir foto de recibo" />
        <input ref={audioInputRef} className="sr-only" type="file" accept="audio/*" onChange={(event) => void selectAudio(event)} aria-label="Elegir audio" />
        <form className="chat-composer" onSubmit={(event) => { event.preventDefault(); void send(draft); }}>
          <label className="sr-only" htmlFor="chat-input">Mensaje para Walleto</label>
          <textarea id="chat-input" ref={inputRef} rows={1} autoComplete="off" maxLength={600} placeholder="Escribe un gasto, un ingreso o una pregunta…" value={draft} disabled={recording} onChange={(event) => setDraft(event.target.value)} onKeyDown={onKey} />
          <button type="submit" disabled={!draft.trim() || locked} aria-label="Enviar mensaje"><Icon name="send" size={19} /></button>
        </form>
        <p className="chat-privacy"><Icon name="shield" size={12} /> {mode === "ai" ? "El texto se analiza con Claude (Anthropic). Audio y fotos se procesan en tu dispositivo. Solo se guarda lo que confirmes." : "Todo se procesa en tu dispositivo. Solo se guarda lo que confirmes."}</p>
      </div>
    </section>
  </main>;
}
