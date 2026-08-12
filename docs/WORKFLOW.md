# Workflow de Desarrollo — Grupo1 PATITAS

## Metodología de trabajo

Cada miembro del equipo tiene una rama personal permanente donde realiza todo su trabajo en paralelo. Las PRs se revisan antes de integrar a main.

---

## Setup inicial (primera vez)

### 1. Crear tu rama personal
Reemplaza `{tu-nombre}` con tu nombre (ej: `matias`, `juan`, `maria`):

```bash
git checkout -b {tu-nombre}/features origin/main
```

**Ejemplos:**
- `git checkout -b matias/features origin/main`
- `git checkout -b juan/features origin/main`
- `git checkout -b maria/features origin/main`

Esta rama es **permanente** — nunca se elimina. Es tu workspace personal.

---

## Flujo diario de trabajo

### 1. Asegúrate de estar en tu rama
```bash
git checkout {tu-nombre}/features
```

### 2. Trabaja normalmente
```bash
git commit -m "feat: descripción del cambio"
git commit -m "fix: corrección de bug"
# ... más commits según sea necesario
```

### 3. Pushea regularmente
```bash
git push origin {tu-nombre}/features
```

### 4. Cuando esté lista una tarea/issue
Abre un Pull Request desde tu rama personal hacia `main`:

```bash
gh pr create --title "feat: descripción" \
  --body "Closes #14"  # Incluir número de issue que cierra
```

O manualmente en GitHub:
- Base: `main`
- Compare: `{tu-nombre}/features`
- Descripción: Incluir `Closes #XX` para auto-cerrar la issue

### 5. Code review
- Espera a que un compañero revise el PR
- Responde feedback si hay
- Reviewer aprueba y mergea a `main`

### 6. Después del merge
Sincroniza tu rama con los cambios nuevos en `main`:

```bash
git pull origin main
```

Luego continúa trabajando normalmente en tu rama para la próxima tarea.

---

## Formato de commits

Usar **Conventional Commits**:

- `feat: agregar nueva funcionalidad`
- `fix: corregir bug en componente X`
- `refactor: reorganizar código`
- `docs: actualizar documentación`
- `test: agregar tests para X`
- `chore: actualizar dependencias`

### Ejemplo real
```bash
git commit -m "feat: agregar CRUD de reportes con PostGIS

- Crear reportes con foto, ubicación, descripción
- Filtros por tipo y estado
- 27 tests de validación

Closes #14"
```

---

## Reglas clave

| Regla | Descripción |
|-------|-------------|
| ✅ Una rama por persona | Tu rama personal (`{tu-nombre}/features`) es permanente |
| ✅ Todos los commits en tu rama | Jamás commitear directamente a `main` |
| ✅ PRs hacia `main` | Siempre review antes de merge |
| ✅ Sincronizar después de merge | `git pull origin main` después que el PR se mergee |
| ✅ Reusable | La misma rama se usa para múltiples issues consecutivas |

---

## Ejemplo completo: Issue #14

```bash
# 1. Estás en tu rama (matias/features)
git checkout matias/features

# 2. Trabajas en la issue
git commit -m "feat: agregar CRUD de reportes"
git commit -m "test: agregar tests para reports"
git push origin matias/features

# 3. Abres PR desde GitHub o CLI
gh pr create --title "feat: reports CRUD (Closes #14)"

# 4. Code reviewer revisa y mergea
# (Esperas a que se complete)

# 5. Sincronizas con main
git pull origin main

# 6. Continúas en la misma rama para issue #15
git commit -m "feat: agregar feature para issue #15"
git push origin matias/features
# ... y repites desde el paso 3
```

---

## Resolver conflictos (si pasa)

Si tu rama se queda muy atrás de `main`:

```bash
git fetch origin
git rebase origin/main
git push --force-with-lease origin {tu-nombre}/features
```

O más conservador, usar merge:
```bash
git fetch origin
git merge origin/main
git push origin {tu-nombre}/features
```

---

## Preguntas frecuentes

**P: ¿Qué pasa si me equivoco en un commit?**  
R: Puedes usar `git commit --amend` para editar el último commit, o crear un nuevo commit de corrección.

**P: ¿La rama se elimina después del merge?**  
R: No. Tu rama es permanente. Seguirás usándola para todas tus issues futuras.

**P: ¿Puedo trabajar en múltiples issues en paralelo?**  
R: Sí, commitea todo en tu rama personal. Luego haz PRs separados cuando cada tarea esté lista.

**P: ¿Qué si main tiene cambios que necesito ahora?**  
R: Sincroniza: `git pull origin main`

---

**Adoptado**: 2026-08-12  
**Versión**: 1.0
