# ADR-0009: Mapas con Leaflet y OpenStreetMap, Nominatim y PostGIS

- **Estado:** Aceptada
- **Responsables:** Gabriel Valdivieso (POC); Agustín Díaz (endpoints geográficos); Matías Alvarado (interfaz de mapa)

## Decisión

Los mapas usan Leaflet con OpenStreetMap, la geocodificación inversa (coordenadas a dirección) usa el servicio público Nominatim y las búsquedas por cercanía se resuelven en la base con PostGIS.

## Motivo

- La POC comparó Google Maps, Mapbox y Leaflet con OpenStreetMap. Google Maps y Mapbox exigen registrar un medio de pago, un riesgo económico en un proyecto universitario; el crédito gratuito que cita la POC fue reemplazado por cupos por API, pero la conclusión no cambia porque sigue exigiéndose una cuenta de facturación.
- Leaflet con OpenStreetMap es de código abierto, no requiere claves comerciales, cubre los requisitos (ubicar mascotas y delimitar radios de cercanía) y tiene una curva de aprendizaje baja. Al ser un piloto acotado a San Rafael, se priorizó mitigar el riesgo económico.
- Nominatim no formó parte de la POC y su elección no quedó documentada. Se validó después que es adecuado: es el geocodificador oficial de OpenStreetMap (las direcciones salen de los mismos datos que el mapa), gratuito y sin claves, en línea con el criterio de costo cero.

## Consecuencias

- La política del Nominatim público limita el uso a 1 solicitud por segundo por aplicación (sumando todos los usuarios) y exige identificarla. Hoy cada navegador lo consulta directo: alcanza para el piloto, pero no escala con muchos usuarios simultáneos (proxy con caché o servicio propio, a evaluar según [ADR-0018](0018-criterio-evolucion-tecnologica.md), [#216](https://github.com/ISI-ProyectoFinal-2026/Grupo1/issues/216)).

## Referencias

[POC de mapas](../pocs/poc_mapas), [PR #115](https://github.com/ISI-ProyectoFinal-2026/Grupo1/pull/115), [PR #146](https://github.com/ISI-ProyectoFinal-2026/Grupo1/pull/146), [issue #216](https://github.com/ISI-ProyectoFinal-2026/Grupo1/issues/216); [política de Nominatim](https://operations.osmfoundation.org/policies/nominatim/); [cambios de Google Maps](https://developers.google.com/maps/billing-and-pricing/march-2025).
