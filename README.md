# 🐾 PATITAS - Plataforma de Búsqueda de Mascotas

Aplicación web para reportar y buscar mascotas perdidas/encontradas con **matching automático visual** basado en IA.

---

## 🎯 Características Principales

✅ **Reporte de mascotas** - Perdida o encontrada  
✅ **Matching por IA** - Similitud visual + proximidad geográfica  
✅ **Geolocalización** - Búsqueda por radio en mapas  
✅ **Chat interno** - Comunicación directa entre usuarios  
✅ **Notificaciones** - Alertas de posibles coincidencias  

---

## 🏗️ Arquitectura

- **Frontend:** React 18 + TypeScript + Vite
- **Backend Principal:** Node.js + Express + Prisma
- **Backend IA:** Python + FastAPI + YOLO + OpenCLIP
- **Base de datos:** PostgreSQL + PostGIS + pgvector
- **Cache/Queue:** Redis
- **Storage:** Cloudflare R2

Ver [ARQUITECTURA.md](./ARQUITECTURA.md) para detalles completos.

---

## 🚀 Quick Start

### Requisitos
- Docker & Docker Compose
- Node.js 20.x (para desarrollo sin Docker)
- Python 3.11+ (para Backend IA sin Docker)

### Setup Local (Docker)

```bash
# 1. Clonar repositorio
git clone https://github.com/ISI-ProyectoFinal-2026/Grupo1.git
cd Grupo1

# 2. Crear archivo .env
cp docker/.env.example docker/.env
# Editar docker/.env con tus credenciales de R2 (si quieres usar storage)

# 3. Levantar servicios
docker-compose up -d

# 4. Migraciones de BD (en otra terminal)
docker-compose exec backend npx prisma migrate dev --name init

# 5. Acceder a los servicios
# Frontend:    http://localhost:5173
# Backend:     http://localhost:3001
# Backend IA:  http://localhost:8000
# pgAdmin:     http://localhost:5050
```

### Setup Local (Sin Docker)

**Backend Principal:**
```bash
cd backend
npm install
npm run dev  # http://localhost:3001
```

**Backend IA:**
```bash
cd backend-ia
python -m venv venv
source venv/bin/activate  # En Windows: venv\Scripts\activate
pip install -r requirements.txt
python -m uvicorn app.main:app --reload  # http://localhost:8000
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev  # http://localhost:5173
```

---

## 📁 Estructura

```
patitas/
├── frontend/           # React SPA
├── backend/            # Node.js API principal
├── backend-ia/         # Python IA service
├── docker/             # Configuración Docker
├── docs/               # Documentación
├── scripts/            # Utilidades
├── docker-compose.yml  # Orquestación
└── ARQUITECTURA.md     # Especificación técnica
```

Ver [ESTRUCTURA_PROYECTO.md](./ESTRUCTURA_PROYECTO.md) para detalles completos.

---

## 📚 Documentación

| Documento | Propósito |
|-----------|-----------|
| [ARQUITECTURA.md](./ARQUITECTURA.md) | Diseño técnico completo |
| [ESTRUCTURA_PROYECTO.md](./ESTRUCTURA_PROYECTO.md) | Árbol de carpetas |
| [docs/API.md](./docs/API.md) | Especificación de endpoints |
| [docs/DATABASE.md](./docs/DATABASE.md) | Esquema de BD |
| [CONTRIBUTING.md](./CONTRIBUTING.md) | Guía de contribución |

---

## 🔄 Flujo Principal

1. **Usuario sube imagen** → Se guarda en Cloudflare R2
2. **Backend crea reporte** → Estado: pendiente
3. **Reporte se encola** → Job en Redis Queue
4. **Backend IA procesa** → YOLO + OpenCLIP
5. **Se buscan similares** → pgvector matching
6. **Usuario confirma** → Match manual

Ver [ARQUITECTURA.md#4-flujo-funcional](./ARQUITECTURA.md#4-flujo-funcional---caso-de-uso-principal) para diagrama detallado.

---

## 🛠️ Desarrollo

### Comandos Útiles

```bash
# Backend
npm run dev              # Desarrollo
npm run build            # Build
npm run test             # Tests
npm run lint             # Linter

# Migraciones
npx prisma migrate dev   # Nueva migración
npx prisma studio       # Ver BD gráficamente

# Frontend
npm run dev              # Desarrollo
npm run build            # Build
npm run preview          # Preview
npm run test             # Tests

# Backend IA
python -m uvicorn app.main:app --reload
pytest                   # Tests
```

---

## 🚢 Despliegue

Consultar [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md) para:
- Configuración de producción
- Variables de entorno
- Despliegue en AWS/Google Cloud/Hetzner
- Monitoreo y logs

---

## 📝 Contribuir

1. Crea una rama: `git checkout -b feature/tu-feature`
2. Haz commits descriptivos: `git commit -m "feat: descripción"`
3. Push: `git push origin feature/tu-feature`
4. Abre un PR

Ver [CONTRIBUTING.md](./CONTRIBUTING.md) para detalles.

---

## 📊 Stack Resumido

| Capa | Tecnología |
|------|-----------|
| Frontend | React 18, TypeScript, Vite, Tailwind |
| Backend | Node.js, Express, Prisma, PostgreSQL |
| IA | Python, FastAPI, YOLO v8, OpenCLIP |
| Infra | Docker, Redis, PostgreSQL+PostGIS+pgvector |
| Storage | Cloudflare R2 |
| Queue | Redis Queue (o RabbitMQ/SQS) |

---

## 📞 Contacto

- **Email:** thebochitas@gmail.com
- **GitHub:** [ISI-ProyectoFinal-2026/Grupo1](https://github.com/ISI-ProyectoFinal-2026/Grupo1)

---

**Proyecto Final - Ingeniería de Software 2026**  
Último update: 2026-08-06
