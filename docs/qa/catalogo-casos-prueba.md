# Catálogo de casos de prueba

Catálogo inicial: lo completa #363 con el formato de las plantillas QArmy.

| ID | Caso | Requerimiento | Precondiciones | Datos de prueba | Pasos | Resultado esperado | Automatización | Estado |
|---|---|---|---|---|---|---|---|---|
| CP-001 | Recorrido principal con el Backend IA real (smoke de la demo) | Reporte con foto, moderación por IA, matching, confirmación y chat | Docker Compose levantado y sano (preflight sin FAIL); seed de demo cargado; R2 accesible | Usuario `diego@demo.patitas.local` con `SEED_DEMO_PASSWORD`; foto `backend/demo-assets/toby-smoke.jpg`; ubicación en San Rafael (-34.6205, -68.327) | 1. Iniciar sesión por el formulario. 2. Crear un reporte "Mascota Encontrada" con la foto y la ubicación actual. 3. Esperar el estado "Publicado". 4. Confirmar la coincidencia con "Se perdió Toby, perro de agua negro". 5. Abrir ese reporte y "Contactar al autor". 6. Enviar un mensaje. | El reporte pasa a "Publicado" en menos de 60 s; aparece la coincidencia con el reporte sembrado (similitud 0,646); queda "Coincidencia confirmada"; se abre `/chats/:id` y el mensaje se ve en la conversación. El reporte creado se borra al terminar. | `frontend/e2e/smoke/demo-real-ai.smoke.ts` (`npm run smoke:demo`); manual, no corre en CI | Aprobado (2026-11-24, dos corridas seguidas) |
