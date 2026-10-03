"use client";

import { useState, useTransition, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { completePlannedPayment } from "./actions";
import { formatDate, formatMoney } from "@/lib/money";

type Payment = { id: string; title: string; amount: number; due_date: string; category: string; paid_at: string | null };

export function PaymentRow({ payment }: { payment: Payment }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [celebrating, setCelebrating] = useState(false);
  const [error, setError] = useState("");
  const paid = Boolean(payment.paid_at) || celebrating;

  function complete(alreadyRecorded: boolean) {
    if (isPending || paid) return;
    setError("");
    startTransition(async () => {
      const result = await completePlannedPayment(payment.id, alreadyRecorded);
      if (!result.ok) { setError(result.message ?? "No se pudo completar."); return; }
      setCelebrating(true);
      window.setTimeout(() => router.refresh(), 1050);
    });
  }

  return <div className={`payment-row ${paid ? "is-paid" : ""} ${celebrating ? "is-celebrating" : ""}`}>
    <div className="payment-name"><span className="payment-check" aria-hidden="true">{paid ? "✓" : "○"}</span><span className="payment-title"><strong>{payment.title}</strong><small>{payment.category}</small></span></div>
    <time dateTime={payment.due_date}>{formatDate(payment.due_date)}</time>
    <strong className="payment-amount">{formatMoney(Number(payment.amount))}</strong>
    <div className="payment-actions">{payment.paid_at ? <span className="paid-badge">Pagado</span> : <>
      <button className="pay-button" type="button" disabled={isPending || paid} onClick={() => complete(false)}>{celebrating ? "¡Hecho!" : isPending ? "Guardando…" : "Ya pagué ✓"}</button>
      <button className="recorded-button" type="button" disabled={isPending || paid} onClick={() => complete(true)}>Ya lo anoté</button>
    </>}</div>
    {celebrating && <div className="confetti" aria-hidden="true">{Array.from({ length: 16 }, (_, index) => {
      const angle = index * Math.PI / 8;
      return <i key={index} style={{ "--dx": `${Math.cos(angle) * 112}px`, "--dy": `${Math.sin(angle) * 80}px`, "--delay": `${index * 16}ms` } as CSSProperties}/>;
    })}</div>}
    {error && <p className="payment-error" role="alert">{error}</p>}
  </div>;
}
