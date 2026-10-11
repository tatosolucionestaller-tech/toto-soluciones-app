# Tato Soluciones PWA — primera versión web

## Estado
Interfaz móvil real para registro/inicio de sesión, envío de solicitudes, consulta de solicitudes propias y bandeja del taller con transiciones permitidas. Usa la tabla `service_requests` del proyecto Supabase Tato Soluciones y sus políticas RLS. No se ha desplegado públicamente.

## Configurar y publicar
1. Editar `config.js` con `SUPABASE_URL` y clave **pública publishable/anon** del proyecto correcto. Nunca colocar `service_role` ni secretos.
2. Servir los archivos mediante HTTPS (hosting estático). Para probar localmente: `python3 -m http.server 8080` y abrir `http://localhost:8080` (el service worker solo se activa en HTTPS).
3. En Supabase Auth configurar URL del sitio, redirecciones de recuperación y confirmación de correo. Probar flujo de cambio de contraseña antes de producción; el enlace de recuperación aún requiere pantalla específica para actualizar la clave.
4. Configurar CAPTCHA/antibot, protección de contraseñas filtradas, límites de registro y políticas de privacidad.
5. Verificar en dispositivos reales: cuenta cliente A no lee cliente B, cuenta sin rol no ve taller, usuario staff puede cambiar estados permitidos y no otros; inspeccionar permisos SQL y pruebas E2E.

## Limitaciones actuales
Fecha preferida NO reserva cupo. No hay todavía OCR de padrón, archivos, cotización automática de proveedores, pagos, aprobación digital, recordatorios, PDF, bitácora de taller ni agenda de cinco puestos. El frontend es una base web funcional condicionada a configuración y pruebas reales. No enviar datos reales hasta completar las pruebas de seguridad.

## Flujo de atención v3 (09-10-2026)
Panel del taller: selecciona solicitud, reserva inicio/fin y puesto, escribe diagnóstico y pruebas, crea borrador y ofrece presupuesto. Cliente: consulta presupuestos, aprueba o rechaza mediante RPC autenticada. Costos internos no se incluyen en la RPC pública. Requiere migraciones aplicadas al proyecto exclusivo Tato Soluciones. Aún faltan integración con las tablas históricas de citas/órdenes, lectura de padrón, PDF, proveedores, notificaciones y pruebas E2E. No desplegada.

## Versión 4 - validaciones y recuperación (09-10-2026)
- Recuperación de contraseña con formulario de actualización posterior a evento PASSWORD_RECOVERY de Supabase Auth. Requiere configurar redirección y probar con cuenta real.
- Horarios de reserva validados en zona America/Santiago, lunes a viernes 08:30-17:00, sin reservas de más de 12 horas. La base de datos aún no aplica esta validación horaria; el control de concurrencia por puesto sí está en la base de datos.
- Impresión local de resumen de presupuesto para consulta. No es factura ni PDF oficial, y todavía no contiene número tributario ni firma.
- 4 pruebas unitarias nuevas, todas aprobadas. No se han probado usuarios reales ni el despliegue.
- Se intentó ampliar el esquema de progreso de reparación, pero la herramienta bloqueó la migración; NO se aplicó y NO se incluye como funcionalidad operativa.
