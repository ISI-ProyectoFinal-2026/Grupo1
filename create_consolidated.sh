#!/bin/bash

REPO="ISI-ProyectoFinal-2026/Grupo1"
SPRINT3="Sprint 3 - Features"
SPRINT4="Sprint 4 – Desarrollo + Notificaciones"

echo "📝 Creando issues consolidadas Sprint 3..."
echo ""

# SPRINT 3 - Issue 1: Frontend Setup
gh issue create --repo $REPO \
  --title "[INFRA] Frontend Setup Complete (ErrorBoundary + Router + Prettier)" \
  --body "Consolidación de #113 + #110

## Objetivo
Preparar la infraestructura base del frontend para que todos los features puedan construirse sobre una base sólida.

## Tareas
- [ ] Instalar react-error-boundary y configurar ErrorBoundary
- [ ] Crear router structure con layouts (protegidas + públicas)
- [ ] Implementar página 404
- [ ] Instalar y configurar Prettier
- [ ] Crear .env.example con todas las variables necesarias
- [ ] Documentar setup en README

## Criterios de Aceptación
- [ ] ErrorBoundary cubre toda la app
- [ ] Router tiene estructura clara (auth/protected/public)
- [ ] Prettier se ejecuta con 'npm run format'
- [ ] .env.example lista para copiar

## Prioridad
🔴 URGENT - Desbloquea todo lo demás

## Estimación
2-3 horas" \
  --label "priority: Urgent" \
  --milestone "$SPRINT3" 2>&1 | grep -o "#[0-9]*" | head -1

echo "✓ Frontend Setup creada"
echo ""

# SPRINT 3 - Issue 2: Authentication
gh issue create --repo $REPO \
  --title "[AUTH] Authentication Complete (Login + Register + JWT)" \
  --body "Consolidación de #63 (Frontend) + Backend endpoints

## Objetivo
Implementar flujo completo de autenticación: registro, login y token management.

## Frontend Tareas (#63)
- [ ] LoginForm con react-hook-form + zod validation
- [ ] RegisterForm con react-hook-form + zod validation
- [ ] HTTP client con Axios + JWT interceptor
- [ ] Auth context/store para token management
- [ ] ProtectedRoute wrapper
- [ ] Redirect logic (login si no autenticado)

## Backend Status
✓ Endpoints already implemented (#74 JWT middleware)

## Criterios de Aceptación
- [ ] Registro crea usuario en BD
- [ ] Login genera JWT token
- [ ] Token se envía en Authorization header
- [ ] ProtectedRoute bloquea acceso sin token
- [ ] Logout limpia token

## Dependencias
Espera: Frontend Setup

## Prioridad
🔴 URGENT - Bloqueador para todo

## Estimación
4-6 horas" \
  --label "priority: Urgent" \
  --milestone "$SPRINT3" 2>&1 | grep -o "#[0-9]*" | head -1

echo "✓ Authentication creada"
echo ""

# SPRINT 3 - Issue 3: Mascota Creation & Discovery
gh issue create --repo $REPO \
  --title "[CORE] Mascota Creation & Discovery (Create + Feed + Map)" \
  --body "Consolidación de #65 (Create Report) + #64 (Feed + Map)

## Objetivo
Permitir usuarios crear reportes de mascotas y descubrirlas a través de feed + mapa interactivo.

### PARTE A: Create Report (#65)
- [ ] ReportForm component con campos: tipo mascota, descripción, ubicación
- [ ] ImageUploader: presigned URL flow → R2 upload
- [ ] Form validation con zod
- [ ] Success notification + redirect to feed

### PARTE B: Feed + Map (#64)
- [ ] Feed page con lista de reportes (últimos primero)
- [ ] ReportCard component (título, foto, tipo, ubicación)
- [ ] FilterBar: por tipo, por zona, por fecha
- [ ] Leaflet map con marcadores de reportes
- [ ] Toggle lista/mapa view

## Backend Status
✓ Endpoints already implemented (#71 geo endpoints)

## Criterios de Aceptación
- [ ] Crear reporte con imagen sube a R2 y guarda en BD
- [ ] Feed muestra reportes ordenados por fecha
- [ ] Mapa muestra marcadores con popup de reporte
- [ ] Filtros funcionan (cliente-side primero)
- [ ] Performance: lista carga en <2s

## Dependencias
Espera: Authentication

## Prioridad
🔴 URGENT - Core value

## Estimación
8-10 horas" \
  --label "priority: Urgent" \
  --milestone "$SPRINT3" 2>&1 | grep -o "#[0-9]*" | head -1

echo "✓ Mascota Creation & Discovery creada"
echo ""

# SPRINT 3 - Issue 4: Report Detail + Matches
gh issue create --repo $REPO \
  --title "[FEATURE] Report Detail + Match Preview" \
  --body "Basado en #66

## Objetivo
Mostrar detalle completo de un reporte y los matches sugeridos por IA (cuando están listos).

## Tareas
- [ ] ReportDetailPage (/reports/:id)
- [ ] Mostrar: foto grande, descripción, ubicación, fecha
- [ ] PendingBanner si reporte está en processing
- [ ] MatchCard component para mostrar similares
- [ ] useReportDetailQuery con polling hasta status: published
- [ ] useReportMatchesQuery para traer matches

## Backend Status
✓ Endpoints implemented (#127 integration task)

## Criterios de Aceptación
- [ ] Reporte se carga correctamente
- [ ] Matches aparecen cuando Backend-IA procesa
- [ ] Polling detiene cuando reporte está listo
- [ ] Interfaz responsiva

## Dependencias
Espera: Mascota Creation (solo para referencia)

## Prioridad
🟠 HIGH - Mejora UX

## Estimación
4-5 horas" \
  --label "priority: High" \
  --milestone "$SPRINT3" 2>&1 | grep -o "#[0-9]*" | head -1

echo "✓ Report Detail creada"
echo ""

# SPRINT 3 - Issue 5: Auth-to-Feed E2E Testing
gh issue create --repo $REPO \
  --title "[QA] Sprint 3 Integration Testing (E2E Flow)" \
  --body "Testing completo del flujo MVP

## Objetivo
Validar que todo Sprint 3 funciona end-to-end: login → create report → appear in feed

## Test Cases
- [ ] Registro de usuario funciona
- [ ] Login con credenciales correctas/incorrectas
- [ ] Create report form valida campos
- [ ] Imagen sube a R2 sin errores
- [ ] Reporte aparece en feed inmediatamente
- [ ] Puede ver detalle de reporte
- [ ] Mapa muestra el reporte

## Testing Methods
- Manual: Flujo completo en navegador
- Integración: Valida Auth API + Reports API + R2
- Endpoints: GET/POST /reports, GET /me, etc.

## Criterios de Aceptación
- [ ] Flujo completo sin errores
- [ ] Errores maneja correctamente
- [ ] Performance aceptable

## Dependencias
Espera: Auth + Mascota Creation (casi lista)

## Prioridad
🟠 HIGH - Gate para Sprint 4

## Estimación
3-4 horas" \
  --label "priority: High" \
  --milestone "$SPRINT3" 2>&1 | grep -o "#[0-9]*" | head -1

echo "✓ Integration Testing creada"
echo ""
echo "✅ Sprint 3 issues creadas"
