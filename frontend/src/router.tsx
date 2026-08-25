import { createBrowserRouter } from 'react-router-dom'
import MainLayout from './layouts/MainLayout'
import Home from './pages/Home'
import NotFound from './pages/NotFound'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <MainLayout />,
    errorElement: <NotFound />,
    children: [
      {
        index: true,
        element: <Home />,
      },
      // Auth routes (G3)
      // {
      //   path: 'login',
      //   element: <LoginPage />,
      // },
      // {
      //   path: 'register',
      //   element: <RegisterPage />,
      // },
      // Protected routes
      // {
      //   path: 'reports',
      //   element: <ProtectedRoute><FeedPage /></ProtectedRoute>,
      // },
      // {
      //   path: 'reports/new',
      //   element: <ProtectedRoute><CreateReportPage /></ProtectedRoute>,
      // },
      // {
      //   path: 'reports/:id',
      //   element: <ProtectedRoute><ReportDetailPage /></ProtectedRoute>,
      // },
      // {
      //   path: 'chat',
      //   element: <ProtectedRoute><ChatPage /></ProtectedRoute>,
      // },
      // {
      //   path: 'comercios/register',
      //   element: <ComerciosRegisterPage />,
      // },
      // {
      //   path: 'comercios/dashboard',
      //   element: <ProtectedRoute><ComerciosDashboard /></ProtectedRoute>,
      // },
    ],
  },
  {
    path: '*',
    element: <NotFound />,
  },
])
