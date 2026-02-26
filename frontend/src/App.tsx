import { useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "react-router";
import { Toaster } from "@/components/ui/sonner";
import { router } from "./routes";
import { useAuthStore } from "./store/authStore";
import { authApi } from "./api/auth";

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
  const { refreshToken, accessToken, setAuth, clearAuth, user } = useAuthStore();

  useEffect(() => {
    // Sayfa yenilendiğinde access token memory'de olmaz; refresh token ile yenile
    if (refreshToken && !accessToken) {
      authApi
        .refresh(refreshToken)
        .then((res) => {
          setAuth(user ?? { id: "", email: "", created_at: "", updated_at: "" }, res.access_token, refreshToken);
        })
        .catch(() => {
          clearAuth();
        });
    }
  }, []);

  return null;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppInit />
      <RouterProvider router={router} />
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            borderRadius: "12px",
            border: "1px solid rgba(57, 197, 187, 0.15)",
            background: "rgba(255, 255, 255, 0.95)",
            backdropFilter: "blur(8px)",
            fontSize: "12px",
            fontFamily: "var(--font-quicksand)",
          },
        }}
      />
    </QueryClientProvider>
  );
}
