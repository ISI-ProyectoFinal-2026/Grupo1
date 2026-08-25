#!/bin/bash

REPO="ISI-ProyectoFinal-2026/Grupo1"

# Primero, obtener info del proyecto
echo "📋 Obteniendo info del proyecto..."
gh api graphql -f query='
  query {
    organization(login: "ISI-ProyectoFinal-2026") {
      projectV2(number: 1) {
        id
        fields(first: 20) {
          nodes {
            ... on ProjectV2SingleSelectField {
              id
              name
              options {
                id
                name
              }
            }
          }
        }
      }
    }
  }
' 2>&1 | grep -o '"name":"[^"]*"' | head -30

echo ""
echo "✅ GraphQL query ejecutado"
