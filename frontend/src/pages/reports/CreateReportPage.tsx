import ReportForm from "@/components/reports/ReportForm";

export default function CreateReportPage() {
  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Crear Reporte</h1>
        <p className="text-gray-600">
          Ayudá a encontrar una mascota perdida o reportá una que encontraste
        </p>
      </div>
      <div className="bg-white rounded-lg shadow-md p-6">
        <ReportForm />
      </div>
    </div>
  );
}
