import type { Metadata, Viewport } from "next";
import { JetBrains_Mono, Space_Grotesk } from "next/font/google";
import { CyberBackdrop } from "@/app/components/cyber-backdrop";
import { MotionRoot } from "@/app/components/motion-root";
import "./globals.css";
import "./brand.css";
import "./cyber.css";

const display = Space_Grotesk({ subsets: ["latin"], variable: "--font-display", display: "swap" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono", display: "swap" });

export const metadata: Metadata = {
  title: "Walleto — Finanzas personales",
  description: "Un espacio privado para entender cómo se mueve tu dinero.",
};

export const viewport: Viewport = { themeColor: "#05060d" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="es" className={`${display.variable} ${mono.variable}`}><body><CyberBackdrop /><MotionRoot />{children}</body></html>;
}
