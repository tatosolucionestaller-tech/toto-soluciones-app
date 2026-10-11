# Tato Soluciones — Auditoría integrada v8 (10 octubre 2026)

## Recuperación comprobada
Se inspeccionó el ZIP real v7 y se conservó íntegro dentro de este paquete. Incluye frontend `index.html`, `app.js`, pruebas de utilidades, imágenes, manifiesto PWA y configuración pública sin completar. Se constató que la versión anterior muestra acceso obligatorio antes de la solicitud y por eso no responde al nuevo flujo solicitado.

## Mejoras entregadas
- `demo.html` y `demo.js`: simulador local navegable sin cuenta, formulario de falla y contacto, patente, calendario de preferencia, cinco puestos, diagnóstico, presupuesto, etapas, impresión de recepción/presupuesto/entrega, inventario con movimientos y alertas, historial, reportes simples.
- El simulador conserva datos **solo en localStorage del navegador**; no carga documentos ni envía información a Supabase; no usar información real de clientes.
- Incluye chequeos locales de importes, horas, solapamientos y estado.
- El código de producción v7 se conserva como referencia, sin sustituirlo por una simulación.

## Hallazgos pendientes y riesgos
1. CRÍTICO: flujo de cliente sin cuenta aún no está conectado al backend; necesita API pública con rate limiting/CAPTCHA, verificación de contacto y almacenamiento privado. No permitir inserciones públicas sin controles antispam.
2. CRÍTICO: falta prueba E2E de autorización cruzada con cliente A, cliente B, técnico, recepción y administrador. RLS activo no es evidencia suficiente.
3. ALTO: revisión y endurecimiento de las RPC `SECURITY DEFINER`, en particular transiciones de presupuesto, además de protección de contraseñas filtradas.
4. ALTO: documentos de padrón deben almacenarse en bucket privado, validar tamaño/MIME, expiración, acceso y borrado; OCR requiere confirmación manual y protección de datos personales.
5. ALTO: presupuesto real, aceptación verificable y cambio de alcance deben versionarse y dejar trazabilidad de quién/cuándo.
6. ALTO: inventario requiere movimientos inmutables y transacciones atómicas en el servidor; la simulación no es contabilidad de existencias real.
7. MEDIO: proveedores/precios/tiempos de entrega no deben inventarse; necesitan consulta con fuentes reales, compatibilidad por VIN y fecha de verificación.
8. MEDIO: agenda de producción tiene bloqueo por puesto, pero falta ensayo concurrente, festivos, duraciones por servicio y notificaciones.
9. MEDIO: actas imprimibles no equivalen a recepción/entrega registrada o firma digital.
10. MEDIO: despliegue HTTPS, configuración Supabase Auth, correo y pruebas Android/PWA pendientes.

## Protocolo de aceptación final
A. Solicitud sin contraseña, verificación de correo/teléfono, confirmación de hora y antispam.
B. Recepción con fotografías privadas y estado firmado, escáner y diagnóstico profesional.
C. Cotización versionada con costo privado; solo cliente dueño aprueba; repuestos y tiempos verificables.
D. Orden de reparación y movimientos de inventario trazables; caja y comprobantes; entrega, garantía e historial.
E. Matriz de pruebas negativas de seguridad (cliente A/B, anónimo, técnico, caja, recepción, administrador), concurrencia de agenda, pérdida de conexión y restauración de respaldos.
F. Publicación HTTPS y PWA probada en celular. No afirmar disponibilidad Play Store sin publicación efectiva.

**Estado:** desarrollo y demostración operativa local, NO producción ni privacidad certificada.
