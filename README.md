# Wallet Cleaner — finanzas personales

MVP privado para registrar ingresos, gastos y transferencias. La base de datos es la fuente de verdad y la hoja de cálculo queda como exportación futura.

## Arquitectura

- **Next.js App Router**: interfaz y operaciones del servidor en un solo proyecto.
- **Supabase Auth + PostgreSQL**: autenticación y movimientos en el mismo proveedor. Row Level Security (RLS) limita cada movimiento a su propietario incluso si se consulta la API directamente.
- **Vercel**: alojamiento del proyecto Next.js.

No hay ORM, servicio de analítica ni proveedor de gráficos adicional. Los resúmenes se calculan a partir de los movimientos guardados. Las transferencias se conservan en el historial y no cambian el saldo neto total.

Los dos servicios tienen modalidad gratuita suficiente para empezar como uso personal: Vercel Hobby y Supabase Free. Supabase puede pausar proyectos sin actividad durante una semana; los límites y condiciones de ambos planes pueden cambiar.

## Puesta en marcha

1. Crea un proyecto en Supabase.
2. En SQL Editor, ejecuta en orden los archivos supabase/migrations/202609300001_initial_schema.sql y supabase/migrations/202609300002_opening_balance.sql.
3. En Supabase Auth, desactiva el registro público y crea tu usuario desde el panel de administración. El proxy de Next.js renueva las sesiones y las políticas RLS aíslan las filas por usuario.
4. Copia .env.example como .env.local y completa la URL del proyecto y su clave publicable desde Project Settings → API.
5. Instala dependencias y ejecuta el servidor local:

   ~~~sh
   npm install
   npm run dev
   ~~~

6. Abre http://localhost:3000 e inicia sesión con el usuario creado.
7. Para publicar, importa este proyecto en Vercel y define las mismas variables de entorno para Production, Preview y Development.

Next.js requiere Node.js 20.9 o superior. No compartas una clave service_role; la aplicación usa la clave publicable y RLS para mantener los datos aislados.

## Datos y cálculos

- transactions.type: income, expense o transfer.
- El saldo disponible es saldo inicial más ingresos acumulados menos gastos acumulados.
- El saldo inicial representa el dinero anterior al primer movimiento registrado. Puedes introducirlo desde el dashboard y no cuenta como ingreso del mes.
- El dinero libre estimado es ingresos del mes menos gastos del mes.
- El gasto por categoría cuenta solo gastos del mes.
- La moneda inicial de presentación es MXN; cambia NEXT_PUBLIC_CURRENCY en .env.local para usar otra moneda.

## Camino de evolución

El esquema deja espacio para añadir cuentas y enlazar transferencias con cuentas de origen y destino; también se pueden añadir presupuestos y metas con tablas propias vinculadas a user_id.

## WhatsApp (integración inicial)

1. Ejecuta `supabase/migrations/202609300003_whatsapp_messages.sql` en el SQL Editor del proyecto ya existente. El identificador del mensaje impide guardar dos veces un movimiento si Meta reintenta la entrega.
2. Configura en Vercel las variables de servidor `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_APP_SECRET`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_ALLOWED_SENDER`, `WHATSAPP_USER_ID` y `SUPABASE_SECRET_KEY`. No uses el token temporal de WhatsApp como clave de Supabase; cada variable tiene un origen distinto. Nunca pongas estas variables en GitHub ni les añadas el prefijo `NEXT_PUBLIC_`.
3. En Meta, configura la URL de devolución `https://TU-DOMINIO.vercel.app/api/whatsapp/webhook`, usa el mismo token de verificación y suscribe el campo `messages`.
4. Desde el número permitido, envía un texto como `gasto 120 comida almuerzo` o `ingreso 500 salario pago`. Por ahora se aceptan solo esas órdenes claras. Otros textos, fotos y audios se omiten. El gasto se clasifica como necesario y personal por defecto, y el método de pago queda sin especificar. Los movimientos aparecen en el dashboard al recargarlo.

El webhook comprueba la firma de Meta antes de guardar y acepta un único remitente. Más adelante se podrán añadir confirmaciones por WhatsApp, edición de campos, mensajes libres mediante IA y borradores para revisar interpretaciones ambiguas.
