import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "balance — Finanzas personales",
  description: "Un espacio privado para entender cómo se mueve tu dinero.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="es"><body>{children}</body></html>;
}
