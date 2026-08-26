# 🐾 PATITAS - Arquitectura del Sistema

**Documento:** Definición técnica de la plataforma de búsqueda de mascotas perdidas  
**Versión:** 1.0  
**Fecha:** 2026-08-06

---

## 1. Visión General

Plataforma web para reportar y buscar mascotas perdidas/encontradas con **matching automático visual** basado en IA. El sistema sugiere coincidencias por similitud de imagen + proximidad geográfica, pero **toda confirmación es manual** (decisión del usuario).

---

## 2. Componentes del Sistema

```
┌─────────────────────────────────────────────────────────────┐
│                   FRONTEND (React Web)                      │
│         - Interfaz de usuario                               │
│         - Upload de imágenes                                │
│         - Dashboard de reportes                             │
│         - Chat tiempo real                                  │
└────────────────────┬────────────────────────────────────────┘
                     │ HTTP/REST + WebSocket
        ┌────────────┴────────────┐
        │                         │
┌───────▼──────────────┐  ┌──────▼──────────────────┐
│   BACKEND PRINCIPAL  │  │  BACKEND SERVICIO IA    │
│   (Node.js/Express)  │  │  (Python/FastAPI)       │
│                      │  │                         │
│ - Orquestación       │  │ - YOLO (validación)     │
│ - CRUD reportes      │  │ - OpenCLIP (embeddings) │
│ - Geolocalización    │  │ - Búsqueda vectorial    │
│ - Auth/Users         │  │                         │
│ - Notificaciones     │  │ Procesa jobs de cola    │
│ - Dashboard          │  │                         │
└───────┬──────────────┘  └──────────────────────────┘
        │
   ┌────┴─────────────────┬──────────────┬─────────────┐
   │                      │              │             │
   │ DB Query             │ Enqueue      │             │
   │ (Postgres)           │ (Cola)       │             │
   │                      │              │             │
┌──▼──────────────────┐  ┌▼──────────┐  │  ┌────────────▼──┐
│  POSTGRESQL+        │  │   REDIS   │  │  │ CLOUDFLARE R2 │
│  PostGIS + pgvector │  │   (Queue) │  │  │ (Imágenes)    │
│                     │  │           │  │  │               │
│ - Usuarios          │  │ Job Queue │  │  │ - URL storage │
│ - Mascotas          │  │           │  │  │ - Vinculación │
│ - Reportes          │  └───────────┘  │  │   con reportes│
│ - Matches           │                  │  └───────────────┘
│ - Embeddings        │                  │
│ - Coordenadas       │                  │
│   (PostGIS)         │                  │
│                     │                  │
└─────────────────────┘                  │
                                         │
                        ┌────────────────┘
                        │ (Opcional: SQS/RabbitMQ)
                        │ alternativa a Redis Queue
```

---

## 3. Stack Tecnológico

### Frontend
- **React** 18.x - Framework UI
- **TypeScript** - Tipado estático
- **Vite** - Build tool
- **Tailwind CSS** - Estilos
- **React Router** - Enrutamiento
- **React Query** - Manejo de datos servidor
- **Zustand** - Estado global
- **Socket.io Client** - Chat real-time
- **Leaflet.js** - Mapas

### Backend Principal
- **Node.js** 20.x LTS
- **Express.js** - Framework HTTP
- **TypeScript** - Tipado estático
- **Prisma** - ORM + Migraciones
- **Socket.io** - WebSockets
- **Redis** - Queue + Cache + Sesiones
- **JWT** - Autenticación

### Backend IA
- **Python** 3.11+
- **FastAPI** - Framework web
- **OpenCLIP** - Embeddings de imágenes
- **YOLOv8** - Detección de mascotas
- **Faiss** o **pgvector** - Búsqueda vectorial
- **Pillow/OpenCV** - Procesamiento de imágenes
- **Pydantic** - Validación de datos

