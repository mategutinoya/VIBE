# VIBE · Propuesta de producto

## El problema

Las redes grandes premian la pose: fotos perfectas, métricas públicas y un algoritmo que decide qué ves. Las alternativas "auténticas" resolvieron una parte (BeReal: una foto a la vez, todos a la misma hora) pero ataron la autenticidad a un único formato y a una notificación que muchos acaban ignorando. Si no tienes nada que fotografiar, no hay motivo para abrir la app.

VIBE quiere que abrir la app cada día tenga **un motivo social concreto** y que ese motivo funcione **aunque tengas un solo amigo**.

---

## Tres mecánicas propuestas

### 1. El Dúo

> *"Cada día, un amigo y tú: la misma pregunta, y nadie ve la respuesta del otro hasta que los dos contestáis."*

Cada 24 horas VIBE te empareja con un amigo. Los dos recibís la misma pregunta ("¿Qué canción describe tu día?", "Tu cielo de hoy"…). Respondes con foto, texto o nota de voz. La respuesta del otro está bloqueada hasta que envías la tuya; entonces se revelan a la vez.

- **Por qué es distinta**: no es un feed ni un concurso de popularidad; es una conversación de dos que empieza con una pregunta. BeReal sincroniza a *todos* a la misma hora con *una foto*; el Dúo sincroniza a *dos personas* con *una pregunta* y en cualquier formato. Snapchat tiene rachas, pero la racha mide constancia, no contenido compartido.
- **Bucle diario**: hay un dúo nuevo cada día y una notificación con sentido ("Dani ya respondió. Te toca").
- **Con pocos amigos**: funciona desde el primer amigo. Con uno solo, cada día hay dúo.
- **Crecimiento sin spam**: tu enlace personal dice "sé mi dúo". Es una invitación a una persona concreta, no a toda tu agenda.

### 2. Relevo

> *"Un vibe que pasa de mano en mano: recibes uno de un amigo, añades el tuyo y se lo pasas a otro."*

Cada mañana aparece una cadena temática ("lo que estás escuchando"). Un amigo te pasa el relevo; tú añades tu aportación y eliges a quién se lo pasas. Al final del día la cadena completa es visible para todos los que participaron.

- **Por qué es distinta**: el contenido se construye en grupo y en serie, no en paralelo.
- **Problemas**: se rompe si alguien no responde (cuellos de botella); con pocos amigos la cadena es muy corta; empuja a "pasar el relevo" a gente fuera de la app, lo que se parece a una cadena de mensajes, justo el spam que queremos evitar.

### 3. Frecuencia

> *"Elige el color de tu día y descubre qué amigos están en tu misma frecuencia."*

Cada día marcas tu estado de ánimo con un color y una palabra. VIBE te muestra qué amigos están "en sintonía" contigo y os propone hablar.

- **Por qué es distinta**: conecta por estado emocional, no por contenido.
- **Problemas**: con pocos amigos casi nunca hay coincidencias; registrar el ánimo a diario cansa; tiene un componente de salud mental delicado para un público joven (comparación, presión por "estar bien").

### Comparación

| Criterio | Dúo | Relevo | Frecuencia |
|---|---|---|---|
| Se entiende en menos de 10 s | ✅ una frase | ⚠️ hay que explicar la cadena | ✅ |
| Genera interacción entre amigos | ✅ conversación 1 a 1 con revelado | ✅ grupal | ⚠️ solo si coincidís |
| Funciona con 1–3 amigos | ✅ desde el primero | ❌ cadenas cortas o rotas | ❌ pocas coincidencias |
| Invitación sin spam | ✅ "sé mi dúo", una persona | ⚠️ tiende a cadena masiva | ✅ |
| No copia BeReal | ✅ pregunta + cualquier formato + dos personas | ✅ | ✅ |
| Riesgo de producto | Bajo: fallo = un dúo sin revelar | Alto: fallo en cadena | Medio: sensibilidad emocional |
| Frase memorable | "Hoy tu vibe tiene pareja" | "Pasa el vibe" | "¿En qué frecuencia estás?" |

**Elegida: el Dúo.** Es la única de las tres que funciona igual de bien con un amigo que con cien, convierte la notificación diaria en algo personal ("te toca") y hace que invitar sea un gesto íntimo ("sé mi dúo"), no una difusión.

