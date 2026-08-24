import { createBrowserRouter } from "react-router-dom";
import MainLayout from "./layouts/MainLayout";
import Home from "./pages/Home";
import ProtectedRoute from "./components/ProtectedRoute";
import CreateReportPage from "./features/report-create/pages/CreateReportPage";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <MainLayout />,
    errorElement: <div className="p-6">Página no encontrada</div>,
    children: [
      { index: true, element: <Home /> },
      {
        element: <ProtectedRoute />,
        children: [{ path: "reports/new", element: <CreateReportPage /> }],
      },
    ],
  },
]);
