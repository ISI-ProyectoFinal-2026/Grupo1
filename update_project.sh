#!/bin/bash

REPO="ISI-ProyectoFinal-2026/Grupo1"
PROJECT=1

echo "🔧 PASO 1: Verificando campos del proyecto..."
gh project field-list $PROJECT --owner ISI-ProyectoFinal-2026 | grep -E "^(Priority|Status|Depends)" || echo "✓ Campos ya existen"

echo ""
echo "📊 PASO 2: Clasificando y actualizando Issues..."

# Array de tuplas: (issue, priority, status, dependsOn)
declare -a ISSUES=(
  # BLOCKERS - Sin dependencias
  "113:High:Todo:"
  "110:High:Todo:"
  "63:High:Blocked:#113"
  "72:High:Todo:"
  "75:High:Todo:"
  
  # READY - Dependen de bloqueadores
  "65:High:Blocked:#63"
  "64:Medium:Blocked:#63"
  "69:Medium:Blocked:#63"
  "68:Medium:Blocked:#72"
  
  # BACKLOG/INTEGRATION
  "70:Medium:Blocked:#69"
  "66:High:Blocked:#65"
  "125:High:Blocked:#63,#65,#69"
  "126:High:Blocked:#68,#72"
  "127:High:Blocked:#65,#75,#64"
  
  # QA LOW PRIORITY
  "42:Low:Todo:"
  "39:Low:Todo:"
  "40:Low:Todo:"
  "41:Low:Todo:"
  
  # MORE STORIES
  "37:Medium:Todo:"
  "36:Medium:Todo:"
  "25:Medium:Todo:"
  "26:Medium:Todo:"
  "67:High:Todo:"
  "38:Low:Todo:"
  "35:Low:Todo:"
  "34:Low:Todo:"
  "33:Low:Todo:"
  "32:Low:Todo:"
  "31:Low:Todo:"
  "30:Low:Todo:"
  "29:Low:Todo:"
  "28:Low:Todo:"
  "27:Low:Todo:"
  "24:Low:Todo:"
  "23:Low:Todo:"
  "22:Low:Todo:"
  "21:Low:Todo:"
)

# Aplicar labels de Priority y Status
for item in "${ISSUES[@]}"; do
  IFS=':' read -r issue priority status depends <<< "$item"
  
  # Priority label
  gh issue edit $issue --repo $REPO --remove-label "priority: low,priority: medium,priority: high" 2>/dev/null
  gh issue edit $issue --repo $REPO --add-label "priority: $priority" 2>/dev/null
  
  # Status label
  gh issue edit $issue --repo $REPO --remove-label "status: Todo,status: In Progress,status: In Review,status: Done,status: Blocked" 2>/dev/null
  gh issue edit $issue --repo $REPO --add-label "status: $status" 2>/dev/null
  
  # Depends On (como label si no existe campo custom)
  if [ -n "$depends" ] && [ "$depends" != "" ]; then
    gh issue edit $issue --repo $REPO --add-label "depends-on: $depends" 2>/dev/null
  fi
  
  echo "✓ #$issue → Priority: $priority | Status: $status | Depends: $depends"
done

echo ""
echo "✅ Issues actualizadas"
