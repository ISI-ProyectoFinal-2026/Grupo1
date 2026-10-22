# ADR-0002: Backend con Express 5, TypeScript y Zod en capas

- **Estado:** Aceptada
- **Responsables:** Franco Marín

## Decisión

El backend principal usa Express 5 con TypeScript y Zod, organizado en capas: rutas, controladores, servicios, validadores y middlewares.

## Motivo

- Es una API REST de tamaño medio con comunicación en tiempo real, hecha por cuatro integrantes en un plazo acotado.
- El equipo conocía Express, aunque no en profundidad, y lo consideró adecuado por su curva de aprendizaje baja y su amplio ecosistema de middlewares. No hubo una evaluación formal de alternativas.
- Validación posterior: Express 5 propaga los errores asíncronos al manejador central (9 de 10 controladores sin `try/catch`), helmet, express-rate-limit y CORS se integran directo, Socket.IO comparte el servidor HTTP y Zod unifica validación y tipos.

## Alternativas

Análisis posterior: NestJS impondría más estructura y curva de aprendizaje; Fastify rinde más, pero con menos middlewares, y el volumen esperado no lo requiere.

## Consecuencias

- La estructura en capas la define y la mantiene el equipo, porque el framework no la impone.

## Referencias

[PR #48](https://github.com/ISI-ProyectoFinal-2026/Grupo1/pull/48); [auditoría del backend](../AUDITORIA_INTEGRAL_BACKEND_2026-09-23.md), sección B.
