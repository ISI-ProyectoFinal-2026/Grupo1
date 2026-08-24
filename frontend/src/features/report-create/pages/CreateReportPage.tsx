import ReportForm from "../components/ReportForm";

function CreateReportPage() {
  return (
    <div className="mx-auto max-w-2xl p-6">
      <h1 className="text-2xl font-bold text-gray-900">Publicar un reporte</h1>
      <p className="mb-6 text-gray-600">Contanos qué pasó para ayudar a encontrar a la mascota.</p>
      <ReportForm />
    </div>
  );
}

export default CreateReportPage;
