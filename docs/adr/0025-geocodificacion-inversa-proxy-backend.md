# ADR-0025: Geocodificación inversa mediante un proxy en el backend con caché

- **Estado:** Aceptada
- **Responsables:** Franco Marín

## Decisión

La geocodificación inversa deja de consultarse desde el navegador y pasa por un proxy en el backend, con caché por coordenadas redondeadas, límite global de 1 solicitud por segundo e identificación de la aplicación ante Nominatim.

## Motivo

- Es gratis.
- Se implementa en el backend existente, sin infraestructura ni proveedores nuevos.

## Alternativas

Instancia propia de Nominatim: descartada porque exige montar y mantener infraestructura nueva. Proveedor de pago: descartado porque no es gratis y suma un proveedor nuevo.

## Consecuencias

- Se sigue dependiendo del Nominatim público: si deja de estar disponible o bloquea la aplicación, la geocodificación inversa deja de funcionar.
- El límite de 1 solicitud por segundo se respeta pero no se supera: con mucho tráfico en zonas distintas, la caché no alcanza.

## Referencias

[Issue #216](https://github.com/ISI-ProyectoFinal-2026/Grupo1/issues/216); [ADR-0009](0009-mapas-leaflet-osm-nominatim-postgis.md); [ADR-0018](0018-criterio-evolucion-tecnologica.md); [política de Nominatim](https://operations.osmfoundation.org/policies/nominatim/).
