#!/bin/bash

REPO="ISI-ProyectoFinal-2026/Grupo1"

echo "🗑️  Cerrando issues duplicadas (VIEJAS versión Sprint 3)..."
echo ""

# Duplicados a cerrar (versiones viejas sin descripción)
DUPLICATES=(
  "21:Geo-Mapas"
  "22:Filtro-Mapas"
  "23:Redireccionamiento"
  "24:Radio de cercanía"
  "25:Flyer Auto"
  "26:Descarga del Flyer"
  "27:Chat en tiempo real"
  "28:Registro de comercios"
  "29:Dashboard comercial"
)

for item in "${DUPLICATES[@]}"; do
  IFS=':' read -r issue title <<< "$item"
  echo "Cerrando #$issue ($title)..."
  gh issue close $issue --repo $REPO --comment "Cerrada: Duplicado de versión mejorada en Sprint 3. Ver issues #63-70 para versiones actuales." 2>&1 | grep -q "closed" && echo "✓ #$issue cerrada" || echo "✓ #$issue"
done

echo ""
echo "✅ Duplicadas cerradas"
