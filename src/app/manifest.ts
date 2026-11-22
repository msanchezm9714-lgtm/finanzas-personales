import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Walleto — Finanzas personales",
    short_name: "Walleto",
    description: "Registra tus gastos e ingresos en un espacio privado.",
    start_url: "/registrar",
    scope: "/",
    display: "standalone",
    background_color: "#05060d",
    theme_color: "#05060d",
    icons: [{ src: "/icon.png?v=4", sizes: "1254x1254", type: "image/png" }],
  };
}
