import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Política de privacidad | Finanzas Personales",
  description: "Cómo se tratan los datos de la aplicación Finanzas Personales.",
};

export default function PrivacyPage() {
  return (
    <main className="legal-page">
      <article className="legal-card">
        <a className="legal-brand" href="/">Walleto</a>
        <p className="eyebrow">INFORMACIÓN SOBRE TUS DATOS</p>
        <h1>Política de privacidad</h1>
        <p className="legal-updated">Actualizada el 2 de octubre de 2026</p>

        <section>
          <h2>Quién administra la aplicación</h2>
          <p>Finanzas Personales es una herramienta privada para registrar movimientos de dinero. Para consultas o solicitudes sobre tus datos, escribe a <a href="mailto:Msanchezm9714@gmail.com">Msanchezm9714@gmail.com</a>.</p>
        </section>
        <section>
          <h2>Qué datos se tratan</h2>
          <p>Se utiliza el correo electrónico y la información necesaria para iniciar sesión. La aplicación guarda los movimientos que registras: fecha, importe, tipo, categoría, descripción y las clasificaciones que elijas, además del saldo inicial.</p>
          <p>Cuando escribes en el registro tipo chat del navegador, la aplicación interpreta el texto para extraer el tipo de movimiento, el importe, la categoría y la descripción. Guarda esos datos como un movimiento. La conversación se reconstruye a partir de los movimientos; no se almacena el texto original como historial de chat.</p>
          <p>Si en el futuro se habilita la integración opcional de WhatsApp, la aplicación también recibiría el número del remitente y el texto del mensaje para procesar órdenes autorizadas; de las órdenes reconocidas guardaría los datos del movimiento y el identificador del mensaje para evitar duplicados.</p>
        </section>
        <section>
          <h2>Para qué se usan</h2>
          <p>Los datos se usan para permitir el acceso a tu cuenta, registrar y mostrar tus movimientos y calcular los resúmenes financieros. No se venden ni se usan para publicidad.</p>
        </section>
        <section>
          <h2>Servicios que intervienen</h2>
          <p>Supabase proporciona la autenticación y la base de datos; Vercel aloja la aplicación. El registro tipo chat funciona en el navegador y no requiere enviar mensajes por WhatsApp. Si se habilita la integración opcional de WhatsApp, Meta transmitiría esos mensajes a la aplicación. Cada servicio trata la información que recibe según sus propias políticas.</p>
        </section>
        <section>
          <h2>Acceso y conservación</h2>
          <p>Los movimientos se asocian a la cuenta que los creó y la base de datos limita el acceso a su propietario. Se conservan mientras la cuenta y sus registros sigan activos o hasta que solicites su eliminación.</p>
        </section>
        <section>
          <h2>Tus solicitudes</h2>
          <p>Puedes pedir acceso, corrección o eliminación de los datos guardados por esta aplicación escribiendo a <a href="mailto:Msanchezm9714@gmail.com">Msanchezm9714@gmail.com</a>. Consulta también las <a href="/eliminar-datos">instrucciones para eliminar datos</a>.</p>
        </section>
        <nav className="legal-links" aria-label="Enlaces legales"><a href="/condiciones">Condiciones de uso</a><a href="/eliminar-datos">Eliminar datos</a><a href="/">Inicio</a></nav>
      </article>
    </main>
  );
}
