# Evidencia — Competidor A: InfoAnimal SR, flujo observable

| Dato | Valor |
| --- | --- |
| Diagrama | `flujo-observable.html` (fuente `candidate.json`) |
| Tipo Archify | `workflow` |
| Commit de las fuentes | `f518b9aa75150d547f5dee742083ef29089b769b` |
| Fecha de generación | 2026-11-02 |
| Validación | `finalize` aprobado: `validate`, `deliver`, `check`, `browser-check` (`flujo-observable.finalize.json`) |

## Fuentes

| Fuente | Contenido usado |
| --- | --- |
| `docs/informe/img/1-1/infoanimal-perfil.png` (Figura 1.1-1) | Nombre, descripción, ubicación, 87 publicaciones, 269 seguidores, enlace a `infoanimalsr.com` |
| `docs/informe/img/1-1/infoanimal-web-503.png` (Figura 1.1-2) | Enlace con `utm_source=ig&utm_medium=social&utm_content=link_in_bio`; respuesta `503 Service Unavailable` con la leyenda `hws` |
| `docs/informe/1-1-1-competidores.md:24-96` | Tablas 1.1-1 a 1.1-4 y vacíos relevados |

La fecha de captura de las figuras no se registró (`docs/informe/1-1-1-competidores.md:14`).

## Verificación por elemento

| Elemento del flujo | Estado | Evidencia |
| --- | --- | --- |
| La cuenta publica contenido propio (noticias, rescates, curiosidades) | Verificado | Figura 1.1-1 |
| El perfil opera en Instagram, ubicado en San Rafael, Mendoza | Verificado | Figura 1.1-1 |
| Los seguidores ven el feed | Verificado (269 seguidores) | Figura 1.1-1 |
| El seguidor abre el enlace del perfil | Verificado | Figuras 1.1-1 y 1.1-2 |
| El sitio responde `503` y el contenido no es accesible | Verificado al momento de la captura | Figura 1.1-2 |
| Recepción y publicación de casos enviados por terceros | No disponible | `1-1-1-competidores.md:69` |
| Relación con refugios, veterinarias o entidades públicas | No disponible | `1-1-1-competidores.md:53` |
| Contenido, tecnología y hosting del sitio | No disponible | `1-1-1-competidores.md:60-61` |

## Criterios aplicados

- Los nodos del carril "No disponible en la evidencia" no tienen relaciones: no hay evidencia de cómo se conectan con el flujo.
- No se representan bases de datos, APIs ni tecnología interna.
- El error `503` es un hecho de la captura; no se afirma que el sitio siga fuera de servicio.
- No se realizó revisión visual de capturas; solo los chequeos automatizados de Archify.
