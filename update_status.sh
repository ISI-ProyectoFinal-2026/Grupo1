#!/bin/bash

PROJECT=1
OWNER="ISI-ProyectoFinal-2026"
REPO="ISI-ProyectoFinal-2026/Grupo1"

echo "🔄 Reorganizando Issues en el Proyecto..."
echo ""

# BLOCKERS
echo "🔥 Marcando BLOCKERS..."
for issue in 113 110 63 72 75; do
  gh issue edit $issue --repo $REPO --add-label "status: 🔥 BLOCKERS" 2>&1 | grep -i "added\|error" || echo "✓ #$issue"
done

echo ""
echo "📋 Marcando READY TO ASSIGN..."
for issue in 65 64 69 68; do
  gh issue edit $issue --repo $REPO --add-label "status: 📋 Ready" 2>&1 | grep -i "added\|error" || echo "✓ #$issue"
done

echo ""
echo "📦 Marcando BACKLOG..."
for issue in 70 66 125 126 127; do
  gh issue edit $issue --repo $REPO --add-label "status: 📦 Backlog" 2>&1 | grep -i "added\|error" || echo "✓ #$issue"
done

echo ""
echo "✅ Issues marcadas con status labels"
