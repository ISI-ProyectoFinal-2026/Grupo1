#!/bin/bash

REPO="ISI-ProyectoFinal-2026/Grupo1"
SPRINT4="Sprint 4 – Desarrollo + Notificaciones"

echo "📝 Creando issues consolidadas Sprint 4..."
echo ""

# SPRINT 4 - Issue 1: Chat & Notifications Backend
gh issue create --repo $REPO \
  --title "[BACKEND] Chat & Notifications Complete (Endpoints + Socket.io)" \
  --body "Consolidación de #72 (Chat endpoints) + #75 (Notifications)

## Objetivo
Implementar backend completo para chat en tiempo real y notificaciones.

### PARTE A: Chat Endpoints (#72)
- [ ] Crear /api/chats (GET lista + POST crear)
- [ ] Crear /api/chats/:id/messages (GET + POST)
- [ ] Socket.io connection handler
- [ ] Message persistence en BD
- [ ] Proteger con JWT middleware

### PARTE B: Notifications (#75)
- [ ] Crear /api/notifications (GET + PUT read + DELETE)
- [ ] Crear notificación cuando:
  - Nuevo match encontrado
  - Nuevo mensaje recibido
- [ ] Usuarios no ven notificaciones de otros

## Criterios de Aceptación
- [ ] POST /api/chats retorna 201
- [ ] GET /api/chats/:id/messages ordena por fecha
- [ ] Socket.io emite mensajes en tiempo real
- [ ] Notificaciones se crean automáticamente
- [ ] Tests de integración pasan

## Prioridad
🔴 URGENT - Desbloquea frontend de Chat

## Estimación
6-8 horas" \
  --label "priority: Urgent,epic: chat,epic: notificaciones" \
  --milestone "$SPRINT4" 2>&1 | grep -o "#[0-9]*" | head -1

echo "✓ Chat & Notifications Backend creada"
echo ""

# SPRINT 4 - Issue 2: Chat UI
gh issue create --repo $REPO \
  --title "[FEATURE] Real-time Chat UI (Socket.io)" \
  --body "Frontend de chat en tiempo real (Issue #68)

## Objetivo
Implementar interfaz completa de chat con sincronización en tiempo real.

## Tareas
- [ ] ChatList component (conversaciones activas)
- [ ] ChatWindow component (historial + input)
- [ ] MessageBubble component (styling)
- [ ] useChatSocket hook (Socket.io connection)
- [ ] useChatsQuery hook (TanStack Query)
- [ ] ChatPage con layout

## Criterios de Aceptación
- [ ] Listar chats del usuario
- [ ] Enviar mensaje aparece en tiempo real
- [ ] Recibir mensaje del otro usuario funciona
- [ ] Historial carga correctamente
- [ ] Desconexión/reconexión maneja bien
- [ ] Sin memory leaks

## Dependencias
Espera: Chat & Notifications Backend

## Prioridad
🟠 HIGH

## Estimación
4-5 horas" \
  --label "priority: High,epic: chat" \
  --milestone "$SPRINT4" 2>&1 | grep -o "#[0-9]*" | head -1

echo "✓ Chat UI creada"
echo ""

# SPRINT 4 - Issue 3: Comercios
gh issue create --repo $REPO \
  --title "[FEATURE] Comercios Registration & Dashboard" \
  --body "Consolidación de #69 (Comercios UI) + #70 (Dashboard)

## Objetivo
Permitir comercios registrarse y ver su panel de control.

### PARTE A: Comercios Registration (#69)
- [ ] Formulario con campos: nombre, CUIT, domicilio, teléfono, rubro
- [ ] Selección de plan (free/pro/premium)
- [ ] Validación de campos
- [ ] Crear cuenta tipo 'comercio'

### PARTE B: Dashboard (#70)
- [ ] Vista exclusiva para comercios
- [ ] Estadísticas: contactos, reportes, vistas
- [ ] Estado de suscripción
- [ ] Formulario editable de info

