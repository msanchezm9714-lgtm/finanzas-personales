import type { SVGProps } from "react";

/** Set de iconos lineales Walleto · trazo fino estilo HUD. */
const paths = {
  wallet: <><path d="M3.5 7.5h15a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z"/><path d="M3.5 7.5 15 4.2a1.5 1.5 0 0 1 1.9 1.4v1.9"/><path d="M15.5 13.5h5"/><circle cx="16.5" cy="13.5" r=".9" fill="currentColor"/></>,
  income: <><path d="M6 18 18 6"/><path d="M9 6h9v9"/><path d="M4 21h4" opacity=".5"/></>,
  expense: <><path d="M6 6l12 12"/><path d="M18 9v9H9"/><path d="M16 3h4" opacity=".5"/></>,
  transfer: <><path d="M4 8h14l-3.5-3.5"/><path d="M20 16H6l3.5 3.5"/></>,
  pulse: <><path d="M3 12h4l2.2-5 3.6 10 2.2-5H21"/><circle cx="21" cy="12" r=".9" fill="currentColor"/></>,
  calendar: <><rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/><path d="M8 14h2M14 14h2M8 17h2" opacity=".6"/></>,
  debt: <><path d="M9.5 14.5 7 17a3.2 3.2 0 0 1-4.5-4.5L5 10"/><path d="M14.5 9.5 17 7a3.2 3.2 0 0 1 4.5 4.5L19 14"/><path d="m9 15 6-6" strokeDasharray="2 2"/></>,
  vault: <><rect x="3.5" y="4" width="17" height="15" rx="2"/><circle cx="12" cy="11.5" r="3.5"/><path d="M12 8v1.2M12 13.8V15M8.5 11.5h1.2M14.3 11.5h1.2"/><path d="M6 19v1.5M18 19v1.5"/></>,
  target: <><circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1" fill="currentColor"/><path d="M12 1.5v3M12 19.5v3M1.5 12h3M19.5 12h3"/></>,
  chat: <><path d="M4 5.5h16v10H10l-4.5 3.5v-3.5H4z"/><path d="M8 10.5h.01M12 10.5h.01M16 10.5h.01" strokeWidth="2.4"/></>,
  bot: <><rect x="4.5" y="7.5" width="15" height="11" rx="3"/><path d="M12 4v3.5M9.5 12.5v1M14.5 12.5v1M2.5 12v3M21.5 12v3"/><circle cx="12" cy="3.2" r=".9" fill="currentColor"/></>,
  camera: <><path d="M3.5 8h3.2l1.6-2.5h7.4L17.3 8h3.2v11h-17z"/><circle cx="12" cy="13" r="3.4"/><path d="M17.5 10.5h.01" strokeWidth="2.2"/></>,
  mic: <><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M8.5 21h7"/></>,
  stop: <><rect x="6" y="6" width="12" height="12" rx="2"/></>,
  upload: <><path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 15v4.5h16V15"/></>,
  send: <><path d="M4 12 20 4l-4.5 16-3.8-6.7z"/><path d="m11.7 13.3 4-4"/></>,
  spark: <><path d="M12 2.5v5M12 16.5v5M2.5 12h5M16.5 12h5"/><path d="m12 8 1.3 2.7L16 12l-2.7 1.3L12 16l-1.3-2.7L8 12l2.7-1.3z" fill="currentColor" stroke="none"/></>,
  bolt: <><path d="M13 2.5 5 13.5h6l-1 8 8-11h-6z"/></>,
  menu: <><path d="M4 7h16M4 12h10M4 17h16"/><circle cx="18" cy="12" r=".9" fill="currentColor"/></>,
  logout: <><path d="M14 4.5h4.5v15H14"/><path d="M10 8l-4 4 4 4M6 12h10"/></>,
  plus: <><path d="M12 5v14M5 12h14"/></>,
  check: <><path d="m5 12.5 4.5 4.5L19 7.5"/></>,
  close: <><path d="M6 6l12 12M18 6 6 18"/></>,
  back: <><path d="M15 5l-7 7 7 7"/></>,
  next: <><path d="M9 5l7 7-7 7"/></>,
  arrow: <><path d="M5 19 19 5M8 5h11v11"/></>,
  edit: <><path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/></>,
  refresh: <><path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4.5V11h-6.5"/></>,
  shield: <><path d="M12 3 4.5 6v5.5c0 4.6 3.2 8.3 7.5 9.5 4.3-1.2 7.5-4.9 7.5-9.5V6z"/><path d="m9 12 2.2 2.2L15.5 10"/></>,
  grid: <><rect x="4" y="4" width="6.5" height="6.5" rx="1"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1" opacity=".5"/></>,
  trash: <><path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13"/></>,
  receipt: <><path d="M6 3h12v18l-2-1.4-2 1.4-2-1.4-2 1.4-2-1.4L6 21z"/><path d="M9 8h6M9 12h6M9 16h3"/></>,
  food: <><path d="M6 3v8a2 2 0 0 0 2 2v8M10 3v8a2 2 0 0 1-2 2M8 3v6"/><path d="M17 21V3c-2 1-3.5 3.5-3.5 7v3H17"/></>,
  transport: <><path d="M5 16V8.5a3 3 0 0 1 3-3h8a3 3 0 0 1 3 3V16z"/><path d="M5 12h14M7.5 19v-3M16.5 19v-3"/><circle cx="8.5" cy="14" r=".8" fill="currentColor"/><circle cx="15.5" cy="14" r=".8" fill="currentColor"/></>,
  shopping: <><path d="M5 8h14l-1.2 12H6.2z"/><path d="M9 8V6.5a3 3 0 0 1 6 0V8"/></>,
  services: <><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"/><circle cx="12" cy="12" r="3.5"/></>,
  health: <><path d="M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.5 4.3 4.3 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10z"/><path d="M7 12h2.5l1.2-2 2 4 1.3-2H17"/></>,
  fun: <><rect x="3" y="7" width="18" height="11" rx="3"/><path d="M7.5 11v3M6 12.5h3"/><circle cx="15.5" cy="11.5" r=".9" fill="currentColor"/><circle cx="17.5" cy="13.5" r=".9" fill="currentColor"/></>,
  home: <><path d="M4 11 12 4l8 7v9H4z"/><path d="M10 20v-5h4v5"/></>,
  education: <><path d="M2.5 9 12 4.5 21.5 9 12 13.5z"/><path d="M6.5 11v4.5c1.5 1.5 3.5 2 5.5 2s4-.5 5.5-2V11M21.5 9v5"/></>,
  other: <><circle cx="12" cy="12" r="8.5"/><path d="M8 12h.01M12 12h.01M16 12h.01" strokeWidth="2.4"/></>,
  salary: <><rect x="2.5" y="6.5" width="19" height="11" rx="2"/><circle cx="12" cy="12" r="2.6"/><path d="M6 9.5v5M18 9.5v5"/></>,
  sales: <><path d="M3.5 12.5 11 5h8.5v8.5L12 21z"/><circle cx="15.5" cy="9" r="1.3"/></>,
  refund: <><path d="M4 12a8 8 0 1 0 2.3-5.7"/><path d="M4 4.5V10h5.5"/><path d="M12 8.5v7M10 10h3a1.3 1.3 0 0 1 0 2.6h-2a1.3 1.3 0 0 0 0 2.6h3"/></>,
  gift: <><rect x="3.5" y="9" width="17" height="11" rx="1.5"/><path d="M2.5 9h19v-3h-19zM12 6v14"/><path d="M12 6c-1.5-3-5-3-5 0M12 6c1.5-3 5-3 5 0"/></>,
} as const;

export type IconName = keyof typeof paths;

export function Icon({ name, size = 20, className, ...rest }: { name: IconName; size?: number } & Omit<SVGProps<SVGSVGElement>, "name">) {
  return <svg className={`icon ${className ?? ""}`} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" {...rest}>{paths[name]}</svg>;
}

const categoryIcons: Record<string, IconName> = {
  "Alimentación": "food", Transporte: "transport", Compras: "shopping", Servicios: "services", Salud: "health",
  Entretenimiento: "fun", Vivienda: "home", "Educación": "education", Salario: "salary", Ventas: "sales",
  Reembolso: "refund", Regalo: "gift", Deudas: "debt", Otros: "other",
};

export function categoryIcon(category: string): IconName {
  return categoryIcons[category] ?? "other";
}
