# Solicitud inicial sin contraseña — integración real v10

- Pantalla principal: `solicitud.html`, integrada a Supabase con clave **publicable**.
- La persona describe la falla y completa contacto, vehículo y horario preferido.
- Antes de crear la solicitud se envía un enlace OTP por correo. Supabase autentica al remitente y la tabla `service_requests` conserva RLS por `customer_user_id`.
- Al volver del enlace al **mismo navegador** se crea el registro y se muestra su identificador.
- No se guarda padrón, fotos ni archivos privados. La fecha es solo una preferencia.
- Configurar en Supabase Auth > URL Configuration: `http://127.0.0.1:5500/solicitud.html`, `http://localhost:5500/solicitud.html` y el futuro dominio HTTPS como Redirect URLs. Las redirecciones a IP LAN deberán añadirse específicamente si se usan.
- La entrega de correos depende de la configuración y límites de Supabase Auth; se requiere comprobar recepción real y enlaces en el celular.
- El borrador queda temporalmente en `sessionStorage` del navegador, NO en Supabase hasta confirmar el correo. El cliente debe abrir el enlace en el mismo navegador.
- Para producción: configurar SMTP, protección contra abuso, consentimientos, política de privacidad, manejo de duplicados y pruebas E2E cliente A/B.
- `app-real.html` conserva la aplicación administrativa anterior. `demo.html` conserva la demostración.
- Nunca usar claves `service_role` en el navegador.
