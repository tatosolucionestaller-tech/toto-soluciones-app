# Seguridad y pruebas — 09-10-2026

Corregido en Supabase: reservas limitadas en servidor a lunes-viernes 08:30-17:00 America/Santiago; validación de INSERT de presupuestos como borrador; cambios de estado de presupuestos e importes congelados una vez ofrecidos.

Corregido en web: limpiar paneles y permisos al cerrar/cambiar sesión; fechas de agenda convertidas usando America/Santiago independientemente de la zona del dispositivo; prueba de horario de verano/invierno. Cinco pruebas unitarias aprobadas.

PENDIENTE antes de producción: credenciales públicas de Supabase en config.js; pruebas de aislamiento cliente A/B con cuentas reales; integración completa de reparación, fotos, historial, garantías, PDF, notificaciones; protección contra contraseñas filtradas en Supabase Auth; HTTPS y pruebas en dispositivos. La revisión SQL no es una prueba de penetración.

No almacenar claves service_role ni archivos .env privados en ZIP.
