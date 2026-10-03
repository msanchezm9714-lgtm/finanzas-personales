import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Condiciones de uso | Finanzas Personales",
  description: "Condiciones de uso de la aplicación Finanzas Personales.",
};

export default function TermsPage() {
  return (
    <main className="legal-page">
      <article className="legal-card">
        <a className="legal-brand" href="/">Wallet Cleaner</a>
        <p className="eyebrow">USO DE LA APLICACIÓN</p>
        <h1>Condiciones de uso</h1>
        <p className="legal-updated">Actualizadas el 2 de octubre de 2026</p>
        <section>
          <h2>Servicio</h2>
          <p>Finanzas Personales permite registrar y consultar ingresos, gastos, transferencias y un saldo inicial. Sus resúmenes dependen de la información que se registre y pueden contener errores si los datos son incompletos o incorrectos. No ofrece asesoría financiera.</p>
        </section>
        <section>
          <h2>Acceso</h2>
          <p>La aplicación es de acceso privado. Debes mantener tus credenciales en secreto y utilizar únicamente una cuenta que estés autorizado a usar.</p>
        </section>
        <section>
          <h2>Registro tipo chat</h2>
          <p>El registro desde el navegador interpreta frases breves para crear gastos o ingresos y puede omitir mensajes que no reconozca. Revisa tus movimientos en el panel para confirmar que cada dato quedó registrado correctamente.</p>
        </section>
        <section>
          <h2>Contacto</h2>
          <p>Para consultas sobre la aplicación, escribe a <a href="mailto:Msanchezm9714@gmail.com">Msanchezm9714@gmail.com</a>. El tratamiento de datos se explica en la <a href="/privacidad">política de privacidad</a>.</p>
        </section>
        <nav className="legal-links" aria-label="Enlaces legales"><a href="/privacidad">Política de privacidad</a><a href="/eliminar-datos">Eliminar datos</a><a href="/">Inicio</a></nav>
      </article>
    </main>
  );
}