## Backend Status
✓ Endpoints already implemented (#76)

## Criterios de Aceptación
- [ ] Registro crea usuario tipo comercio
- [ ] Dashboard muestra stats
- [ ] Solo comercios ven dashboard
- [ ] Editable y persiste cambios

## Dependencias
Espera: Sprint 3 Auth

## Prioridad
🟠 HIGH

## Estimación
6-7 horas" \
  --label "priority: High,epic: comercios" \
  --milestone "$SPRINT4" 2>&1 | grep -o "#[0-9]*" | head -1

echo "✓ Comercios creada"
echo ""

# SPRINT 4 - Issue 4: Flyers
gh issue create --repo $REPO \
  --title "[FEATURE] Flyers Generator & Download + Image Upload Chat" \
  --body "Consolidación de #67 (Flyer generator) + #37 (Image upload chat)

## Objetivo
Permitir usuarios crear flyers y compartir imágenes en chat.

### PARTE A: Flyer Generator (#67)
- [ ] Canvas-based flyer creator
- [ ] Seleccionar template
- [ ] Agregar texto/imagen
- [ ] Preview
- [ ] Descargar PDF

### PARTE B: Image Upload Chat (#37)
- [ ] Socket.io + file upload handler
- [ ] Mostrar imagen en chat
- [ ] Validar tipos/tamaño

## Criterios de Aceptación
- [ ] Crear flyer funciona
- [ ] PDF descarga correctamente
- [ ] Imágenes en chat aparecen
- [ ] Validación de archivos

## Dependencias
Espera: Chat Backend ready

## Prioridad
🟡 MEDIUM

## Estimación
5-6 horas" \
  --label "priority: Medium,epic: flyers" \
  --milestone "$SPRINT4" 2>&1 | grep -o "#[0-9]*" | head -1

echo "✓ Flyers creada"
echo ""

# SPRINT 4 - Issue 5: IA Matching Pipeline
gh issue create --repo $REPO \
  --title "[INTEGRATION] IA Matching Pipeline E2E (Report → pgvector → Matches)" \
  --body "Validación completa de IA processing (Issue #127)

## Objetivo
Validar que el pipeline de IA funciona end-to-end.

## Tareas
- [ ] Report creation dispara Backend-IA (fire-and-forget)
- [ ] Backend-IA procesa imagen (YOLO + OpenCLIP)
- [ ] Embeddings guardan en pgvector
- [ ] Query matching retorna similares ordenados
- [ ] Frontend muestra matches cuando están ready

## Validación
- [ ] Crear reporte → Backend-IA procesa sin errores
- [ ] Embeddings en pgvector correctos
- [ ] Matching retorna 3-5 similares
- [ ] Performance: <5s por imagen
- [ ] No hay reportes stuck en 'processing'

## Criterios de Aceptación
- [ ] E2E flow funciona
- [ ] Matches se muestran en Report Detail
- [ ] Performance OK
- [ ] No hay stuck states

## Dependencias
Espera: Sprint 3 Mascota Creation (90%)

## Prioridad
🟠 HIGH

## Estimación
4-6 horas" \
  --label "priority: High,epic: matching,epic: qa" \
  --milestone "$SPRINT4" 2>&1 | grep -o "#[0-9]*" | head -1

echo "✓ IA Matching creada"
echo ""

# SPRINT 4 - Issue 6: Chat Integration Testing
gh issue create --repo $REPO \
  --title "[QA] Chat Real-time Integration Testing" \
  --body "Testing completo de chat en tiempo real (Issue #126)

## Objetivo
Validar que Socket.io ↔ Frontend sync funciona correctamente.

## Test Cases
- [ ] Socket.io server conecta correctamente
- [ ] Frontend se conecta sin errores
- [ ] Enviar mensaje aparece en tiempo real
- [ ] Recibir mensaje del otro usuario funciona
- [ ] Historial carga correctamente
- [ ] Desconexión/reconexión maneja bien
- [ ] Sin memory leaks en listeners

## Testing Methods
- Manual: 2+ usuarios en 2 browsers
- Integración: Valida Socket.io + Chat API
- Performance: Carga 100+ mensajes

## Criterios de Aceptación
- [ ] Flujo chat sincronizado
- [ ] Sin errores en consola
- [ ] Memory profile limpio
- [ ] Performance aceptable

## Dependencias
Espera: Chat UI + Backend (95%)

## Prioridad
🟠 HIGH - Gate para producción

## Estimación
2-3 horas" \
  --label "priority: High,epic: qa,epic: chat" \
  --milestone "$SPRINT4" 2>&1 | grep -o "#[0-9]*" | head -1

echo "✓ Chat Integration Testing creada"
echo ""
echo "✅ Sprint 4 issues creadas"
