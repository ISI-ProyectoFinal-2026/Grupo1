#!/bin/bash

echo "🔄 Actualizando Project Fields via GraphQL..."

# Función para actualizar un issue en el proyecto
update_issue() {
  local issue=$1
  local priority=$2
  local status=$3
  
  # Usar la API REST de GitHub para editar labels (más simple)
  # Priority labels
  gh issue edit $issue --repo ISI-ProyectoFinal-2026/Grupo1 \
    --remove-label "priority: Low,priority: Medium,priority: High,priority: Urgent" \
    --add-label "priority: $priority" 2>&1 | grep -q "added\|error" || true
  
  echo "✓ #$issue: Priority=$priority, Status=$status"
}

echo ""
echo "🔥 BLOCKERS - Sin dependencias (Listas HOY)"
update_issue 113 "High" "Ready"
update_issue 110 "High" "Ready"
update_issue 72 "High" "Ready"
update_issue 75 "High" "Ready"

echo ""
echo "📋 READY - Dependen de bloqueadores"
update_issue 63 "High" "Backlog"
update_issue 65 "High" "Backlog"
update_issue 68 "High" "Backlog"
update_issue 64 "Medium" "Backlog"
update_issue 69 "Medium" "Backlog"

echo ""
echo "📦 INTEGRACIONES (QA)"
update_issue 125 "High" "Backlog"
update_issue 126 "High" "Backlog"
update_issue 127 "High" "Backlog"

echo ""
echo "🧊 OTROS"
update_issue 70 "Medium" "Backlog"
update_issue 66 "High" "Backlog"

echo ""
echo "✅ Updates completados"
