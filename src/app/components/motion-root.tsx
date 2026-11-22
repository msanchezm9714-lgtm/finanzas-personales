"use client";

import { useEffect } from "react";
import { formatMoney } from "@/lib/money";

/**
 * Capa de movimiento global: revela elementos al hacer scroll ([data-reveal]),
 * anima cifras ([data-count]), ilumina tarjetas bajo el cursor (.hud-card)
 * y publica el progreso de scroll en --scroll.
 */
export function MotionRoot() {
  useEffect(() => {
    const root = document.documentElement;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    root.classList.add("motion-ready");

    const countUp = (element: HTMLElement) => {
      if (element.dataset.counted) return;
      element.dataset.counted = "1";
      const target = Number(element.dataset.count);
      if (!Number.isFinite(target) || reduced) return;
      const isMoney = element.dataset.format !== "plain";
      const start = performance.now();
      const duration = 1100 + Math.min(900, Math.log10(Math.abs(target) + 1) * 160);
      const tick = (now: number) => {
        const progress = Math.min(1, (now - start) / duration);
        const eased = 1 - Math.pow(1 - progress, 4);
        const value = target * eased;
        element.textContent = isMoney ? formatMoney(Math.round(value * 100) / 100) : String(Math.round(value));
        if (progress < 1) requestAnimationFrame(tick);
        else element.textContent = isMoney ? formatMoney(target) : String(target);
      };
      requestAnimationFrame(tick);
    };

    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const element = entry.target as HTMLElement;
        element.classList.add("is-in");
        element.querySelectorAll<HTMLElement>("[data-count]").forEach(countUp);
        if (element.dataset.count) countUp(element);
        observer.unobserve(element);
      }
    }, { threshold: 0.12, rootMargin: "0px 0px -6% 0px" });

    const seen = new WeakSet<Element>();
    const register = (scope: ParentNode) => {
      scope.querySelectorAll<HTMLElement>("[data-reveal]:not(.is-in)").forEach((element) => {
        if (seen.has(element)) return;
        seen.add(element);
        const siblings = element.parentElement ? Array.from(element.parentElement.children).filter((child) => (child as HTMLElement).dataset?.reveal !== undefined) : [];
        element.style.setProperty("--i", String(Math.max(0, siblings.indexOf(element))));
        if (reduced) { element.classList.add("is-in"); element.querySelectorAll<HTMLElement>("[data-count]").forEach(countUp); return; }
        observer.observe(element);
      });
    };
    register(document);
    let pending = 0;
    const mutations = new MutationObserver(() => { if (pending) return; pending = requestAnimationFrame(() => { pending = 0; register(document); }); });
    mutations.observe(document.body, { childList: true, subtree: true });

    const onPointer = (event: PointerEvent) => {
      const card = (event.target as HTMLElement | null)?.closest?.<HTMLElement>(".hud-card");
      root.style.setProperty("--px", `${event.clientX}px`);
      root.style.setProperty("--py", `${event.clientY}px`);
      if (!card) return;
      const rect = card.getBoundingClientRect();
      card.style.setProperty("--mx", `${event.clientX - rect.left}px`);
      card.style.setProperty("--my", `${event.clientY - rect.top}px`);
      if (!reduced && card.dataset.tilt !== undefined) {
        const rx = ((event.clientY - rect.top) / rect.height - 0.5) * -5;
        const ry = ((event.clientX - rect.left) / rect.width - 0.5) * 7;
        card.style.setProperty("--rx", `${rx}deg`);
        card.style.setProperty("--ry", `${ry}deg`);
      }
    };
    const onLeave = (event: PointerEvent) => {
      const card = (event.target as HTMLElement | null)?.closest?.<HTMLElement>(".hud-card[data-tilt]");
      if (card && !card.contains(event.relatedTarget as Node)) { card.style.setProperty("--rx", "0deg"); card.style.setProperty("--ry", "0deg"); }
    };
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const max = root.scrollHeight - window.innerHeight;
        root.style.setProperty("--scroll", max > 0 ? (window.scrollY / max).toFixed(4) : "0");
        root.style.setProperty("--scroll-y", `${window.scrollY}`);
        ticking = false;
      });
    };
    window.addEventListener("pointermove", onPointer, { passive: true });
    document.addEventListener("pointerout", onLeave, { passive: true });
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => {
      observer.disconnect(); mutations.disconnect();
      window.removeEventListener("pointermove", onPointer);
      document.removeEventListener("pointerout", onLeave);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  return <div className="scroll-progress" aria-hidden="true" />;
}
