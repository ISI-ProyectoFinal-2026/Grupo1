import ReportForm from "@/components/reports/ReportForm";

export default function CreateReportPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-5 sm:px-6 lg:py-8">
      <h1 className="font-display text-display-lg">Crear Reporte</h1>
      <p className="mt-2 max-w-prose text-ink-muted">
        Ayudá a encontrar una mascota perdida o reportá una que encontraste
      </p>
      <div className="mt-6 sm:card sm:p-6">
        <ReportForm />
      </div>
    </div>
  );
}
