# Tato Soluciones v9 — avances verificables

## Base de datos real
- Se aplicó la migración `audit_part_stock_changes_immutable_ledger` en el proyecto exclusivo de Tato Soluciones.
- La tabla `part_stock_movements` registra cambios directos de stock de `parts` con cantidades anterior/nueva, diferencia, fecha y usuario de sesión cuando existe.
- Se impide borrar un repuesto que conserva stock.
- Esta auditoría no reemplaza un flujo de inventario transaccional completo: todavía falta vincular cada movimiento con una orden, proveedor y motivo validado antes de descontar stock.

## Demo local
- Bitácora de movimientos visibles en el Centro de Control.
- Los movimientos se guardan únicamente en localStorage del navegador, sin usuarios ni permisos reales.
- No utilizar para datos de clientes reales.

## Pendientes de producción
- Ingreso sin contraseña con confirmación de identidad y protección contra spam; citas con disponibilidad real.
- Autenticación y permisos comprobados con cuentas separadas.
- Documentos privados, recepción/entrega firmada y fotos del padrón con retención y autorización.
- Inventario ligado a órdenes, cotizaciones verificadas de proveedores y caja.
- Protección de contraseñas filtradas, despliegue HTTPS, pruebas de integración y respaldo de código en Drive.
