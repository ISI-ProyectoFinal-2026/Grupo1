# Backup de la base y de las imágenes

Runbook del servicio `backup` (issue #263, [ADR-0026](adr/0026-backup-servicio-node-docker.md)). El código está en `backup/`.

## Qué se respalda

| Qué | Cómo | Dónde |
|---|---|---|
| Base PostgreSQL `patitas` | `pg_dump -Fc` (formato custom de PostgreSQL 16) | Local: `<BACKUP_HOST_DIR>/db/patitas-<timestamp UTC>.dump`. Remoto: `BACKUP_R2_BUCKET`, prefijo `db/` |
| Imágenes de la app | Copia incremental del bucket `SOURCE_IMAGES_BUCKET` (CopyObject del lado del servidor) | `BACKUP_R2_BUCKET`, prefijo `images/` (misma clave que en el origen) |

El timestamp del nombre es UTC, por ejemplo `patitas-20261115T060000Z.dump`.

Estructura generada:

```
<BACKUP_HOST_DIR>/                 (por defecto ../patitas-backups, fuera del repo)
├── db/                            dumps rotados
│   └── patitas-<timestamp>.dump
└── restore/                       dumps descargados de R2 al restaurar (no rotan: borrarlos a mano)

<BACKUP_R2_BUCKET>/
├── db/patitas-<timestamp>.dump    copia de los dumps, misma retención
└── images/<clave original>        copia de las imágenes, nunca se borra
```

Las imágenes no se guardan en la carpeta local: se copian de bucket a bucket dentro de R2.

## Frecuencia

Una vez por día, a la hora `BACKUP_HOUR` (default `3`) en la zona horaria `TZ` del contenedor. El servicio programa la siguiente ejecución dentro del propio proceso; no usa cron ni el programador de tareas del sistema operativo.

El backup solo corre mientras el stack de Docker está levantado con el perfil `backup`. El punto de recuperación (RPO) es de 24 horas.

## Retención de los dumps

La misma regla se aplica a la carpeta local y al prefijo `db/` del bucket de backup:

- **Diarios:** el último dump de cada uno de los 7 días más recientes que tienen dumps.
- **Semanales:** el último dump de cada una de las 4 semanas ISO (lunes a domingo) más recientes que tienen dumps.
- Todo lo demás se borra. Un mismo dump puede contar como diario y como semanal.

Los días y semanas se cuentan en UTC y solo entre los que tienen dumps: si el servicio estuvo apagado varios días, no se borran de más. Los archivos que no siguen el formato de nombre (por ejemplo, un `.partial` de un dump interrumpido o un archivo copiado a mano) nunca se borran.

Las imágenes **no rotan**: la copia agrega objetos nuevos y vuelve a copiar los que cambiaron de tamaño o ETag, pero **nunca borra nada** bajo `images/`. Una imagen borrada en el origen sigue en el backup; el bucket de backup solo crece (issue #288).

## Comportamiento ante fallas

Cada paso (dump, rotación local, subida, rotación remota, imágenes) es independiente. Si uno falla, el error queda en el log con el nombre del paso y los demás siguen: si R2 no responde, el dump local se genera y se rota igual. El servicio sigue programando las ejecuciones siguientes. Con `run-once`, el proceso termina con código `1` si algún paso falló.

Para revisar el log:

```bash
docker compose logs -f backup
```

## Por qué no se usa versionado de R2

Cloudflare R2 no soporta versionado de buckets ni Object Lock ([API S3 de R2](https://developers.cloudflare.com/r2/api/s3/api/)). Por eso los dumps se rotan explícitamente y las imágenes se copian a un bucket separado en lugar de conservar versiones en el mismo bucket.

## Puesta en marcha

1. **Bucket de backup.** En el panel de Cloudflare R2, crear un bucket exclusivo para backups (por ejemplo `patitas-backups`), distinto del bucket de imágenes.
2. **Token de API.** Crear un token de API de R2 con permiso de lectura y escritura de objetos, limitado a los **dos** buckets: el de backup y el de imágenes. La copia de imágenes lee del bucket de imágenes y escribe en el de backup con las mismas credenciales.
3. **Variables.** Copiar `backup/.env.example` a `backup/.env` y completar los valores (detalle en `docker/ENV_VARS.md`):

    | Variable | Obligatoria | Descripción |
    |---|---|---|
    | `BACKUP_R2_ENDPOINT` | Sí | `https://<account-id>.r2.cloudflarestorage.com` |
    | `BACKUP_R2_ACCESS_KEY_ID` | Sí | Access key del token |
    | `BACKUP_R2_SECRET_ACCESS_KEY` | Sí | Secret del token |
    | `BACKUP_R2_BUCKET` | Sí | Bucket de backup |
    | `SOURCE_IMAGES_BUCKET` | Sí | Bucket de imágenes (mismo valor que `R2_BUCKET_NAME` del backend) |
    | `BACKUP_HOUR` | No | Hora local diaria, 0 a 23. Default `3` |
    | `TZ` | No | Zona horaria de `BACKUP_HOUR`. Sin valor, UTC |
    | `DATABASE_URL` | Lo fija Compose | `postgresql://…@postgres:5432/…` |
    | `BACKUP_DIR` | Lo fija Compose | `/backups` dentro del contenedor |

    Opcional, en el `.env` de la raíz del repo: `BACKUP_HOST_DIR`, la carpeta del host para los dumps locales. Default `../patitas-backups` (carpeta hermana del repo, fuera del control de versiones).

4. **Levantar el servicio:**

    ```bash
    docker compose --profile backup up -d
    ```

    Levanta también `postgres` y espera a que esté sano. Sin `--profile backup`, `docker compose up -d` no levanta el servicio de backup, así que quien no tenga credenciales de R2 no se ve afectado.

5. **Confirmar el arranque.** En `docker compose logs backup` deben aparecer `Servicio de backup iniciado` y `Próximo backup: …`. Si falta alguna variable, el log dice `Faltan variables de entorno para el backup: …` con la lista exacta y el contenedor se reinicia.

## Backup manual

Con el servicio corriendo:

```bash
docker compose exec backup node dist/cli.js run-once
```

Sin el servicio corriendo:

```bash
docker compose --profile backup run --rm backup run-once
```

## Restauración en una base vacía

Se restaura siempre en una base **nueva y vacía**, nunca directamente sobre la base en uso. La imagen del proyecto (`docker/postgres`) ya trae PostGIS y pgvector, así que la base destino tiene las extensiones disponibles.

1. **Elegir el dump.** Locales: carpeta `db/` dentro de `BACKUP_HOST_DIR` (dentro del contenedor, `/backups/db/`). Remotos: claves `db/patitas-<timestamp>.dump` del bucket de backup, visibles en el panel de R2.

2. **Levantar una base vacía con la imagen del proyecto**, en la red de Compose para que el contenedor de backup la alcance. La red se llama `<proyecto>_default`; el proyecto es el nombre de la carpeta del repo en minúsculas (`grupo1` → `grupo1_default`). Confirmarlo con `docker network ls`.

    ```bash
    docker build -t patitas-postgres ./docker/postgres
    docker run -d --name patitas-restore --network grupo1_default \
      -e POSTGRES_USER=patitas -e POSTGRES_PASSWORD=patitas \
      -e POSTGRES_DB=patitas_restore \
      -p 5434:5432 patitas-postgres
    docker exec patitas-restore pg_isready -U patitas -d patitas_restore
    ```

3. **Restaurar.** `--target` es obligatorio; el servicio no tiene destino por defecto para no pisar la base en uso por error.

    Desde un dump local:

    ```bash
    docker compose --profile backup run --rm backup restore \
      /backups/db/patitas-20261115T060000Z.dump \
      --target postgresql://patitas:patitas@patitas-restore:5432/patitas_restore
    ```

    Desde R2 (se descarga primero a `/backups/restore/`):

    ```bash
    docker compose --profile backup run --rm backup restore \
      r2:db/patitas-20261115T060000Z.dump \
      --target postgresql://patitas:patitas@patitas-restore:5432/patitas_restore
    ```

    En Git Bash (Windows), anteponer `MSYS_NO_PATHCONV=1` al comando: si no, Git Bash convierte `/backups/...` en una ruta de Windows y `pg_restore` no encuentra el archivo.

    El comando ejecuta `pg_restore --no-owner --clean --if-exists`. Si `pg_restore` termina con errores, el comando sale con código distinto de cero y muestra el final de su salida de error; revisar esos mensajes y completar la verificación antes de dar el backup por válido.

4. **Verificar** (siguiente sección).

5. **Limpiar** cuando ya no se use: `docker rm -f patitas-restore`.

## Verificación de una restauración

Conectarse a la base restaurada:

```bash
docker exec -it patitas-restore psql -U patitas -d patitas_restore
```

- [ ] **Extensiones:** `\dx` lista `postgis` y `vector`.
- [ ] **Esquema:** `\dt` lista las tablas de la aplicación, y la última migración aplicada coincide con la de la base de origen:

    ```sql
    SELECT migration_name FROM _prisma_migrations ORDER BY finished_at DESC LIMIT 1;
    ```

- [ ] **Cantidad de filas:** la consulta siguiente devuelve conteos exactos por tabla. Ejecutarla en la base restaurada y en la de origen (`docker exec -it patitas-postgres psql -U patitas -d patitas`) y comparar. Las diferencias solo se justifican por datos creados en el origen después del timestamp del dump.

    ```sql
    SELECT table_name,
           (xpath('/row/c/text()',
                  query_to_xml(format('SELECT count(*) AS c FROM %I.%I', table_schema, table_name),
                               false, true, '')))[1]::text::bigint AS filas
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    ORDER BY table_name;
    ```

- [ ] **Imágenes:** en el panel de R2, el prefijo `images/` del bucket de backup contiene las claves del bucket de imágenes.

## Comandos del servicio

| Comando | Qué hace |
|---|---|
| `node dist/cli.js` o `daemon` | Valida la configuración y programa el backup diario (comando por defecto del contenedor) |
| `node dist/cli.js run-once` | Backup completo ahora: dump, rotación local, subida, rotación remota e imágenes |
| `node dist/cli.js restore <dump> --target <url>` | Restaura `<dump>` (ruta local o `r2:db/<archivo>`) en la base `<url>` |

## Desarrollo

```bash
cd backup
npm ci --legacy-peer-deps
npm run typecheck && npm run typecheck:tests
npm test
```

El job `backup` de `.github/workflows/ci.yml` corre los mismos pasos.
