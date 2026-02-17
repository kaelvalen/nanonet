import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { useAuthStore } from './store/authStore';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import ServiceDetailPage from './pages/ServiceDetailPage';
import Layout from './components/layout/Layout';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" />;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route
            element={
              <PrivateRoute>
                <Layout />
              </PrivateRoute>
            }
          >
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/services/:id" element={<ServiceDetailPage />} />
          </Route>
          <Route path="/" element={<Navigate to="/dashboard" />} />
          <Route path="*" element={<Navigate to="/dashboard" />} />
        </Routes>
      </BrowserRouter>
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 3000,
          style: {
            fontSize: '13px',
            backgroundColor: '#1c2333',
            color: '#e2e8f0',
            border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: '10px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
          },
          success: {
            iconTheme: { primary: '#10b981', secondary: '#1c2333' },
          },
          error: {
            iconTheme: { primary: '#ef4444', secondary: '#1c2333' },
          },
        }}
      />
    </QueryClientProvider>
  );
}
