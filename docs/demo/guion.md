# Guion de la demo

Recorrido para presentar Patitas con los datos del seed de demo (#371). Los puntajes salen del Backend IA real; no hay ninguno escrito a mano.

## 1. Preparación (antes de cada presentación)

1. Levantar el stack y verificar los servicios (ver la sección "Demo con un solo comando" del `README.md`):

   ```bash
   docker compose up -d
   docker compose exec backend node dist/scripts/preflight.js
   ```

2. Cargar los datos de demo. La contraseña de los usuarios de demo no tiene valor por defecto: se define en `SEED_DEMO_PASSWORD` (en `backend/.env` o en el comando) y tiene que cumplir la regla del registro (8 caracteres, mayúscula, minúscula y número). Con la demo expuesta por un túnel, usar una contraseña que no esté en el repositorio (mismo criterio que el administrador del seed, #319).

   ```bash
   docker compose exec -e SEED_DEMO_PASSWORD='<contraseña>' backend node dist/scripts/seed-demo.js
   ```

   El seed borra y vuelve a crear todo lo de los usuarios `@demo.patitas.local`, así que se puede correr las veces que haga falta. Termina con error si `NODE_ENV=production`, si faltan R2 o el Backend IA, o si la calibración del par y del negativo no se cumple.

3. **Correr el smoke test** (CP-001 del [catálogo de casos de prueba](../qa/catalogo-casos-prueba.md)). Si falla, no se presenta hasta resolverlo.

   ```bash
   cd frontend
   SEED_DEMO_PASSWORD='<contraseña>' npm run smoke:demo
   ```

   Usa `BASE_URL` (por defecto `http://localhost:5173`) y `SMOKE_EMAIL` (por defecto `diego@demo.patitas.local`). Borra el reporte que crea al terminar.

## 2. Datos cargados

Usuarios (todos con la contraseña de `SEED_DEMO_PASSWORD`): `ana`, `bruno`, `carla` (moderadora), `diego` y `elena`, con el dominio `@demo.patitas.local`. Todos los reportes están en San Rafael, dentro del radio de matching de 5 km.

| Reporte | Autor | Tipo | Foto | Estado |
|---|---|---|---|---|
| Se perdió Toby, perro de agua negro | ana | perdido | `toby-lost.jpg` | publicado |
| Buscamos a Lola, border collie | elena | perdido | `lola-lost.jpg` | publicado |
| Perdimos a Pancho, salchicha | elena | perdido | `pancho-lost.jpg` | publicado |
| Se perdió Mishi (ya apareció) | ana | perdido | `mishi.jpg` | resuelto |
| Encontré un perro negro en el parque | bruno | encontrado | `toby-found.jpg` | publicado |
| Golden encontrado en la plaza | bruno | encontrado | `golden-found.jpg` | publicado |
| Salchicha de pelo largo en la terminal | diego | encontrado | `dachshund-found.jpg` | publicado, con 2 denuncias pendientes |

También quedan cargados un chat entre Bruno y Ana sobre el reporte de Toby, la Veterinaria Huellitas (plan Premium, con dos anuncios y métricas) y el Refugio Patas Felices. Las fotos y sus licencias están en `backend/demo-assets/`.

## 3. Puntajes verificados

Medidos con el Backend IA real (YOLOv8n + DINOv2 ViT-B/14) el 2026-11-24. El seed los vuelve a verificar en cada corrida.

| Caso | Reportes | Similitud | Resultado esperado |
|---|---|---|---|
| Par de la misma mascota | Toby perdido / perro negro encontrado | 0,695 | Supera 0,63: coincidencia con notificación |
| Foto del smoke test | Toby perdido / `toby-smoke.jpg` | 0,646 | Supera 0,63 |
| Negativo | Toby perdido / golden encontrado | -0,067 | No supera 0,45: sin coincidencia |

## 4. Recorrido en vivo

1. Ingresar como `ana@demo.patitas.local` y abrir "Se perdió Toby": muestra la coincidencia con el perro negro encontrado (70 %), calculada por el modelo.
2. Mostrar que el golden encontrado, cerca de Toby, no aparece como coincidencia.
3. Ingresar como `diego@demo.patitas.local`, crear un reporte "Mascota Encontrada" con `backend/demo-assets/toby-smoke.jpg` y la ubicación actual. En segundos pasa de "Pendiente" a "Publicado" y aparece la coincidencia con Toby (65 %).
4. Confirmar la coincidencia, abrir el reporte de Toby y usar "Contactar al autor" para abrir el chat.
5. Como `carla@demo.patitas.local` (moderadora), revisar las denuncias pendientes del salchicha de la terminal.
