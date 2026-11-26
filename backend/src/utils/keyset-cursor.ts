// paginado keyset por (createdAt, id) en orden descendente (#338)
export interface KeysetCursor {
  createdAt: Date;
  id: number;
}

export interface CursorPage<T> {
  items: T[];
  nextCursor: string | null;
}

const CURSOR_PATTERN = /^(\d{1,15}):(\d{1,10})$/;

export function encodeCursor({ createdAt, id }: KeysetCursor): string {
  return Buffer.from(`${createdAt.getTime()}:${id}`, "utf8").toString("base64url");
}

export function decodeCursor(raw: string): KeysetCursor | null {
  const match = CURSOR_PATTERN.exec(Buffer.from(raw, "base64url").toString("utf8"));
  if (!match) return null;
  const id = Number(match[2]);
  if (id < 1 || id > 2_147_483_647) return null;
  return { createdAt: new Date(Number(match[1])), id };
}

// filas estrictamente anteriores al cursor
export function olderThan({ createdAt, id }: KeysetCursor) {
  return { OR: [{ createdAt: { lt: createdAt } }, { createdAt, id: { lt: id } }] };
}

export const keysetOrderDesc = [{ createdAt: "desc" as const }, { id: "desc" as const }];

// recibe limit + 1 filas: la extra indica que hay otra página
export function toCursorPage<T extends KeysetCursor>(rows: T[], limit: number): CursorPage<T> {
  const items = rows.slice(0, limit);
  const last = items.at(-1);
  return { items, nextCursor: rows.length > limit && last ? encodeCursor(last) : null };
}
