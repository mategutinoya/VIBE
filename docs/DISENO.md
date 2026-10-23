# VIBE · Sistema de diseño

Fuente de verdad: [`web/src/styles/tokens.css`](../web/src/styles/tokens.css). Los componentes de [`app.css`](../web/src/styles/app.css) solo usan estos tokens.

## Idea central

El símbolo de VIBE son **dos círculos que se cruzan**: violeta (tú) y azul (tu dúo). La intersección, casi blanca, es el momento compartido. Ese motivo se repite en el logo, en el onboarding, en los estados vacíos y en los pares de avatares del Dúo. No es decoración: es la mecánica del producto dibujada.

## Color

| Token | Oscuro (predeterminado) | Uso |
|---|---|---|
| `--bg` | `#07080f` | Fondo negro azulado |
| `--surface` → `--surface-3` | `#0e1020` → `#1d2140` | Capas: suben en luminosidad, no en saturación |
| `--line` | blanco al 7 % | Bordes y separadores |
| `--text` / `--text-2` / `--text-3` | `#eef0ff` / `#a5aacb` / `#6d7299` | Principal, secundario, terciario |
| `--violet` / `--blue` | `#8a6bff` / `#4f8bff` | Las dos personas del dúo |
| `--grad` | violeta → azul, 135° | Solo acciones principales y elementos del Dúo |
| `--blend` | `#e9e4ff` | Intersección del símbolo |
| `--danger` / `--success` / `--warning` | rosa / verde / ámbar | Estados; ámbar también para la marca DEMO |

El degradado se reserva para **lo que se toca** (botón principal, crear, reproducir, grabar) y para el Dúo. El texto nunca lleva degradado. Hay tema claro con los mismos nombres de token.

Los "pensamientos" reciben un tinte suave calculado a partir del autor y la publicación (`thoughtStyle`), así el feed tiene ritmo de color sin depender de fotos.

## Tipografía

- **Bricolage Grotesque** (display): títulos, preguntas del Dúo, pensamientos. Tiene carácter sin ser excéntrica; con tracking negativo da la voz de la marca.
- **Manrope** (texto): interfaz y lectura. Muy legible a tamaños pequeños.
- Escala: 12 · 13 · 15 · 17 · 22 · 28 · 36 px. Los pensamientos y las preguntas usan `clamp()` para escalar con el ancho.
- Fuentes autoalojadas (sin peticiones a terceros).

## Forma y espacio

- Base de 4 px (`--s-1` … `--s-12`).
- Radios: 8 · 12 · 18 · 24 · 32 px y píldora. Botones siempre en píldora; tarjetas a 24; la tarjeta del Dúo y las hojas inferiores a 32.
- Sin tarjetas innecesarias: el feed usa separadores, no cajas. Solo el contenido (foto, pensamiento, audio) tiene superficie propia.

## Movimiento

- Curvas: `--ease-out` para entradas y `--ease-spring` para respuestas táctiles (botones, reacciones, interruptores).
- Duraciones: 140 ms (feedback), 240 ms (transiciones), 420 ms (entradas de contenido).
- Momentos con intención: el **revelado** del Dúo desenfoca → enfoca (700 ms); los círculos del onboarding se acercan hasta solaparse; la reacción elegida hace un *pop*.
- `prefers-reduced-motion` reduce todas las duraciones a 0.

## Componentes

| Componente | Notas |
|---|---|
| `Button` | `primary` (degradado), `secondary` (superficie), `ghost`, `danger`; `sm`; estado de carga |
| `Sheet` | Hoja inferior para menús, confirmaciones, audiencia y reportes (no hay modales centrados) |
| `ConfirmSheet` | Toda acción destructiva pide confirmación y explica las consecuencias |
| `Avatar` | Foto o iniciales sobre un degradado derivado del id; anillo opcional |
| `DemoTag` | Etiqueta ámbar "DEMO" en todo lo que viene de cuentas de demostración |
| `Segmented`, `Switch`, `chip` | Controles de selección |
| `PostCard` | Autor, tiempo, audiencia, contenido, reacciones, respuestas y menú |
| `AudioPlayer` | Forma de onda real, avance pulsando, un solo audio a la vez |
| `DuoCard` | Tarjeta protagonista del Inicio con 4 estados (pendiente, esperando, te toca, revelado) |
| Estados | `PostSkeleton`/`RowSkeleton` (carga), `ErrorState` con reintento, `Empty` con acción |

## Principios

1. **Personas antes que métricas**: no hay contadores de seguidores ni "likes" públicos en grande.
2. **Cronológico y finito**: el feed termina ("Estás al día ✨").
3. **Descubrir no es un feed infinito a pantalla completa**: es un mosaico de dos columnas con filtros y personas.
4. **La privacidad se explica donde se decide** (al elegir audiencia, en Descubrir, en Ajustes).
5. **Móvil primero**: objetivos táctiles de 40 px o más, inputs de 16 px (sin zoom en iOS), zonas seguras (`env(safe-area-inset-*)`), `100dvh`.
