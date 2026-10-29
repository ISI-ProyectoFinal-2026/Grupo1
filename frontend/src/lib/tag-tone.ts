// Color de la chapita de estado: los tonos del sistema (contraste AA con
// texto blanco) reemplazan a los de la API; una etiqueta desconocida usa el suyo.
const TAG_TONES: Record<string, string> = {
  PERDIDO: "rgb(var(--color-lost))",
  ENCONTRADO: "rgb(var(--color-found))",
  RESUELTO: "rgb(var(--color-success))",
};

export function tagTone(tag: { label: string; color: string }): string {
  return TAG_TONES[tag.label.trim().toUpperCase()] ?? tag.color;
}
