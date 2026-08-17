# GitHub Actions & Automatizaciones

Documentación de todos los workflows y automatizaciones activas en el repositorio `ISI-ProyectoFinal-2026/Grupo1`.

---

## Resumen

| Nombre | Archivo | Trigger | Propósito |
|--------|---------|---------|-----------|
| Snyk Security | `.github/workflows/snyk-security.yml` | push/PR a `main` | Escaneo de vulnerabilidades en dependencias y código |
| CI | `.github/workflows/ci.yml` | push/PR a `main` | Typecheck + tests automáticos con base de datos real |
| Dependabot | `.github/dependabot.yml` | Schedule (automático) | Actualización automática de dependencias |

---

## 1. Snyk Security

**Archivo:** `.github/workflows/snyk-security.yml`

Escanea el código y las dependencias en busca de vulnerabilidades de seguridad conocidas. Sube los resultados al tab **Security → Code scanning** de GitHub en formato SARIF.

**Qué hace:**
- Instala el CLI de Snyk
- Corre `snyk code test` sobre el backend Node.js (análisis estático SAST)
- Corre `snyk monitor` sobre todos los proyectos del repo para rastrear vulnerabilidades de dependencias en el dashboard de Snyk
- Sube el reporte `.sarif` a GitHub para visualización inline en el código

**Requiere:**
- Secret `SNYK_TOKEN` configurado en el repositorio (Settings → Secrets)

---

## 2. CI — Tests & Typecheck

**Archivo:** `.github/workflows/ci.yml`

Pipeline de integración continua. Corre dos jobs **en paralelo** en cada push y pull request a `main`.

### Job: `Backend (Node.js)`

Verifica que el código TypeScript compila y que todos los tests pasan contra una base de datos real.

| Step | Qué hace |
|------|----------|
| Build and start PostgreSQL | Construye la imagen custom (`docker/postgres/`) con PostGIS + pgvector y levanta el contenedor |
| Setup Node.js | Instala Node 20 con cache de npm |
| Install dependencies | `npm ci` — instalación limpia y reproducible |
| Typecheck | `tsc --noEmit` — detecta errores de tipos sin compilar |
| Run migrations | `prisma migrate deploy` — aplica todas las migraciones al schema |
| Generate Prisma Client | `prisma generate` — genera el cliente tipado para los tests |
| Run tests | `jest --coverage` — tests de integración reales con reporte de cobertura |

**Variables de entorno usadas en CI:**
- `DATABASE_URL`: apunta al contenedor de Postgres levantado en el job
- `JWT_SECRET`: valor de prueba (no es el secreto de producción)

### Job: `Backend IA (Python)`

Verifica que los tests de la IA pasan contra una base de datos real con PostGIS y pgvector.

| Step | Qué hace |
|------|----------|
| Build and start PostgreSQL | Idem al job de Node.js |
| Setup Node.js + Run migrations | Necesario para crear el schema que los tests de Python usan |
| Setup Python 3.11 | Con cache de pip — la primera corrida es lenta por torch/torchvision |
| Install Python dependencies | `pip install -r requirements.txt` |
| Run tests | `pytest tests/ -v` — YOLO y OpenCLIP son mockeados por `conftest.py` |

**Nota sobre dependencias pesadas:** torch, torchvision y ultralytics (~2GB) se cachean entre corridas. La primera ejecución tarda varios minutos; las siguientes son rápidas.

---

## 3. Dependabot

**Archivo:** `.github/dependabot.yml`

Abre pull requests automáticos cuando hay versiones nuevas disponibles de las dependencias. No requiere configuración manual ni secrets.

| Ecosistema | Directorio | Frecuencia |
|------------|-----------|------------|
| npm | `/backend` | Semanal |
| pip | `/backend-ia` | Semanal |
| github-actions | `/` | Mensual |

Los PRs de Dependabot pasan por el CI igual que cualquier otro PR, por lo que una actualización rota no puede mergear si los tests fallan.

---

## Relación entre Snyk y Dependabot

Cubren capas distintas y se complementan:

- **Snyk** → detecta si una dependencia *ya instalada* tiene una vulnerabilidad conocida (CVE). Alerta aunque no haya versión nueva disponible.
- **Dependabot** → abre PRs para actualizar a versiones nuevas cuando existen, con o sin vulnerabilidad.

En conjunto: Snyk avisa del riesgo, Dependabot propone la solución.

---

## Activar protección de rama (pendiente)

Para que el CI bloquee merges con tests rotos, un **owner de la organización** debe configurar:

`Settings → Branches → Add rule → main → Require status checks to pass`

Seleccionar: `Backend (Node.js)` y `Backend IA (Python)`.

Sin esta configuración el CI corre y muestra el resultado, pero no impide mergear código roto.
