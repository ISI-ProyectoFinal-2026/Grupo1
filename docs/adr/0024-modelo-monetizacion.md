# ADR-0024: Modelo de monetización con un plan pago y publicidad segmentada por cercanía

- **Estado:** Aceptada
- **Responsables:** Agustín Díaz

## Decisión

Los comercios tienen un plan gratuito permanente y un único plan pago, Premium, que habilita publicar anuncios segmentados por cercanía. Hasta integrar una pasarela de pago, la compra del plan se confirma con un proveedor de pago simulado.

## Motivo

- La publicidad se ofrece a cualquier comercio del ámbito de los animales que esté en la plataforma.
- Solo hay dos modelos, gratuito y pago, con un único plan pago.
- Los anuncios se publican al crearlos para evitar el trabajo manual y el retardo de publicación.
- El pago simulado permite demostrar el flujo completo de compra en el entorno desplegado mientras no exista la pasarela.

## Alternativas

Mantener dos planes pagos (Pro y Premium); que un administrador asigne el plan; aprobar cada anuncio antes de publicarlo; filtrar los anuncios con la moderación por IA, que solo detecta si la foto contiene un animal y rechazaría anuncios de productos o locales ([ADR-0016](0016-moderacion-hibrida.md)); que el anuncio enlace a un sitio externo.

## Consecuencias

- Mientras el proveedor de pago sea el simulado, cualquier comercio puede obtener Premium sin pagar.
- Un comercio necesita la ubicación cargada en el mapa para publicar anuncios, porque la segmentación se mide desde ella.
- Eliminar el plan Pro requiere una migración del esquema.

## Modelo decidido

### Captación

| Pregunta | Decisión |
| --- | --- |
| Comercios a los que se apunta | Cualquier comercio relacionado con animales: veterinarias, pet shops, refugios y otros. La propuesta de valor es publicitar sus productos y servicios en la plataforma. |
| Cómo llega el comercio | Autorregistro y compra del plan dentro de la plataforma. El equipo también busca comercios por fuera del sistema. |
| Plan gratuito o prueba | Plan gratuito permanente, sin período de prueba. Incluye aparecer en el directorio y el panel con métricas de visitas y contactos; no incluye publicidad. |

Tabla 1. Decisiones sobre la captación de comercios. Fuente: equipo, issue #30.

### Planes y suscripción

| Pregunta | Decisión |
| --- | --- |
| Planes | Gratuito y Premium. Se elimina Pro. |
| Facturación | Mensual (USD 30) o anual (USD 300). Los precios son configurables. |
| Vencimiento | Al vencer, el comercio vuelve al plan gratuito en el momento. El plan vigente se calcula al leerlo, comparando el vencimiento con la fecha actual. Una renovación con el plan vigente se suma al vencimiento actual. |
| Anuncios al vencer | Quedan pausados y vuelven a mostrarse solos al renovar. |
| Medio de pago | Pasarela de pago dentro de la plataforma. Por ahora se construyen las pantallas de compra y la compra se confirma con un proveedor simulado, activo también en el entorno desplegado. La pasarela real reemplaza al proveedor simulado sin cambiar el flujo. |
| Límites de Premium | Hasta 3 anuncios activos a la vez, cada uno con un radio de 1 a 20 km. |

Tabla 2. Decisiones sobre planes y suscripción. Fuente: equipo, issue #30.

### Publicidad

| Pregunta | Decisión |
| --- | --- |
| Contenido del anuncio | Imagen, título y texto corto. El clic lleva al perfil del comercio dentro de la plataforma. El perfil suma una descripción y enlaces a la web y a las redes del comercio. |
| Dónde se muestra | Detalle del reporte (bloque de comercios cercanos y banner), feed de reportes (banner intercalado con la etiqueta "Publicidad") y directorio (comercios Premium primero, marcados como destacados). No se muestra al crear o editar reportes, en chats, autenticación, seguridad, moderación ni en el flyer. |
| Comercios cercanos y directorio | Incluyen todos los comercios, gratuitos y Premium. Los Premium aparecen primero como destacados; el resto se ordena por distancia. El bloque de comercios cercanos muestra hasta 5, dentro de 20 km del reporte. |
| Segmentación | Solo por cercanía. En el detalle del reporte, desde la ubicación del reporte; en el feed, desde la ubicación que el usuario aceptó compartir. Un anuncio es elegible si el punto cae dentro de su radio, medido desde el comercio. |
| Usuario sin ubicación compartida | Igual ve publicidad: un anuncio sin segmentar, elegido al azar entre los activos. Rechazar el permiso no evita los anuncios. |
| Privacidad | Solo se usan la ubicación del reporte y la ubicación ya consentida. El comercio ve totales, nunca la identidad ni la ubicación de quien vio el anuncio. Los eventos se registran sin usuario y sin coordenadas. Si el usuario revoca el consentimiento, el feed deja de segmentarse. |
| Aprobación | Publicación inmediata, sin aprobación previa. Los usuarios pueden denunciar un anuncio; la denuncia entra en la cola de moderación y el moderador puede darlo de baja o desestimar la denuncia. Dar de baja cierra las demás denuncias pendientes del anuncio, y un anuncio dado de baja no se puede editar ni reactivar. |
| Métricas | Impresiones (cuando el banner entra en pantalla), clics, tasa de clics, por día y por ubicación en la plataforma. Las conversiones no se miden. |
| Texto "Solo el plan Premium permite publicar anuncios." | Se mantiene, porque pasa a ser cierto. Un comercio gratuito ve además una invitación a pasar a Premium. |

Tabla 3. Decisiones sobre la publicidad. Fuente: equipo, issue #30.

## Referencias

[Issue #30](https://github.com/ISI-ProyectoFinal-2026/Grupo1/issues/30), [issue #179](https://github.com/ISI-ProyectoFinal-2026/Grupo1/issues/179); [ADR-0016](0016-moderacion-hibrida.md) (moderación), [ADR-0019](0019-comercio-perfil-no-rol.md) (perfil de comercio).
