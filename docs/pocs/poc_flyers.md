# POC — Generación automática de Flyers

**Sprint 0 · PATITAS** · Spike de validación tecnológica
Funcionalidad asociada: Generación automática de flyers

> **Estado: APROBADO**

---

## ¿Qué queríamos resolver?

Uno de los requisitos de PATITAS es que, cuando alguien publica un reporte de
mascota perdida o encontrada, el sistema **genere solo un flyer listo para
compartir** en WhatsApp, Instagram o Facebook. Sin que el usuario tenga que
abrir Canva ni diseñar nada a mano.

La pregunta del POC era: **¿con qué herramienta generamos esos flyers de
forma automática, que sean precisos y que no nos cuesten plata?**

---

## Qué probamos

Antes de programar nada, comparamos dos caminos posibles:

### Opción A — Plantilla HTML que se rellena con los datos
Se arma un diseño fijo (tipo molde) y el sistema le mete los datos del reporte:
nombre, foto, teléfono, zona, etc. Después eso se "saca como foto" y queda el flyer.

### Opción B — Inteligencia Artificial generativa (tipo DALL-E)
Se le pide a una IA que "dibuje" el flyer desde cero a partir de una descripción.

Investigamos las dos y nos dimos cuenta rápido de que la **Opción B no sirve para
esto**, por más moderna que suene:

| | Plantilla HTML (A) | IA generativa (B) |
|---|---|---|
| **El teléfono sale bien** | ✅ Siempre exacto | ❌ Se lo inventa o lo escribe mal |
| **La foto de la mascota** | ✅ La foto real del dueño | ❌ La deforma o "dibuja" otra |
| **Diseño** | ✅ Siempre igual y prolijo | ❌ Distinto cada vez, impredecible |
| **Costo** | ✅ Gratis e ilimitado | ❌ Cobra por cada imagen |
| **Velocidad** | ✅ Menos de 1 segundo | ❌ Varios segundos |

El punto que definió todo fue la **precisión**. Un flyer de mascota perdida es algo
serio: si el número de teléfono sale mal, el dueño no recupera a su mascota. La IA
generativa inventa datos, así que quedó descartada enseguida.

**Elegimos la Opción A: plantilla HTML.**

---

## Cómo lo hicimos

El flujo que armamos es este:

```
Datos del reporte  →  se rellenan en la plantilla  →  se convierte en imagen  →  flyer.png
```

Usamos herramientas gratuitas y de código abierto (Jinja2 para rellenar la plantilla
y Playwright para convertirla en imagen). Cero APIs de pago, cero límite de uso.

Después generamos **dos flyers de prueba** para verificar que funcionara con los dos
estados que maneja la plataforma:

- Un reporte **PERDIDO** (un perro, "Rocky")
- Un reporte **ENCONTRADO** (un gato sin identificar)

---

## Resultados

Funcionó. Los dos flyers se generaron solos a partir de los datos, y cada estado salió
con su color correspondiente (rojo para PERDIDO, verde para ENCONTRADO) sin tener que
tocar nada.

| Lo que pedíamos | ¿Se cumplió? |
|---|---|
| **Rápido** | ✅ 0,71 segundos por flyer (promedio) |
| **Consistente** | ✅ Mismo diseño siempre, sin variaciones raras |
| **Preciso** | ✅ Teléfono, zona, fecha y foto salen exactos del reporte |
| **Gratis** | ✅ $0, sin límite, sin tarjeta |
| **Prueba funcional** | ✅ 2 flyers generados (perdido + encontrado) |


Cada flyer incluye: el estado bien grande arriba, la foto de la mascota, el nombre, los
datos (especie, raza, color, tamaño, señas), la zona donde se vio por última vez y, lo
más importante y destacado, **el teléfono de contacto**.

---

## Conclusión

El POC quedó **aprobado**. Confirmamos que se pueden generar flyers automáticos,
precisos y gratis con el enfoque de plantilla HTML. Para el desarrollo del proyecto se
adopta este camino, y queda descartada la IA generativa de imágenes para esta función.

### Cosas a tener en cuenta para más adelante
- En producción, los datos van a venir directo de la base de datos del reporte (en el
  POC los cargamos a mano para probar).
- La parte de **publicar** el flyer automáticamente en las redes (no solo generarlo)
  depende de las APIs de cada red social y se va a evaluar por separado.
- Como el diseño es una plantilla, más adelante es fácil sumar más estilos de flyer si
  se quiere (esto cubre el RF "Flyers propios", que es deseable pero no obligatorio).

---

