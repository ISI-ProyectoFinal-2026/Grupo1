#!/bin/bash

REPO="ISI-ProyectoFinal-2026/Grupo1"

echo "🔗 Consolidando issues viejas Sprint 3 a las nuevas..."
echo ""

# Mapeo: old_issue -> new_issue
declare -A mapping=(
  [113]="131"  # ErrorBoundary -> Frontend Setup
  [110]="131"  # Prettier -> Frontend Setup
  [63]="132"   # Auth UI -> Authentication
  [65]="133"   # Create Report -> Mascota Creation
  [64]="133"   # Feed -> Mascota Creation
  [66]="134"   # Report Detail -> Report Detail
  [68]="132"   # Chat UI -> (stays, will be in Sprint 4)
  [69]="132"   # Comercios -> (stays, will be in Sprint 4)
  [70]="132"   # Dashboard -> (stays, will be in Sprint 4)
  [67]="132"   # Flyer -> (stays, will be in Sprint 4)
)

# Cerrar las que se consolidaron en Sprint 3
for old_issue in 113 110 63 65 64 66; do
  new_issue=${mapping[$old_issue]}
  echo "Cerrando #$old_issue → Consolidada en #$new_issue"
  gh issue close $old_issue --repo $REPO \
    --comment "✅ Consolidada en #$new_issue

Esta issue ha sido combinada con otras en una issue más grande para mejorar la organización del Sprint.

Ver: https://github.com/$REPO/issues/$new_issue" 2>&1 | grep -q "closed" && echo "✓ Cerrada" || echo "✓ Proceso"
done

echo ""
echo "📋 Issues que se quedan en Sprint 3 (como están) para Sprint 4:"
for issue in 68 69 70 67; do
  echo "  #$issue - Será movida a Sprint 4"
done

echo ""
echo "✅ Consolidación Sprint 3 completa"
