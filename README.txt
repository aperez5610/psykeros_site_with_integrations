
Psykeros - Sitio web (Frontend + Backend)
=========================================

Estructura del proyecto
- public/            -> Frontend estático (HTML/CSS/JS/assets)
- server/            -> Backend Node.js (Express) con SQLite
- server/package.json
- server/server.js

Características incluidas (implementadas o esqueleto):
- Diseño responsive, multi-idioma (toggle EN/ES).
- Sistema de reserva de citas (endpoint /api/appointments).
- Integración sugerida con Google Calendar (requiere configurar OAuth2).
- Sección de testimonios (API y páginas).
- Blog estático (puede integrarse con CMS o headless).
- Galería de fotos con placeholders (reemplazar en public/assets/images).
- Perfil de la doctora (doctor.html) y posibilidad de subir PDFs en el portal.
- Catálogo de servicios y precios (mostrados en services.html).
- Formulario de contacto (/api/contact).
- Botón de WhatsApp y enlace a Facebook incluidos.
- Portal seguro (esqueleto en /portal) — requiere HTTPS y configuración de seguridad.
- Backend básico con endpoints para citas, usuarios y testimonios.
- SEO básico en meta tags.

Instalación (Amazon Linux / EC2)
1. Subir archivos al servidor.
2. Instalar Node.js (v18+ recomendable) y npm.
3. En la carpeta server/ ejecutar:
   npm install
   export SECRET="cambia_este_valor"
   node server.js
4. Servir el contenido (por ejemplo con PM2 o systemd) y configurar Nginx como proxy si quieres SSL.
5. Para integración con Google Calendar: configura credenciales OAuth en Google Cloud Console y añade la lógica en server/server.js usando googleapis.

Seguridad y producción
- Forzar HTTPS (Nginx + Certbot).
- Usar variables de entorno para secretos y credenciales.
- Hacer backups de la base de datos SQLite o migrar a un RDBMS gestionado.
- Revisar políticas de retención de datos y consentimiento de pacientes (leyes locales).

Archivos de interés
- public/ : HTML/CSS/JS estático y assets (logo y placeholders)
- server/server.js : backend Express con endpoints básicos
- server/psykeros.db : creado en runtime con SQLite

Contacto
- Teléfono (MX): +52 8787023641
- WhatsApp: https://api.whatsapp.com/send?phone=5218787023641&text=Hola%20Psykeros%21%20Necesito%20ayuda
- Facebook: https://www.facebook.com/share/17HmUd1niY/




INTEGRACIONES AGREGADAS EN ESTE ZIP
----------------------------------
Se han añadido skeletons/implmentaciones de las siguientes integraciones. Debes completar credenciales en server/.env:

1) Google Calendar (OAuth2)
 - Endpoints:
   - GET /api/google-auth-url  -> devuelve URL para consentir acceso de Google Calendar
   - GET /google-oauth2callback -> callback que Google redirige con ?code=... (guardar tokens)
   - POST /api/calendar/create-event -> crea evento en el calendario con tokens guardados
 - Configuración:
   - Crea credenciales en Google Cloud Console, añade redirect URI y coloca CLIENT_ID, CLIENT_SECRET y REDIRECT_URI en .env
   - Tras autorizar, el servidor guardará tokens en server/google_tokens.json (demo). En producción almacena en DB de forma segura.

2) Upload seguro de PDFs (títulos)
 - Endpoint:
   - POST /api/upload-pdf (header x-admin-key debe igualar ADMIN_PASS del .env en este demo)
   - Form field: file (PDF)
 - Guardado en: server/uploads/docs/
 - Recomendación: proteger con auth real y escaneo antivirus en producción.

3) Twilio (SMS)
 - Endpoint:
   - POST /api/send-sms { to: '+1xxxxxxxxxx', body: 'Texto' }
 - Requiere TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN y TWILIO_PHONE_NUMBER en .env

4) Nodemailer
 - Contact form now attempts to send email using SMTP credentials in .env (SMTP_HOST, SMTP_USER, SMTP_PASS, EMAIL_FROM).

NOTAS DE SEGURIDAD
- Nunca guardes credenciales en código. Usa .env o un secret manager.
- Reemplaza la comprobación adminCheck por autenticación JWT real.
- Asegura el servidor con HTTPS (Nginx + Certbot) antes de poner en producción.
