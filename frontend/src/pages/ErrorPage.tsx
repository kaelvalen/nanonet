import { useRouteError, isRouteErrorResponse, useNavigate } from "react-router";
import { AlertTriangle, Home, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "motion/react";

export function ErrorPage() {
  const error = useRouteError();
  const navigate = useNavigate();

  let title = "Unexpected Error";
  let message = "Something went wrong. Please try again.";

  if (isRouteErrorResponse(error)) {
    title = `${error.status} — ${error.statusText}`;
    message = error.data?.message ?? message;
  } else if (error instanceof Error) {
    message = error.message;
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ background: "var(--gradient-bg)" }}>
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="backdrop-blur-sm rounded-2xl shadow-lg p-10 max-w-md w-full text-center"
        style={{ background: "var(--surface-glass)", border: "1px solid var(--border-default)" }}
      >
        <div className="flex justify-center mb-6">
          <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ backgroundColor: "var(--status-down-subtle)" }}>
            <AlertTriangle className="w-7 h-7" style={{ color: "var(--status-down-text)" }} />
          </div>
        </div>

        <h1 className="text-lg font-bold mb-2" style={{ color: "var(--text-secondary)" }}>{title}</h1>
        <p className="text-sm mb-8 leading-relaxed" style={{ color: "var(--text-muted)" }}>{message}</p>

        <div className="flex gap-3 justify-center">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate(-1)}
            className="rounded-lg text-xs h-8"
            style={{ borderColor: "var(--border-default)", color: "var(--text-muted)" }}
          >
            <RefreshCw className="w-3 h-3 mr-1.5" /> Go back
          </Button>
          <Button
            size="sm"
            onClick={() => navigate("/", { replace: true })}
            className="text-white rounded-lg text-xs h-8 border-0 hover:opacity-90"
            style={{ background: "var(--gradient-btn-primary)" }}
          >
            <Home className="w-3 h-3 mr-1.5" /> Dashboard
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
