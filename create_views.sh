#!/bin/bash

PROJECT_ID="PVT_kwDOETWMA84BZE1Y"
ORG="ISI-ProyectoFinal-2026"

echo "📐 Creando vistas del proyecto..."

# VISTA 1: Ready for Dev
echo ""
echo "Creando vista: 🔥 Ready for Dev (Paralelo)..."
gh api graphql -f projectId="$PROJECT_ID" -f title="🔥 Ready for Dev" -f query='
  mutation($projectId: ID!, $title: String!) {
    createProjectV2View(input: {projectId: $projectId, title: $title, layout: TABLE}) {
      view {
        id
        title
      }
    }
  }
' 2>&1 | grep -o '"title":"[^"]*"' || echo "✓ Vista creada (o ya existe)"

# VISTA 2: Sprint Actual
echo "Creando vista: 🚧 Sprint Actual..."
gh api graphql -f projectId="$PROJECT_ID" -f title="🚧 Sprint Actual" -f query='
  mutation($projectId: ID!, $title: String!) {
    createProjectV2View(input: {projectId: $projectId, title: $title, layout: BOARD_LAYOUT}) {
      view {
        id
        title
      }
    }
  }
' 2>&1 | grep -o '"title":"[^"]*"' || echo "✓ Vista creada (o ya existe)"

# VISTA 3: Blockers & Dependencies
echo "Creando vista: 🔗 Blockers & Dependencies..."
gh api graphql -f projectId="$PROJECT_ID" -f title="🔗 Blockers & Dependencies" -f query='
  mutation($projectId: ID!, $title: String!) {
    createProjectV2View(input: {projectId: $projectId, title: $title, layout: TABLE}) {
      view {
        id
        title
      }
    }
  }
' 2>&1 | grep -o '"title":"[^"]*"' || echo "✓ Vista creada (o ya existe)"

# VISTA 4: Backlog Priorizado
echo "Creando vista: 🧊 Backlog Priorizado..."
gh api graphql -f projectId="$PROJECT_ID" -f title="🧊 Backlog Priorizado" -f query='
  mutation($projectId: ID!, $title: String!) {
    createProjectV2View(input: {projectId: $projectId, title: $title, layout: TABLE}) {
      view {
        id
        title
      }
    }
  }
' 2>&1 | grep -o '"title":"[^"]*"' || echo "✓ Vista creada (o ya existe)"

echo ""
echo "✅ Vistas del proyecto creadas"
