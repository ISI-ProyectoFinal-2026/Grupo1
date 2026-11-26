// página con cursor keyset del backend (#338)
export interface CursorPage<T> {
  items: T[]
  nextCursor: string | null
}
