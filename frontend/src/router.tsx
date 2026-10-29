import { createBrowserRouter } from "react-router-dom";
import MainLayout from "./layouts/MainLayout";
import Home from "./pages/Home";
import Login from "./pages/auth/Login";
import Register from "./pages/auth/Register";
import VerifyEmailPage from "./pages/auth/VerifyEmailPage";
import ForgotPasswordPage from "./pages/auth/ForgotPasswordPage";
import ResetPasswordPage from "./pages/auth/ResetPasswordPage";
import TwoFactorResetConfirmPage from "./pages/auth/TwoFactorResetConfirmPage";
import TwoFactorResetCancelPage from "./pages/auth/TwoFactorResetCancelPage";
import SecurityPage from "./pages/account/SecurityPage";
import NotificationSettingsPage from "./pages/account/NotificationSettingsPage";
import ProtectedRoute from "./components/ProtectedRoute";
import GuestOnlyRoute from "./components/GuestOnlyRoute";
import RequireRole from "./components/RequireRole";
import FeedPage from "./pages/reports/FeedPage";
import CreateReportPage from "./pages/reports/CreateReportPage";
import ReportDetailPage from "./pages/reports/ReportDetailPage";
import EditReportPage from "./pages/reports/EditReportPage";
import ChatPage from "./pages/chat/ChatPage";
import BusinessRegisterPage from "./pages/business/BusinessRegisterPage";
import BusinessDashboardPage from "./pages/business/BusinessDashboardPage";
import BusinessDirectoryPage from "./pages/business/BusinessDirectoryPage";
import BusinessProfilePage from "./pages/business/BusinessProfilePage";
import ModerationPage from "./pages/moderation/ModerationPage";
import MyPetsPage from "./pages/pets/MyPetsPage";
import CreatePetPage from "./pages/pets/CreatePetPage";
import EditPetPage from "./pages/pets/EditPetPage";
import NotFound from "./pages/NotFound";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <MainLayout />,
    errorElement: <NotFound />,
    children: [
      {
        element: <GuestOnlyRoute />,
        children: [
          { path: "login", element: <Login /> },
          { path: "register", element: <Register /> },
        ],
      },
      // Públicas a propósito: los links de los emails se abren con o sin sesión.
      { path: "verify-email", element: <VerifyEmailPage /> },
      { path: "forgot-password", element: <ForgotPasswordPage /> },
      { path: "reset-password", element: <ResetPasswordPage /> },
      { path: "two-factor/reset/confirm", element: <TwoFactorResetConfirmPage /> },
      { path: "two-factor/reset/cancel", element: <TwoFactorResetCancelPage /> },
      {
        element: <ProtectedRoute />,
        children: [
          { index: true, element: <Home /> },
          { path: "reports", element: <FeedPage /> },
          { path: "reports/new", element: <CreateReportPage /> },
          { path: "reports/:id", element: <ReportDetailPage /> },
          { path: "reports/:id/edit", element: <EditReportPage /> },
          { path: "chats", element: <ChatPage /> },
          { path: "chats/:id", element: <ChatPage /> },
          { path: "account/security", element: <SecurityPage /> },
          { path: "account/notifications", element: <NotificationSettingsPage /> },
          { path: "businesses", element: <BusinessDirectoryPage /> },
          { path: "businesses/register", element: <BusinessRegisterPage /> },
          { path: "businesses/dashboard", element: <BusinessDashboardPage /> },
          { path: "businesses/:id", element: <BusinessProfilePage /> },
          { path: "pets", element: <MyPetsPage /> },
          { path: "pets/new", element: <CreatePetPage /> },
          { path: "pets/:id/edit", element: <EditPetPage /> },
          // El panel de moderación queda anidado: ProtectedRoute exige sesión y
          // RequireRole exige el rol. La autorización real la hace cumplir el
          // backend (`requireRole`); esto solo evita mostrar una pantalla que
          // responderia 403.
          {
            element: <RequireRole roles={["moderador", "admin"]} />,
            children: [{ path: "moderation", element: <ModerationPage /> }],
          },
        ],
      },
    ],
  },
  {
    path: "*",
    element: <NotFound />,
  },
]);
