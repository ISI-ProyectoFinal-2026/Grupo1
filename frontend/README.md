# Frontend — Setup inicial

Setup base del frontend (React + Vite + TypeScript + Tailwind + React Router) para la issue "[TASK] Frontend: Setup inicial". Deja la estructura de carpetas y el ruteo mínimo listos para que cualquier feature de UI pueda empezar a desarrollarse.

## Stack

- React + TypeScript (Vite)
- Tailwind CSS v3
- React Router v6
- TanStack Query v5, Zustand y Axios (instalados, listos para usarse en features)

## Estructura

```
src/
  pages/       # páginas ruteadas
  components/  # componentes reutilizables
  layouts/     # layouts (ej. MainLayout con navbar + Outlet)
  services/    # llamadas a la API (axios)
  hooks/       # hooks custom
  types/       # tipos compartidos
router.tsx     # definición de rutas (React Router)
```

## Levantar el proyecto

```bash
cd frontend
npm install
npm run dev
```

Levanta en `http://localhost:5173`. Las requests a `/api/*` se proxean a `http://localhost:3001` (backend, ver `vite.config.ts`).

## Build

```bash
npm run build
```
