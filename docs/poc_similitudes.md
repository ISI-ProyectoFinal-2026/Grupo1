# POC — Similitud de imágenes para matching de mascotas

**Sprint 0 · PATITAS** · Spike de validación tecnológica
Funcionalidad asociada: Detección de similitudes entre imagenee de mascotas encontradas y perdidas.

> **Estado: APROBADO**

---

## ¿Qué queríamos resolver?

Uno de los requisitos de PATITAS es que, cuando alguien publica un reporte de
**mascota encontrada**, el sistema **compare automáticamente esa imagen contra
todas las publicaciones de mascotas perdidas** y, si encuentra una coincidencia
con buena probabilidad, **notifique al dueño**. Sin que nadie tenga que revisar
publicación por publicación a mano.

La pregunta del POC era: **¿se puede detectar de forma confiable si dos fotos
son de la misma mascota, usando herramientas de código abierto?**

---

## Qué probamos

Hicimos pruebas comparando dos imágenes y midiendo qué tan "parecidas" las
considera el sistema (similitud de embeddings). Probamos dos enfoques:

### Opción A — OpenCLIP solo
Se le pasa la imagen completa (como la subió el usuario, con fondo, otras
personas, objetos, etc.) y se generan los embeddings directamente sobre eso.

### Opción B — YOLO + OpenCLIP
Primero se usa YOLO para detectar y **recortar solo la mascota** de la imagen
(eliminando fondo, personas y ruido), y sobre ese recorte se generan los
embeddings con OpenCLIP.

Al comparar ambos enfoques, notamos que la **Opción A pierde precisión** porque
el fondo y otros elementos de la foto "contaminan" el embedding:

| | OpenCLIP solo (A) | YOLO + OpenCLIP (B) |
|---|---|---|
| **Precisión del embedding** | ⚠️ Se ve afectado por fondo/ruido | ✅ Foco solo en la mascota |
| **% similitud (misma mascota)** | Más bajo | ✅ Más alto |
| **Sensibilidad a fondo/recorte** | ❌ Alta | ✅ Baja |
| **Complejidad** | Más simple | Un paso extra de preprocesamiento |
| **Costo** | Gratis | Gratis |

El punto que definió todo fue que, al recortar la mascota con YOLO antes de
pasarla por OpenCLIP, **los porcentajes de similitud mejoraban consistentemente**.

**Elegimos la Opción B: YOLO + OpenCLIP en conjunto.**

---

## Cómo lo hicimos

El flujo que armamos es este:

```
Imagen de mascota encontrada → YOLO recorta la mascota → OpenCLIP genera embedding
→ se compara contra embeddings de mascotas perdidas → % de similitud
```

Por ahora este POC solo valida que la tecnología es viable; no se evaluaron
alternativas de matching (hash perceptual, otros modelos, etc.) porque el
objetivo era confirmar que el enfoque OpenCLIP + YOLO responde bien al caso
de uso.

---

## Resultados

| Caso evaluado | % de similitud obtenido |
|---|---|
| **Misma mascota** (par de fotos de la misma mascota) | ✅ ~85% – 89% |
| **Mascotas distintas** (par de fotos de mascotas diferentes) | ✅ ~65% |

La diferencia entre ambos rangos (85-89% vs 65%) es lo que nos da margen para
definir un **umbral de similitud** confiable a la hora de decidir si dos
publicaciones corresponden o no a la misma mascota, minimizando falsos positivos.

---

## Conclusión

El POC quedó **aprobado**. Confirmamos que la combinación de YOLO (para recorte)
+ OpenCLIP (para generación de embeddings) es viable para detectar coincidencias
entre mascotas perdidas y encontradas, con una diferencia clara entre los
porcentajes de casos positivos y negativos.

### Cosas a tener en cuenta para más adelante
- Falta definir el **umbral exacto de similitud** a partir del cual se considera
  "coincidencia" (con los datos actuales, un umbral entre 65% y 85% sería el
  rango a ajustar).
- Queda pendiente decidir la **arquitectura de despliegue**: si el matching se
  va a implementar como un **servicio independiente** (fuera del backend
  principal) o **integrado dentro del backend** del proyecto.
- Se recomienda ampliar el set de pruebas con más pares de imágenes antes de
  pasar a producción, para confirmar que los porcentajes se mantienen estables.

---
