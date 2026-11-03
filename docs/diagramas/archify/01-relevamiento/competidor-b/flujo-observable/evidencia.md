# Evidencia — Competidor B: grupo de Facebook Perritos Perdidos, flujo observable

| Dato | Valor |
| --- | --- |
| Diagrama | `flujo-observable.html` (fuente `candidate.json`) |
| Tipo Archify | `workflow` |
| Commit de las fuentes | `f518b9aa75150d547f5dee742083ef29089b769b` |
| Fecha de generación | 2026-11-02 |
| Validación | `finalize` aprobado: `validate`, `deliver`, `check`, `browser-check` (`flujo-observable.finalize.json`) |

## Alcance

El Competidor B son dos grupos de Facebook: "Perritos Perdidos" y "4 Patitas Felices". Solo hay capturas del primero; el flujo representa ese grupo. "4 Patitas Felices" figura como vacío.

## Fuentes

| Fuente | Contenido usado |
| --- | --- |
| `docs/informe/img/1-1/facebook-publicidad-1.png` (Figura 1.1-4) | Aviso de una pollería publicado en el grupo; etiquetas `@destacar` y `@todos` |
| `docs/informe/img/1-1/facebook-publicidad-2.png` (Figura 1.1-5) | Aviso de lavandería y cabañas con "CONTACTO WSP"; botón `Join group` |
| `docs/informe/img/1-1/facebook-publicacion-pendiente.png` (Figura 1.1-6) | Publicación del 5 de agosto de 2025 de un caniche encontrado, en estado `Pending`, con 2 publicaciones en la cola |
| `docs/informe/1-1-1-competidores.md:104-181` | Tablas 1.1-5 a 1.1-8 y vacíos relevados |

La fecha de captura de las figuras no se registró (`docs/informe/1-1-1-competidores.md:14`).

## Verificación por elemento

| Elemento del flujo | Estado | Evidencia |
| --- | --- | --- |
| Unión al grupo mediante `Join group` | Verificado | Figura 1.1-5 |
| Un miembro publica texto y fotos, con la ubicación en texto libre | Verificado | Figura 1.1-6 |
| La publicación queda en la cola `Pending` | Verificado | Figura 1.1-6 |
| Aprobación por un administrador | Inferido del estado `Pending`, según el relevamiento del equipo; la acción del administrador no aparece en las capturas | `1-1-1-competidores.md:119`, `:145` |
| La publicación aprobada aparece en el feed | Verificado como resultado: hay publicaciones visibles en el feed | Figuras 1.1-4 y 1.1-5 |
| Comercios locales publican avisos ajenos a mascotas | Verificado | Figuras 1.1-4 y 1.1-5 |
| Contacto por WhatsApp, fuera del grupo | Verificado en un aviso comercial | Figura 1.1-5 |
| Si los avisos comerciales pasaron por la cola `Pending` | No disponible | — |
| Demora de la aprobación | No disponible | `1-1-1-competidores.md:145` |
| Rechazo de publicaciones | No observado | `1-1-1-competidores.md:145` |
| Búsqueda, clasificación o estado del caso | No observado | `1-1-1-competidores.md:146` |
| Cantidad de miembros, administradores y antigüedad | No disponible | `1-1-1-competidores.md:110` |
| Grupo "4 Patitas Felices" | Sin captura | `1-1-1-competidores.md:107` |

## Criterios aplicados

- La relación "aviso comercial → feed" se dibuja punteada: el aviso aparece en el feed, pero no se sabe por qué camino.
- Los nodos del carril "No observado en las capturas" no tienen relaciones.
- No se representan bases de datos, APIs ni tecnología interna de Facebook.
- No se realizó revisión visual de capturas; solo los chequeos automatizados de Archify.