### Base de Datos
- **PostgreSQL** 15.x
- **PostGIS** 3.x - Geolocalización
- **pgvector** 0.5.x - Búsqueda vectorial

### Almacenamiento
- **Cloudflare R2** - Imágenes (alternativa: AWS S3, Google Cloud Storage)

### Cola de Trabajo
- **Redis Queue** (Recomendado para MVP, simple, ligero)
- Alternativas: RabbitMQ, AWS SQS

### Infraestructura
- **Docker** - Containerización
- **GitHub Actions** - CI/CD
- **AWS/Google Cloud/Hetzner** - Hosting

---

## 4. Flujo Funcional - Caso de Uso Principal

### 4.1 Publicación de Reporte

```
Usuario                 Frontend                 Backend Ppal          R2        Cola      Backend IA
  │                        │                         │                  │          │           │
  ├─ Sube imagen ─────────>│                         │                  │          │           │
  │                        ├─ Upload a R2 ──────────────────────────────>│          │           │
  │                        │<─ URL de imagen ────────────────────────────┤          │           │
  │                        │                         │                  │          │           │
  │                        ├─ POST /reports ───────>│                  │          │           │
  │                        │   (con URL de R2)      ├─ Guardar en BD   │          │           │
  │                        │                         ├─ Estado: pendiente           │           │
  │                        │<─ 200 OK + ID report ─┤                  │          │           │
  │<─ Confirmación ────────┤                         ├─ Encolar job ───────────────>│           │
  │   (inmediata)          │                         │                  │          │           │
  │                        │                         │                  │          ├─ YOLO ────>│
  │                        │                         │                  │          │ (validar) │
  │                        │                         │                  │          │<─ OK ─────┤
  │                        │                         │                  │          │           │
  │                        │                         │                  │          ├─ OpenCLIP─>│
  │                        │                         │                  │          │ (embedding)
  │                        │                         │                  │          │<─ Vector ──┤
  │                        │                         │<─ Actualizar ─────────────────────────┤
  │                        │                         │   BD (embedding)  │          │           │
  │                        │                         │                  │          │           │
  │                        │                         ├─ Búsqueda vectorial (pgvector)        │
  │                        │                         │   (pre-filtrado: tipo + radio + tiempo)
  │                        │                         │                  │          │           │
  │                        │<─ Notif: Match sugerido┼──────────────────┼──────────┘           │
  │<─ Alerta match ────────┤   (si similitud > umbral)
  │
  └─ Usuario revisa candidatos y confirma manualmente
```

