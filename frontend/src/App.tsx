import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "react-router";
import { Toaster } from "@/components/ui/sonner";
import { router } from "./routes";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 30 * 1000,
    },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
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
