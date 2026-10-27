# ADR-0001: Monorepo y separación en dos backends

- **Estado:** Aceptada
- **Responsables:** Matías Alvarado

## Decisión

Un monorepo con los paquetes `frontend/`, `backend/`, `backend-ia/`, `docker/` y `docs/`. El procesamiento de imágenes con IA se separa en un servicio propio (`backend-ia/`).

## Motivo

- El monorepo da más orden y centraliza el código, la integración continua, la documentación y la gestión de issues de un equipo de cuatro integrantes.
- Las librerías de visión por computadora usadas (YOLO, OpenCLIP, PyTorch) pertenecen al ecosistema Python.
- La inferencia, intensiva en CPU, bloquearía el backend principal si se ejecutara en el mismo proceso: un solo backend para IA y para el resto del proyecto sería demasiado pesado.

## Consecuencias

- Repositorio más pesado, con dos lenguajes y dos stacks de testing.

## Referencias

[PR #45](https://github.com/ISI-ProyectoFinal-2026/Grupo1/pull/45), [PR #46](https://github.com/ISI-ProyectoFinal-2026/Grupo1/pull/46); servicio de IA en [ADR-0005](0005-fastapi-servicio-ia.md).