### Detalles de diseño del Dúo (implementados)

- **Emparejamiento**: prioriza amigos que hoy no tienen dúo y con quienes hace más tiempo que no coincides. Si todos tus amigos están emparejados, puedes tener un dúo "extra" con alguien que ya lo tenga.
- **24 horas desde que se crea**, no hasta medianoche: evita problemas entre amigos en zonas horarias distintas.
- **Privacidad**: antes del revelado, el servidor solo dice *si* el otro respondió, nunca *qué*. Los archivos del dúo solo los pueden descargar las dos personas y solo después del revelado.
- **Después del revelado**: reaccionas a la respuesta del otro y puedes seguir la conversación por mensaje privado. Los dúos quedan en un historial que solo veis vosotros dos.
- **Si os dejáis de seguir o bloqueáis**, el dúo sin revelar se cierra.
- **Cuentas demo**: responden automáticamente (y lo indican) para que puedas probar el revelado sin amigos reales.

---

## Plan de prueba con los primeros 100 usuarios

### Objetivo

Validar una sola hipótesis antes de construir más: **el Dúo hace que la gente vuelva cada día y que invite a alguien concreto.**

### Reclutamiento (semanas 0–1)

- **No captar 100 personas sueltas, sino ~10 grupos de amigos de 6–12 personas**: el Dúo necesita grafos densos. Fuentes: 2–3 institutos o universidades, un club deportivo y un par de grupos de amigos de los propios fundadores.
- Cada grupo entra con un "embajador" que recibe el enlace y lo comparte en su grupo. Medimos cuántos llegan solos a partir de ahí.
- Desactivar las cuentas demo para esta cohorte (`DEMO_CONTENT=off`) o pedir que no las usen, para medir uso real.
- Consentimiento explícito para el estudio; menores de edad solo con autorización y sin datos personales en las entrevistas.

### Métricas (todas calculables con la base de datos actual)

| Métrica | Cómo se mide | Señal de que funciona |
|---|---|---|
| **Tasa de revelado** | dúos con `revealed_at` / dúos creados | > 45 % |
| Tiempo hasta responder | `duo_answers.created_at − duos.created_at` | mediana < 6 h |
| Retención D1 / D7 / D14 | usuarios que abren su dúo ese día | D7 > 35 %, D14 > 25 % |
| Invitaciones por usuario | registros con `inviteCode` / usuarios activos | > 0,5 (coeficiente viral inicial) |
| Conversaciones tras el dúo | mensajes en las 24 h siguientes a un revelado | > 20 % de los revelados |
| Mezcla de formatos | `kind` de las respuestas | ningún formato > 80 % (la libertad de formato importa) |
| Seguridad | reportes y bloqueos por cada 100 usuarios | bajos y revisados en < 24 h |

No mediremos "likes" ni tiempo en la app: no son lo que VIBE quiere optimizar.

### Calendario

1. **Semana 1 — Arranque**: onboarding guiado en persona con cada grupo; observar dónde se atascan (grabación de audio, permisos de cámara, encontrar amigos).
2. **Semanas 2–3 — Uso libre**: sin intervención. Panel interno semanal con las métricas.
3. **Semana 3 — Entrevistas**: 15 entrevistas de 20 min (mitad muy activos, mitad que abandonaron). Preguntas clave: *¿qué te hizo abrir la app ayer?*, *¿qué sentiste al ver la respuesta revelada?*, *¿a quién invitaste y por qué?*
4. **Semana 4 — Decisión**: continuar, ajustar (preguntas, duración, emparejamiento) o replantear.

### Experimentos baratos durante la prueba

- **Preguntas**: rotar bancos de preguntas (divertidas vs. íntimas) entre grupos y comparar la tasa de revelado.
- **Recordatorio**: un único aviso a las 6 h si tu dúo te espera (requiere push; mientras tanto, contador en la app).
- **Duración**: 24 h frente a 12 h en grupos distintos.

### Criterios para seguir adelante

- Tasa de revelado ≥ 45 % **y** retención D14 ≥ 25 % → invertir en push, app nativa y crecimiento.
- Revelado alto pero retención baja → el momento es bueno, falta motivo para volver: probar dúos de grupo pequeño (3) o rachas por pareja.
- Revelado bajo → las preguntas o el emparejamiento fallan: entrevistar y rediseñar antes de escalar.