> **Estado de implementación (issue #18):** el flujo de arriba es la arquitectura
> objetivo. Lo implementado hasta ahora (sin cola todavía) es una versión
> simplificada: el Backend Ppal llama a Backend IA de forma síncrona
> *fire-and-forget* (sin esperar la respuesta, sin bloquear al usuario) al
> crear el reporte, y **Backend IA escribe el embedding y los matches
> directo en Postgres** (no hay callback HTTP de vuelta a Backend Ppal). La
> cola Redis y el callback `POST /api/internal/...` quedan como trabajo
> futuro — ver detalle real en 4.2/4.3 y en `backend-ia/README.md`.

### 4.2 Procesamiento de IA

```
Objetivo (con cola, futuro): Backend IA desencola un job de Redis con
{ report_id, image_url } y procesa async.

Implementado hoy (issue #18, sin cola): Backend Ppal llama fire-and-forget
POST {AI_SERVICE_URL}/reports/{report_id}/embedding con { "image_url": ... }
apenas crea el reporte (solo si tiene imagen). Backend IA responde
sincrónicamente dentro de esa misma request:

1. Descargar imagen desde la URL recibida (R2 en producción)

2. Ejecutar YOLOv8 (yolov8n.pt)
   if not is_pet(image):
     return 422  # sin más efecto, no se guarda nada

3. Ejecutar OpenCLIP (ViT-B-32, pretrained laion2b_s34b_b79k)
   embedding = generate_embedding(image)  # vector [512]
   (dimensión validada empíricamente en docs/pocs/POC_Similitudes.ipynb;
   no todo checkpoint de OpenCLIP da 1536, por eso el ajuste de schema)

4. Backend IA guarda directo en Postgres (sin callback a Backend Ppal):
   - UPSERT embedding en report_embeddings
   - Busca coincidencias (pgvector, ver 4.3) y las guarda en report_matches
   - responde 201 a Backend Ppal (que no espera ni usa el body)

Pendiente: notificar al usuario (no existe aún ruta/servicio de
notifications), y mover este paso a un worker de cola en vez de síncrono
dentro de la request.
```

### 4.3 Matching por Similitud

```
Implementado en backend-ia/app/services/matching_service.py, se ejecuta
en el mismo paso 4 de arriba (no es un servicio ni un endpoint aparte):

1. Backend IA, luego de guardar el embedding nuevo, ejecuta:
   SELECT r.id, r.report_type,
     1 - (re.embedding <=> :embedding) AS similarity
   FROM reports r
   JOIN report_embeddings re ON re.report_id = r.id
   WHERE r.status = 'published'
     AND r.report_type != :report_type  -- Tipo opuesto
     AND r.id != :report_id
     AND ST_DWithin(r.location::geography, CAST(:location AS geography), 5000)  -- 5km reales
     AND r.created_at > NOW() - INTERVAL '30 days'
   ORDER BY re.embedding <=> :embedding ASC
   LIMIT 5;

   (`<=>` es la distancia COSENO de pgvector: `1 - (a <=> b)` es la
   similitud coseno con la que se calibro el umbral en el POC, y es el
   unico operador que puede usar el indice HNSW `vector_cosine_ops`.
   `<->` es distancia L2 y NO sirve aca: dos fotos de la misma mascota
   con coseno 0.87 dan L2 0.51, o sea 0.49 de "similitud", debajo del
   umbral de 0.75)

   (el cast a `::geography` es necesario: `reports.location` es
   `geometry(Point, 4326)` en grados, no metros — sin el cast, "5000"
   se interpreta como 5000 grados, no como 5km)

2. Si similarity >= SIMILARITY_THRESHOLD (0.75 hoy — punto medio del rango
   65%-85% que midió el POC, documentado como provisional, ver
   docs/pocs/poc_similitudes.md):
   - UPSERT en report_matches (no pisa un match ya confirmed/rejected)

3. Pendiente (no implementado en la issue #18): notificar al usuario
   dueño del reporte, y el flujo de confirmar/rechazar un match desde
   el frontend (hoy solo hay GET /api/reports/:id/matches de lectura).
```

---

## 5. Esquema de Base de Datos

### Tablas Principales

#### `users`
```sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(255),
  phone VARCHAR(20),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

#### `pets`
```sql
CREATE TABLE pets (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id),
  name VARCHAR(255),
  species VARCHAR(50),  -- dog, cat, other
  breed VARCHAR(255),
  age INT,
  color VARCHAR(100),
  description TEXT,
  photo_urls TEXT[],  -- URLs subidas a Cloudflare R2, mínimo 1 al registrar
  microchip_id VARCHAR(50),
  created_at TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

#### `reports`
```sql
CREATE TABLE reports (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id),
  pet_id INT REFERENCES pets(id),
  
  report_type VARCHAR(20) NOT NULL,  -- 'lost' | 'found'
  status VARCHAR(20) DEFAULT 'pending',  -- pending | published | rejected | resolved
  
  title VARCHAR(255) NOT NULL,
  description TEXT,
  image_url VARCHAR(500),  -- URL en Cloudflare R2
  
  location GEOMETRY(Point, 4326),  -- PostGIS: lat/long
  location_address VARCHAR(500),
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  published_at TIMESTAMP,
  
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (pet_id) REFERENCES pets(id),
  INDEX(status),
  INDEX(report_type),
  SPATIAL INDEX(location)
);
```

#### `report_embeddings`
```sql
CREATE TABLE report_embeddings (
  id SERIAL PRIMARY KEY,
  report_id INT UNIQUE NOT NULL REFERENCES reports(id),
  embedding vector(512),  -- OpenCLIP ViT-B-32 output (validado en el POC)
  created_at TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY (report_id) REFERENCES reports(id)
);
```

#### `report_matches`
```sql
CREATE TABLE report_matches (
  id SERIAL PRIMARY KEY,
  report_lost_id INT NOT NULL REFERENCES reports(id),
  report_found_id INT NOT NULL REFERENCES reports(id),
  
  similarity_score FLOAT,  -- 0-1, calculado por pgvector
  status VARCHAR(20) DEFAULT 'pending',  -- pending | confirmed | rejected
  
  created_at TIMESTAMP DEFAULT NOW(),
  confirmed_at TIMESTAMP,
  
  FOREIGN KEY (report_lost_id) REFERENCES reports(id),
  FOREIGN KEY (report_found_id) REFERENCES reports(id),
  UNIQUE(report_lost_id, report_found_id),
  INDEX(status)
);
```

#### `users` (adicionales para chat/notificaciones)
```sql
-- Chat
CREATE TABLE chats (
  id SERIAL PRIMARY KEY,
  user_a_id INT NOT NULL REFERENCES users(id),
  user_b_id INT NOT NULL REFERENCES users(id),
  report_id INT REFERENCES reports(id),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE messages (
  id SERIAL PRIMARY KEY,
  chat_id INT NOT NULL REFERENCES chats(id),
  sender_id INT NOT NULL REFERENCES users(id),
  content TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY (chat_id) REFERENCES chats(id),
  FOREIGN KEY (sender_id) REFERENCES users(id)
);

-- Notificaciones
CREATE TABLE notifications (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id),
  type VARCHAR(50),  -- match_suggested | message | report_status_change
  title VARCHAR(255),
  message TEXT,
  report_id INT REFERENCES reports(id),
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY (user_id) REFERENCES users(id),
  INDEX(user_id)
);
```

---

## 6. API Endpoints - Backend Principal

### Auth
```http
POST /api/auth/register
POST /api/auth/login
POST /api/auth/logout
POST /api/auth/refresh
```

### Usuarios
```http
GET /api/users/me
PUT /api/users/me
GET /api/users/:id (perfil público)
```

### Mascotas
```http
GET /api/pets
POST /api/pets
GET /api/pets/:id
PUT /api/pets/:id
DELETE /api/pets/:id
```

### Almacenamiento (Cloudflare R2)
```http
POST /api/uploads/presign
```
El backend no recibe los bytes de la imagen: genera una URL PUT firmada (expira a los 5 min) para que el frontend suba directo a R2, y el frontend le pasa la URL final al backend recién en el `POST /pets` o `POST /reports` correspondiente.

Request:
```json
{ "fileName": "foto.png", "contentType": "image/png" }
```
`contentType` solo admite `image/jpeg`, `image/png` o `image/webp`.

Response `201`:
```json
{ "uploadUrl": "...", "publicUrl": "...", "key": "pets/<uuid>.<ext>" }
```

**Estructura de almacenamiento**: los objetos se guardan bajo el prefijo `pets/`, con un nombre generado por el backend (`<uuid>.<ext>`, extensión derivada del `contentType` validado) — nunca el nombre de archivo que manda el cliente, para evitar colisiones y path traversal.

### Reportes
```http
GET /api/reports?type=lost&status=published&page=1
POST /api/reports
GET /api/reports/:id
PUT /api/reports/:id
DELETE /api/reports/:id

GET /api/reports/:id/matches (candidatos sugeridos)
POST /api/reports/:id/matches/:match_id/confirm
POST /api/reports/:id/matches/:match_id/reject
```

### Geolocalización
```http
GET /api/geo/nearby?lat=xx&lng=xx&radius=5000
GET /api/geo/map?bounds=...
```

### Chat
```http
GET /api/chats
POST /api/chats (create o get)
GET /api/chats/:id/messages
POST /api/chats/:id/messages

WebSocket: /ws/chat/:chat_id
```

### Notificaciones
```http
GET /api/notifications
PUT /api/notifications/:id/read
DELETE /api/notifications/:id
```

### Endpoints Internos (Backend Principal → Backend IA)

**Implementado (issue #18)** — al revés de lo planteado originalmente:
Backend IA no le devuelve nada a Backend Ppal, escribe directo en Postgres
(ver 4.2/4.3). El endpoint real vive en Backend IA:

```http
POST {AI_SERVICE_URL}/reports/:report_id/embedding
{
  "image_url": "https://r2.../image-123.jpg"
}
→ 201 si detectó la mascota y guardó embedding + matches
→ 422 si no detectó una mascota en la imagen
```

`POST /api/internal/reports/:report_id/reject` (planteado originalmente
para auditar rechazos) no está implementado — hoy un 422 no deja rastro
más que la respuesta HTTP.

---

## 7. Cola de Trabajo - Flujo de Jobs

> **No implementado todavía** (issue #18 usa fire-and-forget síncrono, ver
> 4.2). Esta sección documenta la arquitectura objetivo para cuando se
> aborde la cola en una iteración futura.

### Modelo de Job (Redis Queue)

```typescript
interface ImageProcessingJob {
  id: string;
  report_id: number;
  image_url: string;  // URL en Cloudflare R2
  created_at: Date;
  retries: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
}
```

### Secuencia

```
1. Backend Principal encola job
   await queue.add({
     report_id: 123,
     image_url: 'https://r2.../image-123.jpg'
   });

2. Worker Backend IA consume job
   queue.process(async (job) => {
     const { report_id, image_url } = job.data;
     
     try {
       // Descargar imagen
       const image = await downloadImage(image_url);
       
       // YOLO validation
       const isPet = await validateWithYOLO(image);
       if (!isPet) {
         await rejectReport(report_id);
         return;
       }
       
       // OpenCLIP embedding
       const embedding = await generateEmbedding(image);
       
       // Enviar al Backend Principal
       await notifyBackendWithEmbedding(report_id, embedding);
       
     } catch (error) {
       // Reintentar (hasta 3 veces)
       throw error;
     }
   });

3. Backend IA notifica al Backend Principal
   POST /api/internal/reports/123/embedding
   {
     "embedding": [0.123, 0.456, ...],
     "status": "published"
   }
   
4. Backend Principal:
   - Actualiza BD
   - Busca similares (pgvector)
   - Notifica al usuario
```

---

## 8. Diagrama de Despliegue

```
┌─────────────────────────────────────────────────────────────┐
│                     CLIENTE FINAL                           │
│              https://patitas.app (frontend)                 │
└────────────────────────┬────────────────────────────────────┘
                         │
           ┌─────────────┼─────────────┐
           │             │             │
        HTTPS         WebSocket      HTTPS
           │             │             │
     ┌─────▼──────┐  ┌──▼───┐  ┌──────▼──────────┐
     │  CDN        │  │ Socket│  │  API Gateway   │
     │(Cloudflare) │  │ Server│  │  (load balance)│
     │(Frontend)   │  │(Node) │  │                │
     └─────┬──────┘  └──┬────┘  └──────┬─────────┘
           │            │              │
           │            └──────┬───────┘
           │                   │
        ┌──▼───────────────────▼──────────┐
        │  BACKEND PRINCIPAL (Node.js)    │
        │  :3001 (interno)                │
        │  - Orquestación                 │
        │  - CRUD                         │
        │  - WebSocket handler            │
        └──┬──────────────────────────────┘
           │
     ┌─────┼─────────────────┬─────────────┐
     │     │                 │             │
  ┌──▼──┐ │            ┌────▼───┐   ┌───▼─────────┐
  │Redis│ │            │Postgres│   │Cloudflare R2│
  │Queue│ │            │+PostGIS│   │ (imágenes)  │
  │     │ │            │+pgvector   │             │
  └─────┘ │            └─────────┘   └─────────────┘
          │
     ┌────▼──────────────────────────┐
     │  BACKEND IA (Python/FastAPI)  │
     │  :8000 (interno)              │
     │  - YOLO validation            │
     │  - OpenCLIP embeddings        │
     │  - Queue worker               │
     └───────────────────────────────┘
```

---

## 9. Variables de Entorno

### Backend Principal
```env
NODE_ENV=production
PORT=3001

# Database
DATABASE_URL=postgresql://user:pass@postgres:5432/patitas
REDIS_URL=redis://redis:6379

# Auth
JWT_SECRET=your-secret-key
JWT_EXPIRY=24h

# External Services
R2_ACCOUNT_ID=your-account
R2_ACCESS_KEY=your-key
R2_SECRET_KEY=your-secret
R2_BUCKET_NAME=patitas-images
R2_ENDPOINT=https://your-account.r2.cloudflarestorage.com

# Backend IA (nombre real de la variable en backend/src/services/matching.service.ts)
AI_SERVICE_URL=http://ia-backend:8000

# Other
FRONTEND_URL=https://patitas.app
```

### Backend IA
```env
PYTHON_ENV=production
PORT=8000

# YOLO / OpenCLIP — nombres de modelo hardcodeados hoy en
# backend-ia/app/ml/pipeline.py (no son variables de entorno todavía),
# validados en docs/pocs/POC_Similitudes.ipynb:
# YOLO: yolov8n.pt (nano, se descarga solo vía ultralytics)
# OpenCLIP: ViT-B-32, pretrained=laion2b_s34b_b79k (NO "openai" — da 512 dims)

DATABASE_URL=postgresql+asyncpg://patitas:patitas@localhost:5433/patitas

# Backend Principal — no implementado (no hay callback HTTP, ver 4.2/6)
# BACKEND_URL=http://backend-principal:3001
# BACKEND_API_KEY=internal-key-for-auth

# Redis (para queue) — no implementado todavía, ver sección 7
# REDIS_URL=redis://redis:6379
```

---

## 10. Consideraciones de Rendimiento

1. **Búsqueda vectorial (pgvector):**
   - Pre-filtrar por tipo de reporte (perdida vs encontrada)
   - Pre-filtrar por radio geográfico (ST_DWithin)
   - Limitar a reportes recientes (últimos 30 días)
   - Esto reduce el espacio de búsqueda drásticamente

2. **Cache (Redis):**
   - Cachear reportes publicados por zona geográfica
   - Cachear embeddings recientes
   - TTL: 1 hora

3. **Índices:**
   - Índice en `reports.status` y `reports.report_type`
   - Índice espacial en `reports.location` (PostGIS)
   - Índice en `report_embeddings.report_id`
   - Índice HNSW en pgvector para búsqueda rápida

4. **Procesamiento asíncrono:**
   - No bloquear usuario con IA
   - Respuesta inmediata tras subir imagen
   - IA procesa en background

---

## 11. Próximos Pasos

1. **Setup local:** Docker Compose con todos los servicios
2. **Base de datos:** Migraciones con Prisma
3. **Backend Principal:** Estructura base, autenticación
4. **Backend IA:** Servicio FastAPI con YOLO + OpenCLIP
5. **Frontend:** Layout base y pantalla de reporte
6. **Integración:** Conectar ambos backends
7. **Testing:** Tests unitarios y E2E

---

**Documento creado:** 2026-08-06  
**Versión:** 1.0  
**Estado:** Listo para implementación
