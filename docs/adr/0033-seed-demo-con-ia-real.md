# ADR-0033: Seed de demo versionado que publica los reportes a través del Backend IA real

- **Estado:** Aceptada
- **Responsables:** Matías Alvarado

## Decisión

Los datos de la demo se cargan con un seed versionado que crea los reportes por el mismo camino que la aplicación: los publica el Backend IA real, que genera los embeddings y las coincidencias. Las fotos, de dominio público o CC0 y con su fuente registrada en un manifiesto, viajan en el repositorio y en la imagen del backend. Un smoke test de Playwright recorre el flujo principal contra el Docker Compose antes de cada presentación.

## Motivo

- El seed anterior no estaba en el repositorio, insertaba coincidencias con porcentajes escritos a mano y no generaba embeddings: un reporte cargado en vivo nunca coincidía con los sembrados.
- Bajaba las fotos de sitios externos sin licencia conocida, así que fallaba en otra máquina o sin acceso a esos sitios.
- Todas las pruebas de integración usan un stub de IA: nada garantizaba que el recorrido central funcionara con los modelos reales antes de presentar.

## Alternativas

Insertar los embeddings precalculados en la base: descartado porque saltea la moderación y el matching reales, y quedaría desalineado ante cualquier cambio del modelo.

## Consecuencias

- El seed necesita R2 y el Backend IA en funcionamiento, y tarda unos 25 s porque espera a que se publique cada reporte.
- El seed verifica la calibración en cada corrida: si el par de la misma mascota no supera el umbral de notificación o el caso negativo alcanza el de coincidencia, termina con error.
- El smoke test no corre en CI, porque necesita R2 y los modelos reales. Es una verificación manual antes de cada presentación.

## Referencias

[Issue #371](https://github.com/ISI-ProyectoFinal-2026/Grupo1/issues/371); [ADR-0014](0014-parametros-matching.md); [ADR-0021](0021-modelo-embeddings-dinov2.md); [ADR-0031](0031-demo-local-docker-compose.md).
