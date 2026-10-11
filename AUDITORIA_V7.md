# Tato Soluciones - revisión v7 (2026-10-09)

## Incorporado
- Actas de recepción y entrega imprimibles, con campos de kilometraje, combustible, daños, accesorios y espacios de firma.
- Historial de solicitudes del cliente, consultado exclusivamente por `customer_user_id` autenticado.
- Documentos son borradores locales: no se guardan en Supabase y no equivalen a firma electrónica ni comprobante de entrega real.

## Comprobaciones ejecutadas
- `node --check app.js`: correcto.
- `node --test workflow.test.mjs`: 5/5 correctas.
- Auditoría de Supabase anterior: RLS habilitado en 16 tablas; consulta simulada sin identidad no mostró solicitudes ni workflows.

## Pendientes antes de producción
- Pruebas E2E con dos cuentas cliente y dos perfiles de personal independientes, con autorización explícita y sin usar datos reales.
- Pruebas de políticas RLS para escritura y lectura cruzadas, incluida la vista y las funciones SECURITY DEFINER.
- Registrar y almacenar las actas y firmas de forma segura, con trazabilidad y consentimientos.
- Historial técnico de órdenes vinculadas al vehículo mediante identidad comprobada, no solo solicitudes.
- Pruebas de horarios simultáneos y concurrencia; seguridad de documentos, carga y privacidad; despliegue HTTPS.
- Activar protección contra contraseñas filtradas en Supabase.
- No usar clave service_role en frontend.
