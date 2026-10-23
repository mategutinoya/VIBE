# VIBE

**Cada día, un amigo y tú: la misma pregunta, y ninguno ve la respuesta del otro hasta que los dos contestáis.**

VIBE es una red social para compartir momentos reales con amigos (fotos, pensamientos y notas de voz) sin la presión estética de Instagram. Lo que la distingue es **el Dúo**: cada 24 horas te emparejamos con un amigo, os hacemos la misma pregunta y las respuestas se revelan a la vez.

- Propuesta de producto, comparación de mecánicas y plan para los primeros 100 usuarios → [`docs/PRODUCTO.md`](docs/PRODUCTO.md)
- Sistema de diseño → [`docs/DISENO.md`](docs/DISENO.md)

---

## Abrirla en el celular (publicarla con un clic)

[![Desplegar en Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/mategutinoya/VIBE/tree/claude/elegant-faraday-r7ap59)

1. Pulsa el botón (funciona desde el celular) e inicia sesión en Render con tu cuenta de GitHub.
2. Pulsa **Deploy Blueprint**. La primera vez tarda unos 3–5 minutos.
3. Abre la dirección que te da Render (`https://vibe-xxxx.onrender.com`) en el celular.
4. En el navegador, elige **Añadir a pantalla de inicio**: VIBE se abrirá como una app, a pantalla completa.

Con HTTPS funcionan la cámara y el micrófono. Ten en cuenta que **en el plan gratuito** el servicio se duerme tras 15 min sin uso (tarda ~1 min en despertar) y **los datos se borran al reiniciarse**. Para conservarlos, usa un plan de pago con disco (instrucciones en [`render.yaml`](render.yaml)).

---

## Ejecutar el proyecto

Requisitos: **Node.js 22.13 o superior** (se usa `node:sqlite`, que viene con Node; no hace falta instalar ninguna base de datos).

```bash
npm run install:all   # dependencias de server/ y web/
npm run build         # compila el cliente en web/dist
npm start             # API + cliente en http://localhost:8787
```

Abre `http://localhost:8787` en el navegador (o en el móvil, en la misma red, con la IP de tu ordenador). Para probar la app en un móvil con cámara y micrófono hace falta **HTTPS** (los navegadores bloquean `getUserMedia` en HTTP salvo en `localhost`).

### Desarrollo con recarga en caliente

```bash
npm run dev:api   # API en :8787 (se reinicia al guardar)
npm run dev:web   # Vite en :5173, con proxy de /api hacia :8787
```

### Pruebas

```bash
npm test          # 11 pruebas de integración de la API (node:test)
```

Cubren registro e inicio de sesión, CSRF, visibilidad por audiencia (amigos, círculo y público), cuenta privada, reacciones y notificaciones, bloqueo, eliminación de EXIF/GPS y control de acceso a los archivos, el Dúo (respuestas ocultas hasta que ambos contestan), invitaciones, mensajes solo entre amigos, privacidad en la búsqueda y eliminación de la cuenta.

### Variables de entorno

| Variable | Por defecto | Para qué |
|---|---|---|
| `PORT` | `8787` | Puerto HTTP |
| `DATA_DIR` | `server/data` | Base de datos SQLite y archivos subidos |
| `COOKIE_SECURE` | — | Pon `1` en producción detrás de HTTPS |
| `TRUST_PROXY` | — | Pon `1` detrás de un proxy inverso (IP real para el límite de intentos) |
| `DEMO_CONTENT` | activado | `off` para no crear las cuentas de demostración |

### Moderación

Los reportes se guardan en la base de datos. Mientras no exista un panel de moderación:

```bash
npm --prefix server run reports               # lista los reportes abiertos
npm --prefix server run reports -- --close 3  # cierra el reporte 3
```

---

## Arquitectura

```
server/                 API REST · Node + Express 5 + SQLite (node:sqlite)
  src/schema.sql        Esquema completo de la base de datos
  src/index.js          Servidor, cabeceras de seguridad, montaje de rutas
  src/lib/
    auth.js             Sesiones (cookie httpOnly, token con hash SHA-256), CSRF
    security.js         scrypt para contraseñas, límite de ritmo
    serialize.js        Forma pública de los datos + VISIBLE: la única regla de quién ve qué
    media.js            Subidas: detección por bytes, eliminación de EXIF/GPS, permisos de acceso
    duo.js · prompts.js La mecánica del Dúo
    demo.js · demoart.js Contenido de demostración (imágenes y audio generados)
  src/routes/           auth, me, users, friends (+ círculos, bloqueos, reportes),
                        posts (feed, descubrir, reacciones, respuestas), media, duo, messages,
                        notifications, demo
  test/api.test.js      Pruebas de integración

web/                    Cliente · React 18 + Vite + React Router (PWA instalable)
  src/styles/           tokens.css (sistema de diseño) y app.css (componentes)
  src/ui/               Primitivas: Avatar, Button, Sheet, Toast, Switch, estados vacíos/carga/error
  src/components/       PostCard, Composer (foto/pensamiento/audio), AudioPlayer, DuoCard, …
  src/screens/          Una pantalla por archivo
  src/lib/              api.js, sesión, grabadora, compresión de imágenes, paginación
```

**Decisiones clave**

- **Un solo proceso y SQLite**: perfecto para un MVP y para los primeros miles de usuarios. El esquema es SQL estándar; migrar a PostgreSQL es directo cuando haga falta.
- **La visibilidad vive en un solo sitio** (`VISIBLE` en `serialize.js`) y se reutiliza en el feed, el perfil, el detalle, las reacciones y la descarga de archivos. Ninguna foto o audio se sirve sin pasar esa regla.
- **Sin credenciales en el cliente**: la sesión es una cookie `httpOnly` + `SameSite=Lax`; el servidor solo guarda el hash del token. Toda escritura exige la cabecera `X-Vibe` (protección CSRF).
- **Privacidad por defecto**: las publicaciones son "Solo amigos" salvo que elijas otra cosa; las fotos se recodifican en el dispositivo y el servidor vuelve a eliminar EXIF/XMP/IPTC; la app no pide ni usa la ubicación (`Permissions-Policy: geolocation=()`).
- **Tiempo real por sondeo** (contadores cada 20 s, chat cada 4 s). Simple y fiable; el siguiente paso es WebSocket/SSE.

---

## Estado: qué está hecho y qué falta

### Implementado y conectado (sin simulaciones)

- Registro con validación (usuario disponible en vivo, contraseña, edad mínima de 13 años), inicio y cierre de sesión, sesiones persistentes.
- Onboarding: 3 pantallas que explican el concepto, alta y paso de "encuentra a tus amigos" (enlace de invitación, búsqueda y cuentas demo opcionales).
- Perfiles persistentes: foto, nombre, biografía, amigos, publicaciones visibles para quien mira, contador de dúos juntos.
- Publicaciones de **foto** (cámara o galería, compresión y sin metadatos), **pensamiento** (hasta 280 caracteres) y **audio** (grabación de hasta 30 s con forma de onda, reproducción con avance).
- Audiencia por publicación: amigos, círculo privado o público; vista previa antes de compartir.
- Feed cronológico de amigos con scroll infinito; Descubrir con personas sugeridas y mosaico de vibes públicos con filtros.
- Reacciones (6 emojis, una por persona, lista de quién reaccionó) y respuestas (con borrado por autor o dueño del post).
- Amistad completa: búsqueda, solicitudes, aceptar/rechazar/cancelar, eliminar, sugerencias por amigos en común, círculos privados.
- **El Dúo**: emparejamiento diario, pregunta compartida, respuesta en cualquier formato, revelado simultáneo, reacción a la respuesta del otro, historial y paso a conversación privada.
- Invitaciones con enlace personal (`/i/<código>`): quien se registra con él queda conectado contigo.
- Notificaciones (reacciones, respuestas, solicitudes, nuevas amistades, eventos del Dúo) con contadores en la navegación.
- Mensajes privados entre amigos.
- Privacidad: cuenta privada, ocultarse de búsquedas y sugerencias, limitar solicitudes a amigos de amigos.
- Seguridad: bloquear (oculta en ambas direcciones y deshace la amistad), reportar usuarios o publicaciones, lista de bloqueados, eliminar la cuenta con todos sus datos.
- Estados de carga (skeletons), error con reintento y pantallas vacías en todas las vistas; tema oscuro por defecto y tema claro; diseño adaptable de móvil a escritorio.

### Pendiente / requiere configuración externa

| Función | Estado |
|---|---|
| Notificaciones push (móvil) | No implementado. Necesita Web Push con claves VAPID (o APNs/FCM en app nativa). Hoy las notificaciones son dentro de la app. |
| Recuperar contraseña | No implementado: requiere un proveedor de correo (SMTP, Resend, SES…). Por eso el registro no pide email. |
| Mensajes en tiempo real | Funcionan por sondeo cada 4 s. Para escala: WebSocket o SSE. |
| Panel de moderación | Los reportes se guardan y se consultan por CLI (`npm run reports`). Falta panel web y moderación automática de imágenes. |
| Almacenamiento de archivos | Disco local. En producción: S3/R2 con URLs firmadas y CDN. |
| HTTPS y despliegue | Hay que ponerlo detrás de un proxy con TLS (Caddy, Nginx, Fly.io, Render…) y activar `COOKIE_SECURE=1`. |
| Zona horaria del Dúo | El Dúo dura 24 h desde que se crea, no "hasta medianoche". Es intencionado para evitar problemas de zona horaria entre amigos. |
| Verificación de edad | Solo autodeclaración. |
| App nativa | Es una PWA instalable; una app nativa (Expo/React Native) reutilizaría la API tal cual. |
| Exportar mis datos | No implementado (sí eliminar la cuenta). |
