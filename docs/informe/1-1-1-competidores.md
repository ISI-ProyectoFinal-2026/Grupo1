---
seccion: "1.1"
titulo: "Definición de requerimientos"
nivel: 2
fase: A
estado: borrador
actualizado: 2026-10-27
---

# 1.1 Definición de requerimientos

Esta sección releva los dos sistemas que hoy cubren la búsqueda de mascotas perdidas en San Rafael, Mendoza, identificados por el equipo: InfoAnimal SR (Competidor A) y los grupos de Facebook "Perritos Perdidos" y "4 Patitas Felices" (Competidor B).

- **Evidencia.** Capturas de pantalla aportadas por el equipo (`docs/informe/img/1-1/`). La fecha de captura no se registró.
- **Datos públicos.** La búsqueda en internet no devolvió información sobre ninguno de los competidores; los enlaces a cada perfil y grupo los aportó el equipo. Lo que no surge de las capturas figura como `No disponible`.
- 1.1.4 transcribe los objetivos y el alcance del PDD v1.0, que son los preliminares del proyecto.

## 1.1.1 Competidor A: InfoAnimal SR

### 1.1.1.1 Relevamiento general

#### 1.1.1.1.1 De la organización/sistema

| Dato | Valor | Evidencia |
|---|---|---|
| Nombre | InfoAnimalSR | Figura 1.1-1 |
| Canal principal | Cuenta de Instagram [`infoanimalsr`](https://www.instagram.com/infoanimalsr) | Figura 1.1-1; enlace aportado por el equipo |
| Descripción declarada | "Información y actualidad animal", "Noticias, rescates y curiosidades" | Figura 1.1-1 |
| Ubicación | San Rafael, Mendoza | Figura 1.1-1 |
| Publicaciones / seguidores / seguidos | 87 / 269 / 22 | Figura 1.1-1 |
| Sitio web | `infoanimalsr.com`, enlazado desde el perfil | Figuras 1.1-1 y 1.1-2 |
| Responsables, antigüedad, forma jurídica | No disponible | — |

Tabla 1.1-1. Datos generales de InfoAnimal SR. Fuente: Figuras 1.1-1 y 1.1-2.

![Perfil de Instagram de InfoAnimal SR](img/1-1/infoanimal-perfil.png)

Figura 1.1-1. Perfil de Instagram de InfoAnimal SR. Fuente: `docs/informe/img/1-1/infoanimal-perfil.png`.

#### 1.1.1.1.2 Funciones detectadas a nivel general y relaciones con otros Sistemas y Entidades

| Función | Evidencia |
|---|---|
| Difusión de noticias, rescates y curiosidades sobre animales mediante publicaciones | Descripción del perfil (Figura 1.1-1) |
| Derivación a un sitio web propio | Enlace del perfil (Figura 1.1-1) |

Tabla 1.1-2. Funciones detectadas en InfoAnimal SR. Fuente: Figura 1.1-1.

Relaciones con otros sistemas y entidades:

- **Instagram (Meta):** plataforma sobre la que opera el canal principal.
- **Sitio `infoanimalsr.com`:** recibe el tráfico del perfil; el enlace lleva los parámetros `utm_source=ig&utm_medium=social&utm_content=link_in_bio` (Figura 1.1-2).
- Relación con refugios, veterinarias o entidades públicas: No disponible.

#### 1.1.1.1.3 Tecnología de Información

| Componente | Detalle |
|---|---|
| Red social | Instagram |
| Sitio web | `infoanimalsr.com`; respondió `503 Service Unavailable` con la leyenda `hws` (Figura 1.1-2) |
| Tecnología del sitio, hosting, base de datos | No disponible |

Tabla 1.1-3. Tecnología de información de InfoAnimal SR. Fuente: Figuras 1.1-1 y 1.1-2.

### 1.1.1.2 Relevamiento detallado y análisis del Sistema

#### 1.1.1.2.1 Detalle, explicación y documentación detallada de todas las funciones seleccionadas

- **Publicación de contenido.** La cuenta publica contenido propio (87 publicaciones) a sus 269 seguidores. Si la cuenta recibe y publica casos de mascotas perdidas enviados por terceros: No disponible.
- **Acceso al sitio web.** Desde el enlace del perfil, el sitio devolvió el error `503 Service Unavailable` (Figura 1.1-2): el contenido del sitio no estaba accesible.

![Sitio de InfoAnimal SR con error 503](img/1-1/infoanimal-web-503.png)

Figura 1.1-2. Sitio `infoanimalsr.com` con error `503 Service Unavailable` al ingresar desde Instagram. Fuente: `docs/informe/img/1-1/infoanimal-web-503.png`.

#### 1.1.1.2.2 Modelo lógico del Sistema actual

```mermaid
flowchart LR
    A[Cuenta InfoAnimalSR] -->|publica| B[Perfil de Instagram]
    B -->|feed| C[Seguidores]
    C -->|enlace del perfil| D[infoanimalsr.com]
    D -->|503 Service Unavailable| C
```

Figura 1.1-3. Modelo lógico de InfoAnimal SR según lo observado. Fuente: Figuras 1.1-1 y 1.1-2.

#### 1.1.1.2.3 Problemas y necesidades detectados en las funciones relevadas en detalle y en su entorno organizacional

| Problema | Evidencia | Necesidad | Limitación del PDD |
|---|---|---|---|
| El sitio web enlazado no estaba disponible | Figura 1.1-2 | Un sistema accesible para consultar los casos | Falta de centralización |
| El perfil es un canal de noticias generales sobre animales, no específico de mascotas perdidas | Figura 1.1-1 | Una plataforma dedicada a la búsqueda de mascotas | Falta de especialización |
| El alcance depende de la cantidad de seguidores de la cuenta (269) | Figura 1.1-1 | Difusión que no dependa de una cuenta particular | Baja visibilidad |

Tabla 1.1-4. Problemas y necesidades de InfoAnimal SR. Fuente: Figuras 1.1-1 y 1.1-2; [`PDD v1.0.docx`](../pdd/PDD%20v1.0.docx), "Limitaciones identificadas".

## 1.1.2 Competidor B: grupos de Facebook

### 1.1.2.1 Relevamiento general

#### 1.1.2.1.1 De la organización/sistema

| Dato | Perritos Perdidos | 4 Patitas Felices |
|---|---|---|
| Tipo | Grupo de Facebook | Grupo de Facebook |
| Nombre visible en la captura | "Perritos Perdidos Sa…" (truncado por la aplicación) | Sin captura |
| Ubicación de las publicaciones | San Rafael (Figura 1.1-4) | No disponible |
| Enlace (aportado por el equipo) | [facebook.com/share/g/1A351SCDxk](https://www.facebook.com/share/g/1A351SCDxk/) | [facebook.com/share/g/19NGMZ9DJm](https://www.facebook.com/share/g/19NGMZ9DJm/) |
| Cantidad de miembros, administradores, antigüedad | No disponible | No disponible |

Tabla 1.1-5. Datos generales de los grupos de Facebook. Fuente: Figuras 1.1-4 a 1.1-6; enlaces aportados por el equipo.

#### 1.1.2.1.2 Funciones detectadas a nivel general y relaciones con otros Sistemas y Entidades

| Función | Evidencia |
|---|---|
| Publicación de texto con fotos por parte de los miembros | Figuras 1.1-4 y 1.1-6 |
| Aprobación previa de publicaciones (cola `Pending`) | Figura 1.1-6 |
| Unión de nuevos miembros (botón `Join group`) | Figura 1.1-5 |
| Etiquetado de miembros (`@destacar`, `@todos`) | Figura 1.1-4 |

Tabla 1.1-6. Funciones detectadas en el grupo Perritos Perdidos. Fuente: Figuras 1.1-4 a 1.1-6.

Relaciones con otros sistemas y entidades:

- **Facebook (Meta):** plataforma sobre la que operan los grupos.
- **WhatsApp:** canal de contacto indicado en una publicación (Figura 1.1-5).
- **Comercios locales:** publican avisos en el grupo (Figuras 1.1-4 y 1.1-5).

#### 1.1.2.1.3 Tecnología de Información

| Componente | Detalle |
|---|---|
| Plataforma | Grupos de Facebook, accedidos desde la aplicación móvil (Figuras 1.1-4 a 1.1-6) |
| Desarrollo propio | No se observó |

Tabla 1.1-7. Tecnología de información de los grupos de Facebook. Fuente: Figuras 1.1-4 a 1.1-6.

### 1.1.2.2 Relevamiento detallado y análisis del Sistema

#### 1.1.2.2.1 Detalle, explicación y documentación detallada de todas las funciones seleccionadas

- **Publicación.** Un miembro publica texto y fotos. Las Figuras 1.1-4 y 1.1-5 muestran avisos comerciales (pollería con envío a domicilio; lavado de acolchados, frazadas y ropa, y servicio de cabañas) publicados en el grupo Perritos Perdidos, sin relación con mascotas.
- **Aprobación de publicaciones.** La Figura 1.1-6 muestra una publicación del 5 de agosto de 2025 que informa un perro caniche macho encontrado, en estado `Pending`, con 2 publicaciones en la cola. El tiempo que tardó la aprobación: No disponible.
- **Búsqueda, clasificación o seguimiento del estado de un caso:** no se observaron en las capturas.

![Aviso de pollería en el grupo Perritos Perdidos](img/1-1/facebook-publicidad-1.png)

Figura 1.1-4. Aviso comercial de una pollería en el grupo Perritos Perdidos. Fuente: `docs/informe/img/1-1/facebook-publicidad-1.png`.

![Aviso de lavandería en el grupo Perritos Perdidos](img/1-1/facebook-publicidad-2.png)

Figura 1.1-5. Aviso comercial de lavandería y cabañas en el grupo Perritos Perdidos. Fuente: `docs/informe/img/1-1/facebook-publicidad-2.png`.

![Publicación de mascota encontrada pendiente de aprobación](img/1-1/facebook-publicacion-pendiente.png)

Figura 1.1-6. Publicación de mascota encontrada pendiente de aprobación en el grupo Perritos Perdidos. Fuente: `docs/informe/img/1-1/facebook-publicacion-pendiente.png`.

#### 1.1.2.2.2 Modelo lógico del Sistema actual

```mermaid
flowchart LR
    A[Miembro] -->|publica texto y fotos| B[Cola Pending]
    B -->|aprobación del administrador| C[Feed del grupo]
    D[Comercio local] -->|publica aviso| C
    C --> E[Miembros]
```

Figura 1.1-7. Modelo lógico del grupo Perritos Perdidos según lo observado. Fuente: Figuras 1.1-4 a 1.1-6.

#### 1.1.2.2.3 Problemas y necesidades detectados en las funciones relevadas en detalle y en su entorno organizacional

| Problema | Evidencia | Necesidad | Limitación del PDD |
|---|---|---|---|
| Avisos comerciales ajenos a mascotas mezclados con los casos | Figuras 1.1-4 y 1.1-5 | Contenido restringido a casos de mascotas | Contaminación informativa |
| Un aviso de mascota encontrada queda retenido hasta que un administrador lo aprueba | Figura 1.1-6 | Publicación inmediata con moderación automática | Baja visibilidad |
| Los casos son publicaciones de texto libre sin estado | Figuras 1.1-4 a 1.1-6 | Casos estructurados con estado | Dificultad de seguimiento |
| Información repartida entre varios grupos (Perritos Perdidos, 4 Patitas Felices) | Identificación del equipo | Un único punto de consulta | Falta de centralización |

Tabla 1.1-8. Problemas y necesidades de los grupos de Facebook. Fuente: Figuras 1.1-4 a 1.1-6; [`PDD v1.0.docx`](../pdd/PDD%20v1.0.docx), "Limitaciones identificadas".

## 1.1.3 Resumen funcionalidades de los sistemas relevados

*Observada*: la función aparece en las capturas. *No observada*: no aparece en las capturas; no implica que el sistema carezca de ella.

| Funcionalidad | A: InfoAnimal SR | B: grupos de Facebook | Evidencia |
|---|---|---|---|
| Publicación de contenido sobre animales | Observada (la cuenta publica contenido propio) | Observada (los miembros publican texto y fotos) | Figuras 1.1-1, 1.1-6 |
| Publicación de casos por parte de terceros | No disponible | Observada | Figura 1.1-6 |
| Aprobación previa de publicaciones | No observada | Observada (cola `Pending`, manual) | Figura 1.1-6 |
| Filtro de contenido ajeno a mascotas | No observada | No observada; hay avisos comerciales publicados | Figuras 1.1-4, 1.1-5 |
| Sitio web propio | Observada, fuera de servicio (`503`) | No aplica | Figura 1.1-2 |
| Estado del caso (perdido, encontrado, resuelto) | No observada | No observada | Figuras 1.1-1, 1.1-4 a 1.1-6 |
| Búsqueda o filtrado de casos | No observada | No observada | Figuras 1.1-1, 1.1-4 a 1.1-6 |
| Ubicación en mapa | No observada | No observada; la ubicación se indica en texto libre | Figura 1.1-6 |
| Comparación automática de fotos | No observada | No observada | Figuras 1.1-1, 1.1-4 a 1.1-6 |
| Contacto entre usuarios | No observada | Por fuera del grupo (WhatsApp, en un aviso comercial) | Figura 1.1-5 |

Tabla 1.1-9. Resumen de funcionalidades de los sistemas relevados. Fuente: Figuras 1.1-1 a 1.1-6.

## 1.1.4 Objetivos y alcances preliminares del nuevo sistema

Objetivos y alcance tomados del documento de definición del proyecto ([`PDD v1.0.docx`](../pdd/PDD%20v1.0.docx), secciones "Objetivo Principal", "Objetivos Específicos" y "Alcance"). Su contraste con lo implementado está en [1.2.1 Objetivos y alcances definitivos](1-2-1-objetivos-y-alcances.md).

### 1.1.4.1 Objetivos

**Objetivo principal.** Desarrollar una plataforma web integral dirigida a todo el ecosistema de mascotas para la gestión y optimización de la búsqueda de mascotas perdidas, mediante la centralización de información y el uso de tecnologías avanzadas como geolocalización, inteligencia artificial y mecanismos de participación comunitaria, para aumentar significativamente la eficiencia en la localización y recuperación de animales extraviados.

| Objetivo específico | Problema relevado que atiende |
|---|---|
| Centralizar y estructurar toda la información de casos de mascotas perdidas y encontradas | Sitio fuera de servicio (Tabla 1.1-4); información repartida entre grupos y casos sin estado (Tabla 1.1-8) |
| Implementar un sistema de matching automático que conecte reportes de pérdidas con avistamientos | Sin comparación automática de fotos en los sistemas relevados (Tabla 1.1-9) |
| Facilitar la comunicación entre dueños, voluntarios y rescatistas | Contacto por fuera de la plataforma (Tabla 1.1-9) |
| Crear una comunidad activa y comprometida con el bienestar animal | No surge del relevamiento |
| Validar un modelo de negocio sostenible basado en suscripciones de comercios | No surge del relevamiento |

Tabla 1.1-10. Objetivos específicos preliminares. Fuente: PDD v1.0, "Objetivos Específicos"; Tablas 1.1-4, 1.1-8 y 1.1-9.

### 1.1.4.2 Alcances preliminares

| Incluido | No incluido |
|---|---|
| Sistema de gestión de mascotas y publicaciones (CRUD completo) | Desarrollo de aplicación móvil nativa (iOS/Android) |
| Motor de reconocimiento y matching de imágenes | Integración con entidades gubernamentales o servicios de vigilancia |
| Sistema de geolocalización y mapas interactivos | Servicios de rescate o transporte de animales |
| Moderación automática de publicaciones | Acuerdos de asociación con organizaciones externas (puede hacerse post-MVP) |
| Generador automático de flyers | |
| Sistema de comunicación interna (chat) | |
| Sistema de notificaciones | |
| Módulo de gamificación | |
| Dashboard de comercios | |
| Sistema de publicidad segmentada | |

Tabla 1.1-11. Alcance preliminar del nuevo sistema. Fuente: PDD v1.0, "Alcance".
