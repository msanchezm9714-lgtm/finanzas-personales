"use client";

import { useEffect, useRef } from "react";

/** Fondo animado: horizonte con rejilla en perspectiva, partículas y neblina neón. */
export function CyberBackdrop() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let width = 0; let height = 0; let frame = 0; let raf = 0;
    const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
    const particles = Array.from({ length: 46 }, () => ({ x: Math.random(), y: Math.random(), z: 0.3 + Math.random() * 0.7, hue: Math.random() }));

    const resize = () => {
      width = window.innerWidth; height = window.innerHeight;
      canvas.width = Math.round(width * ratio); canvas.height = Math.round(height * ratio);
      canvas.style.width = `${width}px`; canvas.style.height = `${height}px`;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
    };

    const draw = () => {
      const t = frame / 60;
      context.clearRect(0, 0, width, height);
      const scroll = window.scrollY;
      const horizon = height * 0.62 - Math.min(scroll * 0.15, height * 0.25);

      // Rejilla del suelo en perspectiva
      const lines = 16;
      context.lineWidth = 1;
      for (let index = 1; index <= lines; index++) {
        const p = ((index + (t * 0.35) % 1) / lines);
        const y = horizon + Math.pow(p, 2.2) * (height - horizon + 120);
        if (y < horizon) continue;
        context.strokeStyle = `rgba(60, 242, 255, ${0.02 + p * 0.12})`;
        context.beginPath(); context.moveTo(0, y); context.lineTo(width, y); context.stroke();
      }
      const center = width / 2;
      for (let index = -14; index <= 14; index++) {
        const spread = index / 14;
        context.strokeStyle = `rgba(196, 243, 108, ${0.035 + (1 - Math.abs(spread)) * 0.06})`;
        context.beginPath(); context.moveTo(center + spread * width * 0.08, horizon); context.lineTo(center + spread * width * 1.6, height + 40); context.stroke();
      }
      // Línea de horizonte
      const glow = context.createLinearGradient(0, 0, width, 0);
      glow.addColorStop(0, "rgba(255, 62, 165, 0)"); glow.addColorStop(0.5, "rgba(255, 62, 165, .55)"); glow.addColorStop(1, "rgba(60, 242, 255, 0)");
      context.strokeStyle = glow; context.lineWidth = 1.2;
      context.beginPath(); context.moveTo(0, horizon); context.lineTo(width, horizon); context.stroke();

      // Partículas flotantes
      for (const particle of particles) {
        if (!reduced) { particle.y -= 0.00022 * particle.z; if (particle.y < -0.02) { particle.y = 1.02; particle.x = Math.random(); } }
        const x = particle.x * width + Math.sin(t * 0.6 + particle.hue * 10) * 14 * particle.z;
        const y = particle.y * height;
        const size = 0.6 + particle.z * 1.4;
        context.fillStyle = particle.hue > 0.66 ? `rgba(255, 62, 165, ${0.25 + particle.z * 0.35})` : particle.hue > 0.33 ? `rgba(60, 242, 255, ${0.25 + particle.z * 0.35})` : `rgba(196, 243, 108, ${0.3 + particle.z * 0.4})`;
        context.fillRect(x, y, size, size);
      }
    };

    const loop = () => { frame++; draw(); raf = requestAnimationFrame(loop); };
    resize(); draw();
    if (!reduced) raf = requestAnimationFrame(loop);
    const onVisibility = () => { cancelAnimationFrame(raf); if (!document.hidden && !reduced) raf = requestAnimationFrame(loop); };
    window.addEventListener("resize", resize);
    document.addEventListener("visibilitychange", onVisibility);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", resize); document.removeEventListener("visibilitychange", onVisibility); };
  }, []);

  return <div className="cyber-backdrop" aria-hidden="true"><canvas ref={canvasRef} /><div className="cyber-aurora" /><div className="cyber-scanlines" /><div className="cyber-noise" /></div>;
}
