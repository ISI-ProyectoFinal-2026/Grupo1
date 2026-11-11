import { describe, expect, it } from "vitest";
import { REPORT_STATUS_LABELS } from "@/lib/report-status";

describe("REPORT_STATUS_LABELS", () => {
  it("rejected es el rechazo de la revisión automática", () => {
    expect(REPORT_STATUS_LABELS.rejected).toBe("Rechazado");
  });

  it("hidden es el ocultamiento por denuncias", () => {
    expect(REPORT_STATUS_LABELS.hidden).toBe("Oculto por denuncias");
  });

  it("conserva el resto de las etiquetas", () => {
    expect(REPORT_STATUS_LABELS.pending).toBe("Pendiente");
    expect(REPORT_STATUS_LABELS.published).toBe("Publicado");
    expect(REPORT_STATUS_LABELS.resolved).toBe("Resuelto");
  });
});
