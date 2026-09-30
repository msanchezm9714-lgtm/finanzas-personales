import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Eliminar datos | Finanzas Personales",
  description: "Instrucciones para solicitar la eliminación de datos de Finanzas Personales.",
};

export default function DeleteDataPage() {
  return (
    <main className="legal-page">
      <article className="legal-card">
        <a className="legal-brand" href="/">Finanzas Personales</a>
        <p className="eyebrow">CONTROL DE TU INFORMACIÓN</p>
        <h1>Eliminación de datos</h1>
        <p>Para solicitar la eliminación de tu cuenta y de los movimientos guardados en Finanzas Personales, escribe desde el correo asociado a tu cuenta a <a href="mailto:Msanchezm9714@gmail.com?subject=Eliminaci%C3%B3n%20de%20datos%20-%20Finanzas%20Personales">Msanchezm9714@gmail.com</a> con el asunto «Eliminación de datos - Finanzas Personales».</p>
        <p>Indica si deseas eliminar toda la cuenta o movimientos concretos. Se verificará que la solicitud provenga del titular antes de borrar los datos correspondientes en la aplicación y se responderá por correo cuando termine el proceso.</p>
        <p>La eliminación en Finanzas Personales no borra los mensajes conservados por WhatsApp. Puedes administrar esos mensajes desde WhatsApp.</p>
        <nav className="legal-links" aria-label="Enlaces legales"><a href="/privacidad">Política de privacidad</a><a href="/condiciones">Condiciones de uso</a><a href="/">Inicio</a></nav>
      </article>
    </main>
  );
}
