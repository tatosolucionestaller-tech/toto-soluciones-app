# Tato Soluciones — Estado real de producción (26/11/2026)

## Confirmado por herramientas conectadas

- GitHub \`tatosolucionestaller-tech/toto-soluciones-app\`: rama \`main\` accesible y con versiones V24–V31.
- Supabase \`kqevyqimwnbylrixpjga\`: activo; tablas y funciones Edge desplegadas.
- Recepción telefónica → presupuesto → aceptación → orden → etapas → entrega: prueba de base de datos transaccional, revertida (sin datos ficticios persistentes).
- Expediente privado: bucket \`tato-expedientes\`, RLS en metadata/Storage y función de registro versionado; prueba de autorización reversible sin documentos persistentes.
- Verificación automática con GitHub Actions: ejecutar nueva CI después de cada commit.
- Registros reales: conservar la solicitud inicial (TATO-07B0D18A). No convertirla ni generar facturación ficticia.

## BLOQUEOS para declarar 100% funcional

1. **Publicación/dominio**: no fue posible verificar externamente \`tato-soluciones.pages.dev\` o \`tatosoluciones.cl\` desde esta sesión. Abrir el panel de Cloudflare Pages para comprobar despliegue de main, DNS y SSL.
2. **Email automático**: requiere dominio remitente verificado y configuración segura de \`RESEND_API_KEY\` + \`TATO_DOCUMENT_FROM\`; luego enviar un PDF real de prueba y verificar recepción/bandeja de spam.
3. **Mercado Libre**: búsqueda asistida disponible; para resultados API se necesita credencial OAuth válida, renovación de token y prueba de stock/precios reales. No inferir compatibilidad de repuestos por texto.
4. **Prueba móvil completa**: el titular del taller debe probar Solicitud Express, llamada, reserva, PDF, WhatsApp, aprobación, activación, seguimiento y entrega desde Android y computadora.
5. **Caja**: probar registro de pago, corrección y cierre diario con operaciones controladas; la simulación de pagos fue bloqueada por herramientas anteriores. No contabilizar dinero inexistente.
6. **Seguridad/Auth**: habilitar protección contra contraseñas filtradas en Supabase Auth; revisar funciones SECURITY DEFINER legadas y hacer prueba entre dos cuentas distintas.
7. **Conformidad y obligaciones**: la política de privacidad requiere validación legal; revisar respaldo/restauración, permisos de usuarios, conservación de expedientes y documentos tributarios SII.
8. **Archivo digital**: subir, descargar y compartir PDF/foto reales para validar MIME, tamaño, permisos y versión sin archivos huérfanos.

## Controles y restricciones

- El botón de estado en Control Center muestra variables configuradas, **no garantiza entrega de correos, cotizaciones o despliegue**.
- No ingresar claves privadas en mensajes de chat ni en \`config.js\`.
- Un PDF enviado no constituye aceptación automática; esta debe quedar registrada en el flujo autorizado.
- El comprobante interno en PDF no reemplaza boleta/factura fiscal ni evidencia de transferencia.
- Si falla el almacenamiento de metadatos, la app intenta retirar el archivo recién subido y muestra un error; verificar posibles huérfanos antes de uso masivo.
- El módulo Cloudflare no está conectado como herramienta en esta sesión; ajustes de DNS requieren acceso al panel correspondiente.

## Propuesta de pruebas de aceptación

- Cliente A envía solicitud, recibe código y no ve documentos del cliente B.
- Tato recibe solicitud en la bandeja y registra una llamada con otro contacto; agenda sin superposición.
- Presupuesto preliminar en PDF; presupuesto definitivo a correo/WhatsApp, aprobador verifica sus datos.
- El cliente aprueba, activa su correo y consulta solo su vehículo.
- Personal registra inspección y orden, repuesto, fecha tentativa, avances y entrega.
- Tato genera comprobante interno de pago (no tributario), consulta caja y realiza cierre de un día anterior.
- Un archivo PDF se archiva privado y otra versión se comparte voluntariamente con el cliente, sin acceso anónimo.
- Se realiza restauración de respaldo, se revisa el historial de la patente y se valida la política de privacidad.
