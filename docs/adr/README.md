# Registro de decisiones de arquitectura (ADR)

Cada decisión de arquitectura o tecnología del proyecto tiene un ADR corto en esta carpeta. El motivo lo aporta el equipo; no se infiere.

## Cómo usarlo

1. Copiar [`0000-plantilla.md`](0000-plantilla.md) como `NNNN-slug.md` con el siguiente número libre.
2. Completar los campos con el motivo dado por el equipo y agregar una fila al índice, en la misma PR.
3. Un ADR `Aceptada` no se edita. Si la decisión cambia, crear un ADR nuevo que enlace al anterior; el anterior solo cambia su Estado a `Reemplazada por ADR-XXXX`.

## Numeración

- C01-C17 corresponden a ADR-0001 a ADR-0017, y CX01 (criterio de evolución tecnológica) a ADR-0018.
- Las decisiones C18 en adelante se numeran a partir de ADR-0019, en orden.
- La columna C-ID vincula cada ADR con su candidato de decisión.

## Índice

| ADR | Título | Estado | Responsables | C-ID | Reemplaza / Reemplazada por |
|---|---|---|---|---|---|

## Pendientes

- C12 (pipeline de IA para matching) y C15 (moderación de imágenes): se cierran con los resultados del benchmark de `backend-ia/benchmarks/`.
