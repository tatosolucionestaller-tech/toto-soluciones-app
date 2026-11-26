# Tato Soluciones — Control Center y atención digital

Aplicación web para talleres automotrices. Repositorio de trabajo de Tato Soluciones (Arica, Chile). La versión de código más reciente es **V31** (26 de noviembre de 2026).

## Enlaces y arquitectura

- Página de solicitud sin registro: https://tato-soluciones.pages.dev/solicitud.html
- Acceso de cliente y Control Center: https://tato-soluciones.pages.dev/app-real.html
- Enlace temporal de aprobación: \`presupuesto.html?token=...\`
- Hosting previsto: Cloudflare Pages desde la rama \`main\`. El despliegue y DNS de \`tatosoluciones.cl\` requieren validación en el panel de Cloudflare.
- Backend: proyecto Supabase \`kqevyqimwnbylrixpjga\` (Postgres, Auth, Storage y Edge Functions).
- Node 22 en GitHub Actions verifica sintaxis, cálculos y referencias HTML.

## Flujo comercial actual

1. Cliente envía Solicitud Express o Tato registra una llamada.
2. Recepción programa el diagnóstico y el puesto; prepara el prediagnóstico.
3. Tato busca repuestos en Mercado Libre Chile, registra costos y genera presupuesto.
4. Cliente aprueba/rechaza mediante enlace privado de 7 días (no equivale a firma electrónica avanzada).
5. Personal confirma recepción e inspección física, vincula cliente y vehículo y genera orden.
6. Personal gestiona repuestos, avance de la reparación, fechas estimadas y entrega.
7. Tato registra dinero efectivamente recibido por orden, devoluciones/anulaciones y resúmenes/cierres diarios.
8. El expediente \`tato-expedientes\` conserva PDF e imágenes privadas, versionadas por solicitud. El cliente puede consultar solo los archivos marcados como compartidos después de activar su cuenta.

## Protección de datos

- La clave pública del navegador es de tipo publishable/anon; jamás subir \`service_role\` ni claves de proveedores al repositorio.
- Storage tiene RLS y bucket privado. Los documentos archivados requieren autorización staff; los clientes están limitados a documentos compartidos vinculados a su usuario.
- El correo automático usa una Edge Function con autorización del personal. Nunca incluir secretos en JS del navegador.
- Los PDF generados en navegador deben archivarse explícitamente para conservar versión. WhatsApp y correo manual requieren confirmación de envío.
- Los comprobantes internos **no son documentos tributarios del SII**.
- El aviso \`privacidad.html\` requiere validación del responsable legal del taller.

## Funciones Edge

- \`express-intake\`: captura pública restringida.
- \`express-quote\`: enlace temporal, aprobación, rechazo y vinculación del cliente.
- \`tato-phone-intake\`: recepción autenticada desde una llamada.
- \`tato-email-document\`: PDF adjunto al email (requiere proveedor).
- \`tato-parts-search\`: búsqueda autorizada de productos Mercado Libre o búsqueda asistida.
- \`tato-setup-status\`: muestra a la administración si están disponibles las configuraciones de proveedores y el almacenamiento privado.

## Variables externas necesarias para operación completa

En secretos del proyecto Supabase, **nunca aquí en GitHub ni por chat**:
- \`RESEND_API_KEY\`: clave privada del proveedor de correo.
- \`TATO_DOCUMENT_FROM\`: remitente verificado del dominio, p. ej. \`Tato Soluciones <atencion@tatosoluciones.cl>\` solo después de crear y verificar ese remitente.
- \`MERCADOLIBRE_ACCESS_TOKEN\`: token autorizado de Mercado Libre, sujeto a expiración; requiere un procedimiento de renovación para disponibilidad estable.

El dominio \`tatosoluciones.cl\` debe asociarse y validarse en Cloudflare Pages, con sus registros DNS y certificado correspondiente. Las protecciones de Auth (contraseñas filtradas y rutas de redirección) requieren revisión en el panel Supabase.

## Pruebas

\`\`\`sh
node --test workflow.test.mjs tests/static-integrity.test.mjs
node --check app.js
\`\`\`

La CI del repositorio ejecuta ambas. También se probaron transacciones reversibles de recepción telefónica, presupuesto, aprobación, creación de orden, progresos y entrega; no sustituyen una prueba con cuenta real de cliente y staff en los dispositivos previstos.

## Limitaciones pendientes

Consultar [ESTADO_PRODUCCION.md](ESTADO_PRODUCCION.md). No declarar "100% operativo" sin pruebas de instalación/publicación, correo, navegación del cliente, almacenamiento de archivos reales, autorizaciones, caja y cierre con los usuarios responsables.
