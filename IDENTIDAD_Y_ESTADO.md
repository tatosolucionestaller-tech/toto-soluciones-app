# Tato Soluciones — identidad y estado de implementación

Logo oficial recibido del usuario el 09-10-2026, incorporado en web, favicon y manifest PWA. Colores: rojo, verde, gris y blanco.

## Arquitectura
Web estática PWA con Supabase Auth y RLS, base de datos exclusiva del proyecto Tato Soluciones. Configuración pública pendiente en config.js.

## Implementado y verificable en código
Registro/login, formulario de solicitud, consulta de solicitudes propias, vista personal, cambios de estado permitidos y logo.

## Pendiente antes de pruebas integrales
Agenda de cinco puestos con disponibilidad transaccional, diagnóstico técnico y adjuntos, lectura de padrón, presupuesto PDF, autorización de cliente, proveedores reales, órdenes de trabajo, recordatorios y despliegue HTTPS. No usar con clientes reales hasta auditoría de roles, flujos y dispositivos.

## Seguridad y respaldos
No respaldar .env, service_role ni datos personales reales en paquetes compartidos. Los ZIP son respaldos de código, no respaldos completos de la base de datos.
