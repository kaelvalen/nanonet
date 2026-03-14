import { useEffect, Component, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "react-router";
import { Toaster } from "@/components/ui/sonner";
import { router } from "./routes";
import { useAuthStore } from "./store/authStore";
import { authApi } from "./api/auth";
import { useThemeStore } from "./store/themeStore";
import { useA11yStore } from "./store/a11yStore";
import { useA11y } from "./hooks/useA11y";

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-8">
          <div className="text-center max-w-md">
            <h1 className="text-2xl font-bold text-red-500 mb-2">Beklenmedik Hata</h1>
            <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">
              {this.state.error?.message ?? "Bilinmeyen hata"}
            </p>
            <div className="flex gap-3 justify-center">
              <button
                className="px-4 py-2 bg-blue-500 text-white rounded text-sm hover:bg-blue-600"
                onClick={() => window.location.reload()}
              >
                Sayfayı Yenile
              </button>
              <button
                className="px-4 py-2 bg-gray-500 text-white rounded text-sm hover:bg-gray-600"
                onClick={() => { window.location.href = '/'; }}
              >
                Ana Sayfaya Dön
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 30 * 1000,
    },
  },
});

function AppInit() {
  const { refreshToken, accessToken, setAuth, clearAuth, setInitializing, updateUser, user, isInitializing } = useAuthStore();

  useEffect(() => {
    // Sayfa yenilendiğinde access token memory'de olmaz; refresh token ile yenile
    if (refreshToken && !accessToken) {
      authApi
        .refresh(refreshToken)
        .then((res) => {
          setAuth(
            user ?? { id: "", email: "", created_at: "", updated_at: "" },
            res.access_token,
            refreshToken,
          );
          return authApi.me().then((fetchedUser) => {
            updateUser(fetchedUser);
          });
        })
        .catch(() => {
          clearAuth();
        })
        .finally(() => {
          setInitializing(false);
        });
    } else {
      setInitializing(false);
    }
  }, []);

  if (isInitializing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
      </div>
    );
  }

  return null;
}

function ThemeInit() {
  const { applyTheme } = useThemeStore();
  useEffect(() => { applyTheme(); }, [applyTheme]);
  return null;
}

function A11yInit() {
  const applyPreferences = useA11yStore((state) => state.applyPreferences);
  useEffect(() => { applyPreferences(); }, [applyPreferences]);
  return null;
}

export default function App() {
  return (
    <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <ThemeInit />
      <A11yInit />
      <AppInit />
      <RouterProvider router={router} />
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            borderRadius: "var(--radius)",
            border: "1px solid var(--toast-border)",
            background: "var(--toast-bg)",
            backdropFilter: "blur(8px)",
            fontSize: "12px",
            fontFamily: "var(--font-quicksand)",
            color: "var(--text-primary)",
          },
        }}
      />
    </QueryClientProvider>
    </ErrorBoundary>
  );
}
