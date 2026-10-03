import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./brand.css";

export const metadata: Metadata = {
  title: "Walleto — Finanzas personales",
  description: "Un espacio privado para entender cómo se mueve tu dinero.",
};

export const viewport: Viewport = { themeColor: "#002845" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="es"><body>{children}</body></html>;
}
