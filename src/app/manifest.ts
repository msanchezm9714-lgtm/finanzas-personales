import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Wallet Cleaner — Finanzas personales",
    short_name: "Wallet Cleaner",
    description: "Registra tus gastos e ingresos en un espacio privado.",
    start_url: "/registrar",
    scope: "/",
    display: "standalone",
    background_color: "#002845",
    theme_color: "#002845",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
