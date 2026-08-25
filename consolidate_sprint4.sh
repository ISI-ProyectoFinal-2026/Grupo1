#!/bin/bash

REPO="ISI-ProyectoFinal-2026/Grupo1"

echo "🔗 Consolidando issues viejas Sprint 4..."
echo ""

# Mapeo: old_issue -> new_issue
declare -A mapping=(
  [68]="137"   # Chat UI -> Chat UI
  [69]="138"   # Comercios UI -> Comercios
  [70]="138"   # Dashboard -> Comercios
  [67]="139"   # Flyers -> Flyers
)

for old_issue in 68 69 70 67; do
  new_issue=${mapping[$old_issue]}
  echo "Cerrando #$old_issue → Consolidada en #$new_issue"
  gh issue close $old_issue --repo $REPO \
    --comment "✅ Consolidada en #$new_issue

Esta issue ha sido combinada en una issue más grande para mejor organización.

Ver: https://github.com/$REPO/issues/$new_issue" 2>&1 | grep -v "^$"
done

echo ""
echo "✅ Consolidación Sprint 4 completa"
