# ADR-0029: El backend principal es el único servicio que accede a la base de datos

- **Estado:** Aceptada
- **Responsables:** Agustín Díaz

## Decisión

Solo el backend principal lee y escribe en PostgreSQL. El backend de IA pasa a ser un servicio de inferencia sin estado: recibe imágenes y devuelve análisis y embeddings, y el backend principal persiste los embeddings, busca los candidatos y registra las coincidencias.

## Motivo

- Un único dueño del esquema y un único responsable de comunicarse con la base de datos.
- Los servicios pueden desplegarse en servidores distintos; concentrar el acceso a la base en el backend principal evita que el servicio de IA dependa de ella.

## Alternativas

Mantener el acceso compartido y agregar un test de contrato del esquema entre Prisma y el backend de IA ([#213](https://github.com/ISI-ProyectoFinal-2026/Grupo1/issues/213)): detecta la divergencia, pero no la evita.

## Consecuencias

- La búsqueda vectorial y geográfica del matching se reescribe en el backend principal con SQL crudo, porque Prisma no modela el tipo `vector`.
- Los parámetros del matching ([ADR-0014](0014-parametros-matching.md)) pasan a la configuración del backend principal y el aviso interno de coincidencias deja de ser necesario.
- El backend de IA ya no necesita credenciales de la base; el test de contrato de #213 queda obsoleto.

## Referencias

[ADR-0001](0001-monorepo-y-dos-backends.md); [ADR-0004](0004-prisma-5-orm.md); [ADR-0005](0005-fastapi-servicio-ia.md); [issue #213](https://github.com/ISI-ProyectoFinal-2026/Grupo1/issues/213).
