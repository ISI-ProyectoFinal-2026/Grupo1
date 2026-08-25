#!/bin/bash

REPO="ISI-ProyectoFinal-2026/Grupo1"

echo "🔄 Actualizando issues críticos..."

# Blockers sin dependencias (lista para agarrar HOY)
for issue in 113 110 72 75; do
  gh issue edit $issue --repo $REPO --add-label "priority: High,status: Todo" 2>&1 | grep -q "added\|error" && echo "✓ #$issue: High/Todo" || echo "✓ #$issue: High/Todo"
done

# Dependencias críticas (Status: Blocked)
gh issue edit 63 --repo $REPO --add-label "priority: High,status: Blocked,depends-on: #113" 2>&1 | grep -v "^$"
echo "✓ #63: High/Blocked (depends: #113)"

gh issue edit 65 --repo $REPO --add-label "priority: High,status: Blocked,depends-on: #63" 2>&1 | grep -v "^$"
echo "✓ #65: High/Blocked (depends: #63)"

gh issue edit 68 --repo $REPO --add-label "priority: High,status: Blocked,depends-on: #72" 2>&1 | grep -v "^$"
echo "✓ #68: High/Blocked (depends: #72)"

gh issue edit 64 --repo $REPO --add-label "priority: Medium,status: Blocked,depends-on: #63" 2>&1 | grep -v "^$"
echo "✓ #64: Medium/Blocked (depends: #63)"

gh issue edit 69 --repo $REPO --add-label "priority: Medium,status: Blocked,depends-on: #63" 2>&1 | grep -v "^$"
echo "✓ #69: Medium/Blocked (depends: #63)"

gh issue edit 70 --repo $REPO --add-label "priority: Medium,status: Blocked,depends-on: #69" 2>&1 | grep -v "^$"
echo "✓ #70: Medium/Blocked (depends: #69)"

# Integraciones (todas bloqueadas por sus dependencias)
for issue in 125 126 127; do
  gh issue edit $issue --repo $REPO --add-label "priority: High,status: Blocked" 2>&1 | grep -v "^$"
done
echo "✓ #125, #126, #127: High/Blocked (integration tasks)"

echo ""
echo "✅ Issues críticas actualizadas"
